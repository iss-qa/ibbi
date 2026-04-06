const cron = require('node-cron');
const Person = require('../models/Person.model');
const Message = require('../models/Message.model');
const templates = require('../templates/messages.templates');
const whatsapp = require('./whatsapp.service');
const { generateBirthdayCard } = require('./image.service');

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
  const aniversariantes = await findBirthdaysToday();
  if (aniversariantes.length === 0) return;

  const destinatarios = aniversariantes.map((p) => ({ nome: p.nome, celular: p.celular }));

  const messageLog = await Message.create({
    tipo: 'aniversario',
    destinatarios,
    conteudo: 'Envio automático de aniversário',
    status: 'pendente',
  });

  const erros = [];
  let enviados = 0;

  for (let i = 0; i < aniversariantes.length; i++) {
    const person = aniversariantes[i];
    try {
      // 1) Enviar texto
      await whatsapp.sendSingle(person.celular, templates.aniversario(person.nome));

      // 2) Gerar imagem do cartão e enviar
      const imageBuffer = await generateBirthdayCard(person, 'portrait');
      const base64Image = imageBuffer.toString('base64');
      await whatsapp.sendMedia(person.celular, '', base64Image);

      enviados += 1;
    } catch (err) {
      erros.push({ celular: person.celular, motivo: err.message });
      console.error(`Erro ao enviar aniversário para ${person.nome}:`, err.message);
    }

    // Delay entre destinatários para evitar rate-limit
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
  cron.schedule(
    '0 8 * * *',
    () => {
      sendBirthdayMessages().catch((err) => {
        console.error('Erro ao enviar aniversários:', err);
      });
    },
    { timezone: APP_TIMEZONE }
  );
};

module.exports = { startScheduler, sendBirthdayMessages };
