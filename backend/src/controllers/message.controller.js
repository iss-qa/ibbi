const { validationResult } = require('express-validator');
const Person = require('../models/Person.model');
const Message = require('../models/Message.model');
const User = require('../models/User.model');
const whatsapp = require('../services/whatsapp.service');
const { sendBirthdayMessages } = require('../services/scheduler.service');
const { checkConnectionState } = require('../services/evolution-monitor.service');
const templates = require('../templates/messages.templates');
const { generateBirthdayCard } = require('../services/image.service');
const { applyScopedCongregacaoFilter, assertPersonAccess, getUserCongregacao } = require('../utils/access');
const { DEFAULT_USER_PASSWORD } = require('../config/defaults');

const SUMMARY_TYPE_ORDER = [
  'aniversario',
  'oracao',
  'projeto_amigo',
  'novo cadastro',
  'personalizada',
  'aviso',
  'documento',
  'convite',
  'novo decidido',
  'visitante',
  'reunião',
  'ata',
];

const applyVariables = (template, person) => {
  if (!template) return '';
  return template
    .replace(/\{nome\}/gi, person?.nome || '')
    .replace(/\{congregacao\}/gi, person?.congregacao || '');
};

const normalizeSummaryTipo = (tipo) => {
  if (['aviso - novo cadastro', 'aviso - novo membro'].includes(tipo)) return 'novo cadastro';
  if (tipo === 'novo_decidido') return 'novo decidido';
  if (tipo === 'projeto_amigo') return 'projeto_amigo';
  return tipo;
};

const formatSummaryLabel = (tipo) => {
  if (tipo === 'projeto_amigo') return 'Projeto Amigo';
  if (tipo === 'novo cadastro') return 'Novo cadastro';
  if (tipo === 'novo decidido') return 'Novo decidido';
  if (tipo === 'personalizada') return 'Personalizada';
  if (tipo === 'reunião') return 'Reunião';
  return tipo.charAt(0).toUpperCase() + tipo.slice(1);
};

const logAndSendBatch = async ({ tipo, destinatarios, mensagem, enviadoPor }) => {
  const messageLog = await Message.create({
    tipo,
    destinatarios,
    conteudo: mensagem,
    status: 'enviando',
    enviadoPor,
  });

  const erros = [];
  let processed = 0;

  await whatsapp.sendBatch(destinatarios, (dest) => applyVariables(mensagem, dest), async (dest, err) => {
    processed += 1;
    if (err) {
      erros.push({ celular: dest.celular, motivo: err.message });
    }

    if (processed === destinatarios.length) {
      await Message.findByIdAndUpdate(messageLog._id, {
        status: erros.length > 0 ? 'erro' : 'concluido',
        concluidoEm: new Date(),
        erros,
      });
    }
  });

  return messageLog;
};

const sendIndividual = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { personId, celular, mensagem } = req.body;
  let person = null;

  if (personId) person = await Person.findById(personId);
  if (!person && celular) person = await Person.findOne({ celular: String(celular).replace(/\D/g, '') });
  if (person) {
    await assertPersonAccess(req.user, person);
  }

  const destinatario = {
    nome: person?.nome || 'Membro',
    celular: person?.celular || celular,
    congregacao: person?.congregacao,
  };

  const conteudo = applyVariables(mensagem, destinatario);

  try {
    await whatsapp.sendSingle(destinatario.celular, conteudo);
    const messageLog = await Message.create({
      tipo: 'personalizada',
      destinatarios: [{ nome: destinatario.nome, celular: destinatario.celular }],
      conteudo,
      status: 'concluido',
      enviadoPor: req.user._id,
      concluidoEm: new Date(),
    });
    return res.json({ message: 'Mensagem enviada', log: messageLog });
  } catch (err) {
    const messageLog = await Message.create({
      tipo: 'personalizada',
      destinatarios: [{ nome: destinatario.nome, celular: destinatario.celular }],
      conteudo,
      status: 'erro',
      enviadoPor: req.user._id,
      concluidoEm: new Date(),
      erros: [{ celular: destinatario.celular, motivo: err.message }],
    });
    return res.status(500).json({ message: err.message, log: messageLog });
  }
};

const sendByGroup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { grupo, mensagem } = req.body;
  const filter = await applyScopedCongregacaoFilter(req.user, { grupo, status: 'ativo', celular: { $ne: '' } });
  const pessoas = await Person.find(filter);
  const destinatarios = pessoas.map((p) => ({
    nome: p.nome,
    celular: p.celular,
    congregacao: p.congregacao,
  }));

  const log = await logAndSendBatch({
    tipo: 'aviso',
    destinatarios,
    mensagem,
    enviadoPor: req.user._id,
  });

  return res.json({ message: 'Envio enfileirado', log });
};

