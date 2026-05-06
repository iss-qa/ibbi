const mongoose = require('mongoose');
const Person = require('./src/models/Person.model');
const Message = require('./src/models/Message.model');
require('dotenv').config({ path: '../.env' });

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Bahia';
const toZonedDate = (date) => new Date(date.toLocaleString('en-US', { timeZone: APP_TIMEZONE }));
const getBirthdayParts = (birthDate) => ({
  day: birthDate.getUTCDate(),
  month: birthDate.getUTCMonth() + 1,
});

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const now = toZonedDate(new Date());
  const day = now.getDate();
  const month = now.getMonth() + 1;
  console.log('Today is:', day, month);

  const people = await Person.find({
    status: 'ativo',
    celular: { $nin: [null, ''] },
    dataNascimento: { $ne: null },
  });

  const todosAniversariantes = people.filter((person) => {
    const birthday = getBirthdayParts(person.dataNascimento);
    return birthday.day === day && birthday.month === month;
  });
  console.log('Aniversariantes hoje:', todosAniversariantes.map(p => ({ nome: p.nome, data: p.dataNascimento })));

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

  console.log('Já enviadas:', jaEnviadas);

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

  console.log('Aniversariantes para enviar:', aniversariantes.map(p => p.nome));

  process.exit(0);
}
test().catch(console.error);
