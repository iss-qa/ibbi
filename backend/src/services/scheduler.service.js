const cron = require('node-cron');
const Person = require('../models/Person.model');
const Message = require('../models/Message.model');
const templates = require('../templates/messages.templates');
const whatsapp = require('./whatsapp.service');

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

  await whatsapp.sendBatch(destinatarios, (dest) => templates.aniversario(dest.nome), async (dest, err) => {
    if (err) {
      erros.push({ celular: dest.celular, motivo: err.message });
    } else {
      enviados += 1;
      // Send image right after text
      try {
        const person = aniversariantes.find(p => p.celular === dest.celular);
        if (person) {
          // Send media using the local api url
          const localUrl = `http://localhost:${process.env.PORT || 3001}/api/images/aniversariante/${person._id}?format=portrait`;
          await whatsapp.sendMedia(dest.celular, '', localUrl);
        }
      } catch (mediaErr) {
        console.error(`Failed to send media to ${dest.celular}:`, mediaErr.message);
      }
    }

    if (enviados + erros.length === destinatarios.length) {
      const status = erros.length > 0 ? 'erro' : 'concluido';
      await Message.findByIdAndUpdate(messageLog._id, {
        status,
        concluidoEm: new Date(),
        erros,
      });
    }
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