const sendByCongregation = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { congregacao, mensagem } = req.body;
  const scopedCongregacao = await getUserCongregacao(req.user);
  const filter = await applyScopedCongregacaoFilter(req.user, { status: 'ativo', celular: { $ne: '' } }, congregacao);
  const pessoas = await Person.find(filter);
  const destinatarios = pessoas.map((p) => ({
    nome: p.nome,
    celular: p.celular,
    congregacao: p.congregacao,
  }));

  const log = await logAndSendBatch({
    tipo: 'aviso',
    destinatarios,
    mensagem,
    enviadoPor: req.user._id,
  });

  return res.json({ message: 'Envio enfileirado', log, congregacao: scopedCongregacao || congregacao });
};

const log = async (req, res) => {
  const items = await Message.find().sort({ criadoEm: -1 }).limit(200);
  res.json(items);
};

const summary = async (req, res) => {
  const [statusCounts, typeCounts] = await Promise.all([
    Message.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          concluido: {
            $sum: {
              $cond: [{ $eq: ['$status', 'concluido'] }, 1, 0],
            },
          },
          enviando: {
            $sum: {
              $cond: [{ $eq: ['$status', 'enviando'] }, 1, 0],
            },
          },
          erro: {
            $sum: {
              $cond: [{ $eq: ['$status', 'erro'] }, 1, 0],
            },
          },
        },
      },
    ]),
    Message.aggregate([
      {
        $group: {
          _id: '$tipo',
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const baseStats = statusCounts[0] || { total: 0, concluido: 0, enviando: 0, erro: 0 };
  const groupedTypes = typeCounts.reduce((acc, item) => {
    const key = normalizeSummaryTipo(item._id);
    acc[key] = (acc[key] || 0) + item.count;
    return acc;
  }, {});

  const orderedTypeKeys = [
    ...SUMMARY_TYPE_ORDER,
    ...Object.keys(groupedTypes).filter((key) => !SUMMARY_TYPE_ORDER.includes(key)),
  ];

  const byType = orderedTypeKeys.map((key) => ({
    key,
    label: formatSummaryLabel(key),
    count: groupedTypes[key] || 0,
  }));

  res.json({
    total: baseStats.total,
    concluido: baseStats.concluido,
    enviando: baseStats.enviando,
    erro: baseStats.erro,
    byType,
  });
};

const prayerLog = async (req, res) => {
  const filter = req.user.role === 'master'
    ? { tipo: 'oracao' }
    : { tipo: 'oracao', origemCongregacao: await getUserCongregacao(req.user) };
  const items = await Message.find(filter).sort({ criadoEm: -1 }).limit(200).populate('enviadoPor', 'nome');
  const mapped = items.map((item) => ({
    _id: item._id,
    data: item.criadoEm,
    nome: item.origemNome || item.enviadoPor?.nome || 'Usuário',
    congregacao: item.origemCongregacao || '',
    conteudo: item.conteudo,
  }));
  res.json(mapped);
};

const queueStatus = (req, res) => {
  res.json(whatsapp.getQueueStatus());
};

const cancelQueue = (req, res) => {
  whatsapp.cancelQueue();
  res.json({ message: 'Fila cancelada' });
};

const sendBirthdayNow = async (req, res) => {
  await sendBirthdayMessages();
  res.json({ message: 'Envio de aniversários disparado' });
};

const sendCarteirinha = async (req, res) => {
  try {
    const { personId, base64Image, mensagem } = req.body;
    const person = await Person.findById(personId);
    if (!person || !person.celular) {
      return res.status(400).json({ message: 'Membro inválido ou sem celular cadastrado' });
    }

    await whatsapp.sendMedia(person.celular, mensagem, base64Image);

    await Message.create({
      tipo: 'documento',
      destinatarios: [{ nome: person.nome, celular: person.celular }],
      conteudo: 'Envio de Carteirinha de Membro',
      status: 'concluido',
      enviadoPor: req.user._id,
      concluidoEm: new Date(),
    });

    res.json({ message: 'Carteirinha enviada com sucesso ao membro' });
  } catch (err) {
    console.error('Erro ao enviar carteirinha:', err);
    res.status(500).json({ message: err.message || 'Erro ao enviar carteirinha' });
  }
};

const sendBirthdayImage = async (req, res) => {
  try {
    const { personId } = req.body;
    const person = await Person.findById(personId);
    if (!person || !person.celular) {
      return res.status(400).json({ message: 'Membro inválido ou sem celular' });
    }

    // Send the text
    const textContent = templates.aniversario(person.nome);
    await whatsapp.sendSingle(person.celular, textContent);

    // Gerar imagem do cartão diretamente e enviar
    const imageBuffer = await generateBirthdayCard(person, 'portrait');
    const base64Image = imageBuffer.toString('base64');
    await whatsapp.sendMedia(person.celular, '', base64Image);
    
    // Log the manual send
    await Message.create({
      tipo: 'aniversario',
      destinatarios: [{ nome: person.nome, celular: person.celular }],
      conteudo: 'Envio manual de aniversário (texto + imagem)',
      status: 'concluido',
      enviadoPor: req.user._id,
      concluidoEm: new Date(),
    });

    res.json({ message: 'Mensagem e cartão de aniversário enviados com sucesso' });
  } catch (err) {
    console.error('Erro ao enviar imagem e texto de aniversário:', err);
    res.status(500).json({ message: err.message || 'Erro ao enviar' });
  }
};

const resendMessage = async (req, res) => {
  const msg = await Message.findById(req.params.id);
  if (!msg) return res.status(404).json({ message: 'Mensagem não encontrada' });
  if (!msg.destinatarios || msg.destinatarios.length === 0) {
    return res.status(400).json({ message: 'Mensagem sem destinatários' });
  }

  // Birthday messages: re-send text + image via sendBirthdayImage logic
  if (msg.tipo === 'aniversario') {
    const erros = [];
    for (const dest of msg.destinatarios) {
      try {
        const person = await Person.findOne({ celular: dest.celular });
        if (!person) { erros.push({ celular: dest.celular, motivo: 'Pessoa não encontrada' }); continue; }

        const textContent = templates.aniversario(person.nome);
        await whatsapp.sendSingle(person.celular, textContent);

        const imageBuffer = await generateBirthdayCard(person, 'portrait');
        const base64Image = imageBuffer.toString('base64');
        await whatsapp.sendMedia(person.celular, '', base64Image);
      } catch (err) {
        erros.push({ celular: dest.celular, motivo: err.message });
      }
    }

    const newLog = await Message.create({
      tipo: 'aniversario',
      destinatarios: msg.destinatarios,
      conteudo: `Reenvio de aniversário (texto + imagem) para ${msg.destinatarios.map(d => d.nome).join(', ')}`,
      status: erros.length > 0 ? 'erro' : 'concluido',
      enviadoPor: req.user._id,
      concluidoEm: new Date(),
      erros,
    });

    return res.json({ message: 'Reenvio de aniversário realizado', log: newLog });
  }

  // Other message types: re-send as batch text
  const log = await logAndSendBatch({
    tipo: msg.tipo,
    destinatarios: msg.destinatarios,
    mensagem: msg.conteudo,
    enviadoPor: req.user._id,
  });

  res.json({ message: 'Reenvio enfileirado', log });
};

const evolutionStatus = async (req, res) => {
  const result = await checkConnectionState();
  const status = result.online ? 200 : 503;
  res.status(status).json(result);
};

const pendingPhotosCount = async (req, res) => {
  const count = await Person.countDocuments({
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
  res.json({ count });
};

const sendPendingPhotos = async (req, res) => {
  const { mensagem } = req.body;
  res.json({ message: 'Envio de pendências de fotos iniciado em segundo plano.' });

  // Executa em background para não travar a request
  (async () => {
    try {
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

      const tasks = [];
      for (const person of persons) {
        const user = await User.findOne({ personId: person._id });
        if (!user) continue;

        let msgToSend = mensagem.replace(/\{nome\}/gi, person.nome)
                                .replace(/\{login\}/gi, user.login)
                                .replace(/\{senha\}/gi, DEFAULT_USER_PASSWORD);
        tasks.push({ nome: person.nome, celular: person.celular, mensagem: msgToSend });
      }

      const BATCH_SIZE = 10;
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

      for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
        const batch = tasks.slice(i, i + BATCH_SIZE);
        for (let j = 0; j < batch.length; j++) {
          const task = batch[j];
          try {
            await whatsapp.sendSingle(task.celular, task.mensagem);
          } catch (e) {
            console.error('Erro enviando pendência foto para', task.nome, e);
          }
          if (j < batch.length - 1) await sleep(10000); // 10 segundos
        }
        if (i + BATCH_SIZE < tasks.length) {
          const msToWait = randomBetween(5, 10) * 60 * 1000; // 5 a 10 min
          await sleep(msToWait);
        }
      }
    } catch (err) {
      console.error('Erro fatal no sendPendingPhotos background:', err);
    }
  })();
};

module.exports = {
  sendIndividual,
  sendByGroup,
  sendByCongregation,
  log,
  summary,
  prayerLog,
  queueStatus,
  cancelQueue,
  sendBirthdayNow,
  sendBirthdayImage,
  sendCarteirinha,
  resendMessage,
  evolutionStatus,
  pendingPhotosCount,
  sendPendingPhotos,
};
