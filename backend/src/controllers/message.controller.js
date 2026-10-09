const { validationResult } = require('express-validator');
const Person = require('../models/Person.model');
const Message = require('../models/Message.model');
const User = require('../models/User.model');
const whatsapp = require('../services/whatsapp.service');
const { sendBirthdayMessages } = require('../services/scheduler.service');
const { checkConnectionState, runCheck } = require('../services/evolution-monitor.service');

// Em caso de falha de envio WhatsApp, dispara uma verificação imediata da
// conexão Evolution. Se a instância estiver realmente offline, o monitor
// envia o email de alerta na hora (respeitando o cooldown de 30 min).
const triggerEvolutionCheckOnFailure = () => {
  Promise.resolve()
    .then(() => runCheck())
    .catch((err) => console.error('[MONITOR] Falha ao verificar conexão após erro de envio:', err.message));
};
const templates = require('../templates/messages.templates');
const { generateBirthdayCard } = require('../services/image.service');
const { applyScopedCongregacaoFilter, assertPersonAccess, getUserCongregacao, getUserCongregacoes } = require('../utils/access');
const { applyTempPassword } = require('../config/defaults');

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

const buildDestinatarioLog = (destinatarios = [], initialStatus = 'pendente') => destinatarios.map((dest, index) => ({
  nome: dest.nome,
  celular: dest.celular,
  status: initialStatus,
  ordem: index,
}));

