const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Carrega o .env da raiz do monorepo
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const Person = require('../models/Person.model');
const User = require('../models/User.model');
const whatsapp = require('../services/whatsapp.service');
const { DEFAULT_USER_PASSWORD } = require('../config/defaults');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

const main = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI não configurada no .env');
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Conectado ao MongoDB.');

  // Busca membros ativos, com celular e sem foto (ou foto inválida)
  const persons = await Person.find({
    status: 'ativo',
    celular: { $exists: true, $ne: '' },
    $or: [
      { fotoUrl: { $exists: false } },
      { fotoUrl: null },
      { fotoUrl: '' },
      { fotoUrl: /dove/i },
      { fotoUrl: /logo/i }
    ]
  });

  console.log(`Encontrados ${persons.length} membros sem foto.`);

  const tasks = [];

  for (const person of persons) {
    const user = await User.findOne({ personId: person._id });
    if (!user) {
      console.log(`Pulando ${person.nome} - não possui usuário associado.`);
      continue;
    }

    // Template da mensagem solicitado
    const mensagem = `Shalom amado(a) irmão(ã) *${person.nome}*, encontramos uma pendência no seu cadastro.

* PROBLEMA -> Cadastro sem foto *

Acesse nosso portal:
🔗 Portal: https://ibbi.issqa.com.br/login
👤 Usuário: ${user.login}
🔑 Senha: ${DEFAULT_USER_PASSWORD}

E atualize seu cadastro! Escolha a foto que preferir, porém insira uma foto no estilo 3x4, evite fotos abertas de paisagem, na qual não consiga identificar seu rosto.

_Igreja Batista Bíblica Israel_`;

    tasks.push({
      nome: person.nome,
      celular: person.celular,
      mensagem
    });
  }

  console.log(`\nPronto para enviar ${tasks.length} mensagens.`);

  const BATCH_SIZE = 10;
  
  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE);
    console.log(`\n--- Processando Lote ${Math.floor(i / BATCH_SIZE) + 1} de ${Math.ceil(tasks.length / BATCH_SIZE)} (${batch.length} mensagens) ---`);

    for (let j = 0; j < batch.length; j++) {
      const task = batch[j];
      console.log(`[${new Date().toLocaleTimeString()}] Enviando para ${task.nome} (${task.celular})...`);
      
      try {
        await whatsapp.sendSingle(task.celular, task.mensagem);
        console.log(`✅ Sucesso -> ${task.nome}`);
      } catch (err) {
        console.error(`❌ Erro ao enviar para ${task.nome}:`, err.message);
      }

      // Intervalo de 10s entre envios do mesmo lote
      if (j < batch.length - 1) {
        console.log('Aguardando 10 segundos para a próxima mensagem...');
        await sleep(10000);
      }
    }

    // Intervalo de 5 a 10 minutos entre lotes
    if (i + BATCH_SIZE < tasks.length) {
      const minutesToWait = randomBetween(5, 10);
      const msToWait = minutesToWait * 60 * 1000;
      console.log(`\nLote concluído. Aguardando ${minutesToWait} minutos antes de iniciar o próximo lote...`);
      await sleep(msToWait);
    }
  }

  console.log('\nTodos os envios foram processados com sucesso!');
  await mongoose.disconnect();
};

main().catch((err) => {
  console.error('Erro fatal no script:', err);
  mongoose.disconnect();
  process.exit(1);
});
