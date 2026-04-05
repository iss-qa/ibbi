const TriagemGrupo = require('../models/TriagemGrupo.model');
const Person = require('../models/Person.model');
const { applyScopedCongregacaoFilter, getUserCongregacao } = require('../utils/access');

const normalizeTipo = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const personMatchesGrupo = (person, grupo) => {
  if (!person || !grupo) return false;

  // Only validate congregation — members from the same congregation
  // are added to accompany visitors/new believers
  if (grupo.congregacao && person.congregacao !== grupo.congregacao) {
    return false;
  }

  return true;
};

const list = async (req, res) => {
  try {
    const { tipo, ativo } = req.query;
    let filter = {};

    if (tipo) filter.tipo = tipo;
    if (ativo !== undefined) filter.ativo = ativo === 'true';

    filter = await applyScopedCongregacaoFilter(req.user, filter);

    const grupos = await TriagemGrupo.find(filter).sort({ created_at: -1 });
    return res.json(grupos);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

const getById = async (req, res) => {
  try {
    const grupo = await TriagemGrupo.findById(req.params.id);
    if (!grupo) return res.status(404).json({ message: 'Grupo de triagem não encontrado' });
    return res.json(grupo);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

const create = async (req, res) => {
  try {
    const payload = { ...req.body };
    payload.created_by = req.user._id;

    if (req.user.role === 'admin') {
      payload.congregacao = await getUserCongregacao(req.user);
    }

    const grupo = await TriagemGrupo.create(payload);
    return res.status(201).json(grupo);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const grupo = await TriagemGrupo.findById(req.params.id);
    if (!grupo) return res.status(404).json({ message: 'Grupo de triagem não encontrado' });

    const payload = { ...req.body, updated_at: new Date() };

    const updated = await TriagemGrupo.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
    return res.json(updated);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const grupo = await TriagemGrupo.findByIdAndDelete(req.params.id);
    if (!grupo) return res.status(404).json({ message: 'Grupo de triagem não encontrado' });
    return res.json({ message: 'Grupo de triagem removido' });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

const addMembro = async (req, res) => {
  try {
    const grupo = await TriagemGrupo.findById(req.params.id);
    if (!grupo) return res.status(404).json({ message: 'Grupo de triagem não encontrado' });

    const { membro_id, cargo, whatsapp } = req.body;
    if (!membro_id) return res.status(400).json({ message: 'membro_id é obrigatório' });

    const person = await Person.findById(membro_id);
    if (!person) return res.status(404).json({ message: 'Pessoa não encontrada' });

    if (!personMatchesGrupo(person, grupo)) {
      return res.status(400).json({
        message: 'Esta pessoa não pode ser adicionada a este grupo porque não corresponde ao tipo ou à congregação do grupo.',
      });
    }

    // Check if member already exists in group
    const jaExiste = grupo.membros.some(
      (m) => String(m.membro_id) === String(membro_id)
    );
    if (jaExiste) {
      return res.status(400).json({ message: 'Membro já pertence a este grupo' });
    }

    grupo.membros.push({
      membro_id: person._id,
      nome: person.nome,
      celular: person.celular || '',
      whatsapp: whatsapp || person.celular || '',
      cargo: cargo || '',
      ativo: true,
    });
    grupo.updated_at = new Date();
    await grupo.save();

    return res.json(grupo);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

const removeMembro = async (req, res) => {
  try {
    const grupo = await TriagemGrupo.findById(req.params.id);
    if (!grupo) return res.status(404).json({ message: 'Grupo de triagem não encontrado' });

    const membroIndex = grupo.membros.findIndex(
      (m) => String(m._id) === req.params.membroId
    );
    if (membroIndex === -1) {
      return res.status(404).json({ message: 'Membro não encontrado no grupo' });
    }

    grupo.membros.splice(membroIndex, 1);
    grupo.updated_at = new Date();
    await grupo.save();

    return res.json(grupo);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── Atividades pré-sugeridas para novos decididos ───────────────────────────
const ATIVIDADES_SUGERIDAS = [
  {
    titulo: '1. Contato inicial por telefone',
    descricao: 'Ligar para o novo decidido dentro de 24h. Apresentar-se como parte da equipe de acolhimento da igreja, parabenizar pela decisão, perguntar como está se sentindo e se tem alguma dúvida. Anotar impressões da conversa.',
    categoria: 'contato_inicial',
    ordem: 1,
  },
  {
    titulo: '2. Mensagem de boas-vindas por WhatsApp',
    descricao: 'Enviar mensagem acolhedora por WhatsApp com: saudação pessoal, versículo de encorajamento (sugestão: Filipenses 1:6), horários dos cultos e programações da semana, e contato direto para dúvidas.',
    categoria: 'mensagem',
    ordem: 2,
  },
  {
    titulo: '3. Primeira visita ao lar',
    descricao: 'Agendar e realizar visita ao lar do novo decidido. Levar um material de boas-vindas (Bíblia, folheto da igreja). Conversar sobre a experiência da conversão, ouvir o testemunho, orar junto com a pessoa e a família.',
    categoria: 'visitacao',
    ordem: 3,
  },
  {
    titulo: '4. Acompanhar ao primeiro culto',
    descricao: 'Combinar de buscar ou encontrar o novo decidido na entrada da igreja. Sentar junto durante o culto, apresentar ao pastor e aos líderes, ajudar a se sentir à vontade no ambiente.',
    categoria: 'acolhimento',
    ordem: 4,
  },
  {
    titulo: '5. Apresentação aos líderes e ministérios',
    descricao: 'Apresentar o novo decidido ao pastor, diáconos e líderes de ministérios. Explicar brevemente cada ministério da igreja e como ele pode participar. Entregar formulário de interesse em ministérios.',
    categoria: 'integracao',
    ordem: 5,
  },
  {
    titulo: '6. Inscrição na classe de novos membros',
    descricao: 'Verificar se há turma aberta da classe de novos membros/discipulado. Inscrever o novo decidido, informar datas, horários e local. Garantir que terá material didático disponível.',
    categoria: 'integracao',
    ordem: 6,
  },
  {
    titulo: '7. Inclusão em grupo de comunhão',
    descricao: 'Identificar o grupo de comunhão ou célula mais próximo da residência do novo decidido. Apresentar ao líder do grupo, acompanhar na primeira reunião e garantir que se sentiu bem recebido.',
    categoria: 'integracao',
    ordem: 7,
  },
  {
    titulo: '8. Segundo contato por WhatsApp (1 semana)',
    descricao: 'Após uma semana, enviar mensagem perguntando como está a caminhada, se leu algum trecho bíblico, se tem dúvidas sobre a fé. Enviar devocional curto e encorajador. Reforçar convite para o próximo culto.',
    categoria: 'mensagem',
    ordem: 8,
  },
  {
    titulo: '9. Segunda visita de acompanhamento',
    descricao: 'Realizar segunda visita (2-3 semanas após a decisão). Conversar sobre o crescimento espiritual, hábito de oração e leitura bíblica. Identificar dificuldades ou dúvidas. Orar juntos e encorajar.',
    categoria: 'visitacao',
    ordem: 9,
  },
  {
    titulo: '10. Avaliação e encaminhamento para batismo',
    descricao: 'Após 30 dias, avaliar a integração do novo decidido: frequência nos cultos, participação em grupo, interesse em batismo. Conversar com o pastor sobre o progresso e encaminhar para classe de batismo se apropriado.',
    categoria: 'acompanhamento',
    ordem: 10,
  },
];

const initAtividades = async (req, res) => {
  try {
    const grupo = await TriagemGrupo.findById(req.params.id);
    if (!grupo) return res.status(404).json({ message: 'Grupo não encontrado' });

    if (grupo.atividades && grupo.atividades.length > 0) {
      return res.status(400).json({ message: 'Grupo já possui atividades. Use os endpoints individuais para gerenciar.' });
    }

    grupo.atividades = ATIVIDADES_SUGERIDAS.map((a) => ({ ...a }));
    grupo.updated_at = new Date();
    await grupo.save();
    return res.json(grupo);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

const updateAtividade = async (req, res) => {
  try {
    const grupo = await TriagemGrupo.findById(req.params.id);
    if (!grupo) return res.status(404).json({ message: 'Grupo não encontrado' });

    const atividade = grupo.atividades.id(req.params.atividadeId);
    if (!atividade) return res.status(404).json({ message: 'Atividade não encontrada' });

    const { responsavel_id, responsavel_nome, concluida, titulo, descricao, prazo, observacao } = req.body;

    if (responsavel_id !== undefined) atividade.responsavel_id = responsavel_id;
    if (responsavel_nome !== undefined) atividade.responsavel_nome = responsavel_nome;
    if (concluida !== undefined) {
      atividade.concluida = concluida;
      atividade.concluida_em = concluida ? new Date() : null;
    }
    if (titulo !== undefined) atividade.titulo = titulo;
    if (descricao !== undefined) atividade.descricao = descricao;
    if (prazo !== undefined) atividade.prazo = prazo;
    if (observacao !== undefined) atividade.observacao = observacao;

    grupo.updated_at = new Date();
    await grupo.save();
    return res.json(grupo);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

const addAtividade = async (req, res) => {
  try {
    const grupo = await TriagemGrupo.findById(req.params.id);
    if (!grupo) return res.status(404).json({ message: 'Grupo não encontrado' });

    const { titulo, descricao, categoria, responsavel_id, responsavel_nome, prazo } = req.body;
    if (!titulo) return res.status(400).json({ message: 'titulo é obrigatório' });

    const ordem = grupo.atividades.length + 1;
    grupo.atividades.push({ titulo, descricao, categoria, responsavel_id, responsavel_nome, prazo, ordem });
    grupo.updated_at = new Date();
    await grupo.save();
    return res.json(grupo);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

const removeAtividade = async (req, res) => {
  try {
    const grupo = await TriagemGrupo.findById(req.params.id);
    if (!grupo) return res.status(404).json({ message: 'Grupo não encontrado' });

    const idx = grupo.atividades.findIndex((a) => String(a._id) === req.params.atividadeId);
    if (idx === -1) return res.status(404).json({ message: 'Atividade não encontrada' });

    grupo.atividades.splice(idx, 1);
    grupo.updated_at = new Date();
    await grupo.save();
    return res.json(grupo);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

const sendAtividadesWhatsApp = async (req, res) => {
  try {
    const grupo = await TriagemGrupo.findById(req.params.id);
    if (!grupo) return res.status(404).json({ message: 'Grupo não encontrado' });

    const { membro_id } = req.body;
    if (!membro_id) return res.status(400).json({ message: 'membro_id é obrigatório' });

    const membro = grupo.membros.find((m) => String(m.membro_id) === String(membro_id));
    if (!membro) return res.status(404).json({ message: 'Membro não encontrado no grupo' });
    if (!membro.celular) return res.status(400).json({ message: 'Membro sem celular cadastrado' });

    const atividadesDoMembro = grupo.atividades.filter(
      (a) => String(a.responsavel_id) === String(membro_id) && !a.concluida
    );

    if (atividadesDoMembro.length === 0) {
      return res.status(400).json({ message: 'Nenhuma atividade pendente para este membro' });
    }

    const firstName = membro.nome?.split(' ')[0] || 'Irmão(ã)';
    let msg = `🤝 *Projeto Amigo — ${grupo.nome}*\n\n`;
    msg += `Olá, *${firstName}*! Seguem suas atividades de acompanhamento:\n\n`;

    atividadesDoMembro.forEach((a, i) => {
      msg += `━━━━━━━━━━━━━━━━\n`;
      msg += `📋 *${a.titulo}*\n`;
      if (a.descricao) msg += `${a.descricao}\n`;
      msg += `\n`;
    });

    msg += `━━━━━━━━━━━━━━━━\n`;
    msg += `\n✅ Total: *${atividadesDoMembro.length} atividade(s) pendente(s)*\n`;
    msg += `\nQue Deus abençoe seu serviço! 🙏\n_Igreja Batista Bíblica Israel_`;

    const whatsapp = require('../services/whatsapp.service');
    await whatsapp.sendSingle(membro.celular, msg);

    const Message = require('../models/Message.model');
    await Message.create({
      tipo: 'projeto_amigo',
      destinatarios: [{ nome: membro.nome, celular: membro.celular }],
      conteudo: `Atividades do Projeto Amigo enviadas para ${membro.nome} (${atividadesDoMembro.length} atividades)`,
      status: 'concluido',
      enviadoPor: req.user._id,
      concluidoEm: new Date(),
    });

    res.json({ message: `Atividades enviadas para ${membro.nome} via WhatsApp` });
  } catch (err) {
    console.error('Erro ao enviar atividades via WhatsApp:', err);
    return res.status(err.status || 500).json({ message: err.message });
  }
};

const addAcompanhado = async (req, res) => {
  try {
    const grupo = await TriagemGrupo.findById(req.params.id);
    if (!grupo) return res.status(404).json({ message: 'Grupo não encontrado' });

    const { person_id } = req.body;
    if (!person_id) return res.status(400).json({ message: 'person_id é obrigatório' });

    const person = await Person.findById(person_id);
    if (!person) return res.status(404).json({ message: 'Pessoa não encontrada' });

    const jaExiste = grupo.acompanhados?.some((a) => String(a.person_id) === String(person_id));
    if (jaExiste) return res.status(400).json({ message: 'Pessoa já está sendo acompanhada neste grupo' });

    grupo.acompanhados.push({
      person_id: person._id,
      nome: person.nome,
      celular: person.celular || '',
      tipo: person.tipo || '',
      data: person.dataDecisao || person.dataVisita || new Date(),
      congregacao: person.congregacao || '',
    });
    grupo.updated_at = new Date();
    await grupo.save();
    return res.json(grupo);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

const removeAcompanhado = async (req, res) => {
  try {
    const grupo = await TriagemGrupo.findById(req.params.id);
    if (!grupo) return res.status(404).json({ message: 'Grupo não encontrado' });

    const idx = grupo.acompanhados.findIndex((a) => String(a._id) === req.params.acompanhadoId);
    if (idx === -1) return res.status(404).json({ message: 'Acompanhado não encontrado' });

    grupo.acompanhados.splice(idx, 1);
    grupo.updated_at = new Date();
    await grupo.save();
    return res.json(grupo);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  addMembro,
  removeMembro,
  initAtividades,
  updateAtividade,
  addAtividade,
  removeAtividade,
  sendAtividadesWhatsApp,
  addAcompanhado,
  removeAcompanhado,
  ATIVIDADES_SUGERIDAS,
};