// getText opcional: texto próprio por destinatário (ex.: login de cada um)
const logAndSendBatch = async ({ tipo, destinatarios, mensagem, enviadoPor, getText }) => {
  const queuedDestinatarios = destinatarios.map((dest, index) => ({
    ...dest,
    ordem: index,
  }));

  const messageLog = await Message.create({
    tipo,
    destinatarios: buildDestinatarioLog(queuedDestinatarios),
    conteudo: mensagem,
    status: 'enviando',
    enviadoPor,
  });

  const updateDestinatario = async (ordem, patch) => {
    await Message.updateOne(
      { _id: messageLog._id },
      {
        $set: Object.fromEntries(
          Object.entries(patch)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [`destinatarios.$[dest].${key}`, value])
        ),
      },
      {
        arrayFilters: [{ 'dest.ordem': ordem }],
      }
    );

    const current = await Message.findById(messageLog._id).lean();
    if (!current) return null;

    const destinatariosAtualizados = current.destinatarios || [];

    const counts = destinatariosAtualizados.reduce((acc, dest) => {
      acc[dest.status] = (acc[dest.status] || 0) + 1;
      return acc;
    }, {});

    const processed = (counts.concluido || 0) + (counts.erro || 0);
    const allProcessed = processed === destinatariosAtualizados.length && destinatariosAtualizados.length > 0;
    const allSucceeded = allProcessed && (counts.erro || 0) === 0;
    const erros = destinatariosAtualizados
      .filter((dest) => dest.status === 'erro' && dest.erro)
      .map((dest) => ({ celular: dest.celular, motivo: dest.erro }));

    return Message.findByIdAndUpdate(
      messageLog._id,
      {
        destinatarios: destinatariosAtualizados,
        erros,
        status: allProcessed ? (allSucceeded ? 'concluido' : 'erro') : 'enviando',
        ...(allProcessed ? { concluidoEm: new Date() } : {}),
      },
      { new: true }
    );
  };

  await whatsapp.sendBatch(queuedDestinatarios, getText || ((dest) => applyVariables(mensagem, dest)), {
    onStart: async (dest) => {
      await updateDestinatario(dest.ordem, {
        status: 'enviando',
      });
    },
    onSuccess: async (dest) => {
      await updateDestinatario(dest.ordem, {
        status: 'concluido',
        processadoEm: new Date(),
        erro: null,
      });
    },
    onError: async (dest, err) => {
      await updateDestinatario(dest.ordem, {
        status: 'erro',
        processadoEm: new Date(),
        erro: err.message,
      });
    },
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
      destinatarios: buildDestinatarioLog([{ nome: destinatario.nome, celular: destinatario.celular }], 'concluido').map((dest) => ({
        ...dest,
        processadoEm: new Date(),
      })),
      conteudo,
      status: 'concluido',
      enviadoPor: req.user._id,
      concluidoEm: new Date(),
    });
    return res.json({ message: 'Mensagem enviada', log: messageLog });
  } catch (err) {
    const messageLog = await Message.create({
      tipo: 'personalizada',
      destinatarios: buildDestinatarioLog([{ nome: destinatario.nome, celular: destinatario.celular }], 'erro').map((dest) => ({
        ...dest,
        processadoEm: new Date(),
        erro: err.message,
      })),
      conteudo,
      status: 'erro',
      enviadoPor: req.user._id,
      concluidoEm: new Date(),
      erros: [{ celular: destinatario.celular, motivo: err.message }],
    });
    triggerEvolutionCheckOnFailure();
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

// Log visível ao usuário: master vê tudo; admin vê o que saiu das suas congregações ou foi enviado
// por usuários delas. Pedidos de oração têm tela própria (prayerLog), com o mesmo escopo.
const messageScopeFilter = async (user) => {
  if (user.role === 'master') return {};
  const lista = await getUserCongregacoes(user);
  const pessoas = await Person.find({ congregacao: { $in: lista } }).distinct('_id');
  const autores = await User.find({ personId: { $in: pessoas } }).distinct('_id');
  return {
    tipo: { $ne: 'oracao' },
    $or: [{ origemCongregacao: { $in: lista } }, { enviadoPor: { $in: [...autores, user._id] } }],
  };
};

const log = async (req, res) => {
  const items = await Message.find(await messageScopeFilter(req.user)).sort({ criadoEm: -1 }).limit(200);
  res.json(items);
};

const summary = async (req, res) => {
  const escopo = await messageScopeFilter(req.user);
  const [statusCounts, typeCounts] = await Promise.all([
    Message.aggregate([
      { $match: escopo },
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
      { $match: escopo },
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
    : { tipo: 'oracao', origemCongregacao: { $in: await getUserCongregacoes(req.user) } };
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
    // Só membros das congregações do usuário (admin não envia para outra congregação)
    const person = await Person.findOne(await applyScopedCongregacaoFilter(req.user, { _id: String(personId || '') }));
    if (!person || !person.celular) {
      return res.status(400).json({ message: 'Membro inválido ou sem celular cadastrado' });
    }

    await whatsapp.sendMedia(person.celular, mensagem, base64Image);

    await Message.create({
      tipo: 'documento',
      destinatarios: buildDestinatarioLog([{ nome: person.nome, celular: person.celular }], 'concluido').map((dest) => ({
        ...dest,
        processadoEm: new Date(),
      })),
      conteudo: 'Envio de Carteirinha de Membro',
      status: 'concluido',
      enviadoPor: req.user._id,
      concluidoEm: new Date(),
    });

    res.json({ message: 'Carteirinha enviada com sucesso ao membro' });
  } catch (err) {
    console.error('Erro ao enviar carteirinha:', err);
    triggerEvolutionCheckOnFailure();
    res.status(500).json({ message: err.message || 'Erro ao enviar carteirinha' });
  }
};

const sendBirthdayImage = async (req, res) => {
  try {
    const { personId, imageBase64 } = req.body;
    // Só membros das congregações do usuário (admin não envia para outra congregação)
    const person = await Person.findOne(await applyScopedCongregacaoFilter(req.user, { _id: String(personId || '') }));
    if (!person || !person.celular) {
      return res.status(400).json({ message: 'Membro inválido ou sem celular' });
    }

    // Send the text
    const textContent = templates.aniversario(person.nome);
    await whatsapp.sendSingle(person.celular, textContent);

    // Se o cliente já renderizou e enviou a imagem, usa ela; caso contrário
    // gera no servidor via Puppeteer (não funciona em ambientes serverless sem libnss3)
    let base64Image;
    if (imageBase64) {
      base64Image = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    } else {
      const imageBuffer = await generateBirthdayCard(person, 'portrait');
      base64Image = imageBuffer.toString('base64');
    }
    await whatsapp.sendMedia(person.celular, '', base64Image);
    
    // Log the manual send
    await Message.create({
      tipo: 'aniversario',
      destinatarios: buildDestinatarioLog([{ nome: person.nome, celular: person.celular }], 'concluido').map((dest) => ({
        ...dest,
        processadoEm: new Date(),
      })),
      conteudo: 'Envio manual de aniversário (texto + imagem)',
      status: 'concluido',
      enviadoPor: req.user._id,
      concluidoEm: new Date(),
    });

    res.json({ message: 'Mensagem e cartão de aniversário enviados com sucesso' });
  } catch (err) {
    console.error('Erro ao enviar imagem e texto de aniversário:', err);
    triggerEvolutionCheckOnFailure();
    res.status(500).json({ message: err.message || 'Erro ao enviar' });
  }
};

const lastBirthdayMessage = async (req, res) => {
  const { personId } = req.params;
  const person = await Person.findById(personId).select('nome celular congregacao').lean();
  if (!person) return res.status(404).json({ message: 'Pessoa não encontrada' });
  await assertPersonAccess(req.user, person);

  if (!person.celular) return res.json({ enviada: false });

  const startOfYear = new Date(new Date().getFullYear(), 0, 1);
  const msg = await Message.findOne({
    tipo: 'aniversario',
    criadoEm: { $gte: startOfYear },
    'destinatarios.celular': person.celular,
    'destinatarios.status': 'concluido',
  })
    .sort({ criadoEm: -1 })
    .select('_id criadoEm concluidoEm conteudo destinatarios enviadoPor')
    .populate('enviadoPor', 'nome')
    .lean();

  if (!msg) return res.json({ enviada: false });

  const dest = (msg.destinatarios || []).find((d) => d.celular === person.celular && d.status === 'concluido');

  // O texto enviado de fato é o template renderizado com o nome da pessoa.
  // O campo `conteudo` da mensagem registra o tipo de envio (manual/automático), não o texto.
  const textoEnviado = templates.aniversario(person.nome);

  res.json({
    enviada: true,
    mensagemId: msg._id,
    enviadoEm: dest?.processadoEm || msg.concluidoEm || msg.criadoEm,
    enviadoPor: msg.enviadoPor?.nome || 'Sistema (envio automático)',
    automatico: !msg.enviadoPor,
    textoEnviado,
    descricao: msg.conteudo,
    incluiImagem: true,
  });
};

const resendMessage = async (req, res) => {
  const msg = await Message.findOne({ ...(await messageScopeFilter(req.user)), _id: req.params.id });
  if (!msg) return res.status(404).json({ message: 'Mensagem não encontrada' });
  if (!msg.destinatarios || msg.destinatarios.length === 0) {
    return res.status(400).json({ message: 'Mensagem sem destinatários' });
  }
  if (msg.status === 'enviando') {
    return res.status(409).json({ message: 'Esta mensagem ainda está em processamento. Aguarde a finalização antes de reenviar.' });
  }

  // Birthday messages: re-send text + image via sendBirthdayImage logic
  if (msg.tipo === 'aniversario') {
    // Em segundo plano: com o ritmo anti-ban (45–90s por envio) a requisição expiraria
    res.status(202).json({ message: 'Reenvio de aniversário iniciado em segundo plano' });
    (async () => {
      const erros = [];
      for (const dest of msg.destinatarios) {
        try {
          const person = await Person.findOne({ celular: dest.celular });
          if (!person) { erros.push({ celular: dest.celular, motivo: 'Pessoa não encontrada' }); continue; }

          const textContent = templates.aniversario(person.nome);
          // Reenvio em lote: respeita o ritmo anti-ban (sendSingle não espera)
          await whatsapp.sendText(person.celular, textContent, { bulk: true });

          const imageBuffer = await generateBirthdayCard(person, 'portrait');
          const base64Image = imageBuffer.toString('base64');
          await whatsapp.sendMedia(person.celular, '', base64Image);
        } catch (err) {
          erros.push({ celular: dest.celular, motivo: err.message });
        }
      }

      const newLog = await Message.create({
        tipo: 'aniversario',
        // Status por destinatário: uma falha não pode marcar quem recebeu como "não enviado"
        destinatarios: buildDestinatarioLog(msg.destinatarios, 'concluido').map((dest) => ({
          ...dest,
          status: erros.some((err) => err.celular === dest.celular) ? 'erro' : 'concluido',
          processadoEm: new Date(),
          ...(erros.find((err) => err.celular === dest.celular) ? { erro: erros.find((err) => err.celular === dest.celular).motivo } : {}),
        })),
        conteudo: `Reenvio de aniversário (texto + imagem) para ${msg.destinatarios.map(d => d.nome).join(', ')}`,
        status: erros.length > 0 ? 'erro' : 'concluido',
        enviadoPor: req.user._id,
        concluidoEm: new Date(),
        erros,
      });
    })().catch((err) => console.error('[RESEND] Reenvio de aniversário:', err.message));
    return undefined;
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
  if (typeof mensagem !== 'string' || !mensagem.trim()) {
    return res.status(400).json({ message: 'Mensagem é obrigatória' });
  }
  res.json({ message: 'Envio de pendências de fotos iniciado em segundo plano.' });

  // Executa em background para não travar a request
  (async () => {
    try {
      const persons = await Person.find(await applyScopedCongregacaoFilter(req.user, {
        status: 'ativo',
        celular: { $exists: true, $ne: '' },
        $or: [
          { fotoUrl: { $exists: false } },
          { fotoUrl: null },
          { fotoUrl: '' },
          { fotoUrl: /dove/i },
          { fotoUrl: /logo/i }
        ]
      }));

      const tasks = [];
      for (const person of persons) {
        const user = await User.findOne({ personId: person._id });
        if (!user) continue;

        // Quem ainda não trocou recebe uma senha provisória nova e individual (os demais usam a própria)
        let senha = '(sua senha atual)';
        if (user.mustChangePassword) {
          senha = applyTempPassword(user);
          await user.save();
        }
        const msgToSend = mensagem.replace(/\{nome\}/gi, person.nome)
          .replace(/\{login\}/gi, user.login)
          .replace(/\{senha\}/gi, senha);
        tasks.push({ nome: person.nome, celular: person.celular, mensagem: msgToSend });
      }
      if (!tasks.length) return;

      // Fila anti-ban (45–90s, janela, limites) + log em messages — nada de sleep fixo
      await logAndSendBatch({
        tipo: 'personalizada',
        destinatarios: tasks.map(({ nome, celular }) => ({ nome, celular })),
        mensagem,
        enviadoPor: req.user._id,
        getText: (dest) => tasks[dest.ordem].mensagem,
      });
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
  lastBirthdayMessage,
  evolutionStatus,
  pendingPhotosCount,
  sendPendingPhotos,
};
