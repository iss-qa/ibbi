const mongoose = require('mongoose');
const Message = require('./src/models/Message.model');
require('dotenv').config({ path: '../.env' });
async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const result = await Message.find({
    tipo: 'aniversario',
    criadoEm: { $gte: startOfDay },
    conteudo: 'Envio automático de aniversário'
  }).lean();
  console.log('Mensagens automáticas hoje:', result.length);
  if (result.length > 0) {
    console.log('Status geral:', result[0].status);
    console.log('Destinatarios:', result[0].destinatarios.map(d => ({ nome: d.nome, status: d.status })));
  }
  process.exit(0);
}
check().catch(console.error);
