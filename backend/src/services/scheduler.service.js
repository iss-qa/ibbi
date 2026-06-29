const cron = require('node-cron');
const Person = require('../models/Person.model');
const Message = require('../models/Message.model');
const templates = require('../templates/messages.templates');
const whatsapp = require('./whatsapp.service');
const { generateBirthdayCard } = require('./image.service');
const { sendBirthdayEmail } = require('./birthday-email.service');

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Bahia';

const toZonedDate = (date) =>
  new Date(date.toLocaleString('en-US', { timeZone: APP_TIMEZONE }));

const getBirthdayParts = (birthDate) => ({
  day: birthDate.getUTCDate(),
  month: birthDate.getUTCMonth() + 1,
});

const findBirthdaysToday = async () => {
  const now = toZonedDate(new Date());
  const day = now.getDate();
  const month = now.getMonth() + 1;

  const people = await Person.find({
    status: 'ativo',
    celular: { $nin: [null, ''] },
    dataNascimento: { $ne: null },
  });

  return people.filter((person) => {
    const birthday = getBirthdayParts(person.dataNascimento);
    return birthday.day === day && birthday.month === month;
  });
};

const DELAY_BETWEEN_SENDS_MS = 30 * 1000;

const sendBirthdayMessages = async () => {
  const todosAniversariantes = await findBirthdaysToday();
  if (todosAniversariantes.length === 0) return;

  // Idempotência: ignora quem já recebeu mensagem de aniversário com sucesso hoje
  const startOfDay = toZonedDate(new Date());
  startOfDay.setHours(0, 0, 0, 0);

  const celulares = todosAniversariantes.map((p) => p.celular).filter(Boolean);
  const jaEnviadas = celulares.length
    ? await Message.find({
      tipo: 'aniversario',
      criadoEm: { $gte: startOfDay },
      'destinatarios.celular': { $in: celulares },
      'destinatarios.status': 'concluido',
    }).select('destinatarios').lean()
    : [];

  const celularesEnviadosHoje = new Set();
  for (const msg of jaEnviadas) {
    for (const dest of msg.destinatarios || []) {
      if (dest.status === 'concluido' && dest.celular) {
        celularesEnviadosHoje.add(dest.celular);
      }
    }
  }

  const aniversariantes = todosAniversariantes.filter(
    (p) => !celularesEnviadosHoje.has(p.celular),
  );

  if (aniversariantes.length === 0) {
    console.log(`[scheduler] ${todosAniversariantes.length} aniversariantes hoje, todos já receberam.`);
    return;
  }

  const destinatarios = aniversariantes.map((p, index) => ({
    nome: p.nome,
    celular: p.celular,
    status: 'pendente',
    ordem: index,
  }));

  const messageLog = await Message.create({
    tipo: 'aniversario',
    destinatarios,
    conteudo: 'Envio automático de aniversário',
    status: 'enviando',
  });

  const erros = [];
  let enviados = 0;

  for (let i = 0; i < aniversariantes.length; i++) {
    const person = aniversariantes[i];
    let destStatus = 'concluido';
    let destErro;

    try {
      await whatsapp.sendSingle(person.celular, templates.aniversario(person.nome));

      const imageBuffer = await generateBirthdayCard(person, 'portrait');
      const base64Image = imageBuffer.toString('base64');
      await whatsapp.sendMedia(person.celular, '', base64Image);

      enviados += 1;

      // Canal secundário: email de aniversário com o mesmo cartão embutido.
      // Roda em try/catch próprio para não afetar o status/idempotência do WhatsApp.
      if (person.email) {
        try {
          await sendBirthdayEmail(person, imageBuffer);
          console.log(`[scheduler] Email de aniversário enviado para ${person.nome} <${person.email}>`);
        } catch (emailErr) {
          console.error(`[scheduler] Falha ao enviar email de aniversário para ${person.nome}:`, emailErr.message);
        }
      }
    } catch (err) {
      destStatus = 'erro';
      destErro = err.message;
      erros.push({ celular: person.celular, motivo: err.message });
      console.error(`Erro ao enviar aniversário para ${person.nome}:`, err.message);
    }

    await Message.updateOne(
      { _id: messageLog._id },
      {
        $set: {
          'destinatarios.$[dest].status': destStatus,
          'destinatarios.$[dest].processadoEm': new Date(),
          ...(destErro ? { 'destinatarios.$[dest].erro': destErro } : {}),
        },
      },
      { arrayFilters: [{ 'dest.ordem': i }] },
    );

    if (i < aniversariantes.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_SENDS_MS));
    }
  }

  const status = erros.length > 0 ? (enviados > 0 ? 'concluido' : 'erro') : 'concluido';
  await Message.findByIdAndUpdate(messageLog._id, {
    status,
    concluidoEm: new Date(),
    erros,
  });
};

const startScheduler = () => {
  // Executa o check de aniversários na inicialização (após 10 segundos) 
  // para garantir que se o servidor reiniciou (ex: deploy), ele mande quem faltou.
  setTimeout(() => {
    console.log('[scheduler] Rodando verificação de aniversários na inicialização...');
    sendBirthdayMessages().catch((err) => {
      console.error('Erro ao enviar aniversários na inicialização:', err);
    });
  }, 10000);

  // Agenda para rodar no minuto 0 de cada hora
  cron.schedule(
    '0 * * * *',
    () => {
      sendBirthdayMessages().catch((err) => {
        console.error('Erro ao enviar aniversários:', err);
      });
    },
    { timezone: APP_TIMEZONE }
  );
};

module.exports = { startScheduler, sendBirthdayMessages };
