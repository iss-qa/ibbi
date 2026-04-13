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

const ETAPA_DEFAULT = {
  novos_decididos: 'triagem',
  visitantes: 'triagem',
  personalizado: 'triagem',
};

const sanitizeGrupoPayload = (body = {}) => ({
  nome: String(body.nome || '').trim(),
  tipo: String(body.tipo || '').trim(),
  etapa: String(body.etapa || '').trim() || ETAPA_DEFAULT[body.tipo] || 'triagem',
  descricao: String(body.descricao || '').trim(),
  congregacao: String(body.congregacao || '').trim(),
  ativo: body.ativo !== false,
});

const list = async (req, res) => {
  try {
    const { tipo, etapa, ativo, congregacao } = req.query;
    let filter = {};

    if (tipo) filter.tipo = tipo;
    if (etapa) filter.etapa = etapa;
    if (ativo !== undefined) filter.ativo = ativo === 'true';

    if (req.user.role === 'user') {
      filter['membros.membro_id'] = req.user.personId;
    } else {
      filter = await applyScopedCongregacaoFilter(req.user, filter, congregacao);
    }

    // "Todos" (master sem filtro de congregação): ocultar grupos default
    if (req.user.role === 'master' && (!congregacao || congregacao === 'Todos')) {
      filter.isDefault = { $ne: true };
    }

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

    if (req.user.role === 'user') {
      const isMember = grupo.membros.some((m) => String(m.membro_id) === String(req.user.personId));
      if (!isMember) return res.status(403).json({ message: 'Acesso negado' });
    }

    return res.json(grupo);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

const create = async (req, res) => {
  try {
    const payload = sanitizeGrupoPayload(req.body);
    payload.created_by = req.user._id;

    // Admin: force congregation from user profile
    if (req.user.role === 'admin') {
      payload.congregacao = await getUserCongregacao(req.user);
    }

    // Validate required fields
    if (!payload.nome || !payload.nome.trim()) {
      return res.status(400).json({ message: 'Nome do grupo é obrigatório' });
    }
    if (!payload.tipo) {
      return res.status(400).json({ message: 'Tipo do grupo é obrigatório' });
    }
    if (!payload.congregacao) {
      return res.status(400).json({ message: 'Congregação do grupo é obrigatória' });
    }

    const grupo = await TriagemGrupo.create(payload);
    return res.status(201).json(grupo);
  } catch (err) {
    console.error('[TRIAGEM CREATE ERROR]', {
      message: err.message,
      userId: req.user?._id,
      role: req.user?.role,
      body: {
        nome: req.body?.nome,
        tipo: req.body?.tipo,
        congregacao: req.body?.congregacao,
        ativo: req.body?.ativo,
      },
    });
    return res.status(err.status || 500).json({ message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const grupo = await TriagemGrupo.findById(req.params.id);
    if (!grupo) return res.status(404).json({ message: 'Grupo de triagem não encontrado' });

    const payload = {
      ...sanitizeGrupoPayload(req.body),
      updated_at: new Date(),
    };

    if (req.user.role === 'admin') {
      payload.congregacao = await getUserCongregacao(req.user);
    }

    if (!payload.nome) {
      return res.status(400).json({ message: 'Nome do grupo é obrigatório' });
    }
    if (!payload.tipo) {
      return res.status(400).json({ message: 'Tipo do grupo é obrigatório' });
    }
    if (!payload.congregacao) {
      return res.status(400).json({ message: 'Congregação do grupo é obrigatória' });
    }

    const updated = await TriagemGrupo.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
    return res.json(updated);
  } catch (err) {
    console.error('[TRIAGEM UPDATE ERROR]', {
      message: err.message,
      grupoId: req.params.id,
      userId: req.user?._id,
      role: req.user?.role,
    });
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

// ─── Atividades pré-sugeridas por etapa ──────────────────────────────────────
const ATIVIDADES_POR_ETAPA = {
  triagem: [
    { titulo: '1. Contato inicial por telefone', descricao: 'Ligar para o novo decidido/visitante dentro de 24h. Apresentar-se como parte da equipe de acolhimento, parabenizar pela decisão ou visita, perguntar como está se sentindo. Anotar impressões da conversa.', categoria: 'contato_inicial', ordem: 1 },
    { titulo: '2. Mensagem de boas-vindas por WhatsApp', descricao: 'Enviar mensagem acolhedora com: saudação pessoal, versículo de encorajamento (sugestão: Filipenses 1:6), horários dos cultos e programações da semana, e contato direto para dúvidas.', categoria: 'mensagem', ordem: 2 },
    { titulo: '3. Preencher ficha de cadastro', descricao: 'Registrar dados completos no sistema: nome, telefone, endereço, data de nascimento, tipo sanguíneo, contato de emergência. Garantir que o cadastro está atualizado e completo.', categoria: 'contato_inicial', ordem: 3 },
    { titulo: '4. Entregar kit de boas-vindas', descricao: 'Preparar e entregar kit com: Bíblia (se necessário), folheto da igreja com ministérios e horários, carta de boas-vindas do pastor, informações sobre a EBD e grupos de comunhão.', categoria: 'acolhimento', ordem: 4 },
    { titulo: '5. Designar amigo/acompanhante', descricao: 'Atribuir um membro da equipe como "amigo" responsável pelo acompanhamento pessoal. Informar ao amigo os dados de contato e perfil do novo membro. Registrar no sistema.', categoria: 'acolhimento', ordem: 5 },
  ],
  acolhimento: [
    { titulo: '1. Primeira visita ao lar', descricao: 'Agendar e realizar visita ao lar. Levar material de boas-vindas. Conversar sobre a experiência na igreja, ouvir expectativas, orar junto com a pessoa e a família.', categoria: 'visitacao', ordem: 1 },
    { titulo: '2. Acompanhar ao culto', descricao: 'Combinar de encontrar na entrada da igreja. Sentar junto durante o culto, apresentar a membros e líderes, ajudar a se sentir à vontade no ambiente.', categoria: 'acolhimento', ordem: 2 },
    { titulo: '3. Apresentação aos líderes', descricao: 'Apresentar ao pastor, diáconos e líderes de ministérios. Explicar brevemente cada ministério e como pode participar. Ouvir interesses e habilidades.', categoria: 'integracao', ordem: 3 },
    { titulo: '4. Convite para evento social', descricao: 'Convidar para próximo evento social da igreja (chá, almoço comunitário, confraternização). Acompanhar durante o evento e apresentar a outras famílias.', categoria: 'acolhimento', ordem: 4 },
    { titulo: '5. Segundo contato por WhatsApp (1 semana)', descricao: 'Enviar mensagem perguntando como está, se tem dúvidas sobre a fé, enviar devocional curto. Reforçar convite para próximo culto e atividades da semana.', categoria: 'mensagem', ordem: 5 },
    { titulo: '6. Segunda visita de acompanhamento', descricao: 'Realizar segunda visita (2-3 semanas). Conversar sobre como tem se sentido na igreja, se está se conectando com outros membros. Orar juntos.', categoria: 'visitacao', ordem: 6 },
  ],
  integracao: [
    { titulo: '1. Inscrição na EBD', descricao: 'Matricular na Escola Bíblica Dominical na classe adequada. Apresentar ao professor, informar horários e entregar material didático. Acompanhar na primeira aula.', categoria: 'integracao', ordem: 1 },
    { titulo: '2. Inclusão em grupo de comunhão/célula', descricao: 'Identificar o grupo de comunhão mais próximo da residência. Apresentar ao líder do grupo, acompanhar na primeira reunião, garantir boa recepção.', categoria: 'integracao', ordem: 2 },
    { titulo: '3. Participação nos cultos regulares', descricao: 'Acompanhar frequência nos cultos (domingo manhã, domingo noite, quarta). Verificar se está se sentindo acolhido. Sentar junto quando possível.', categoria: 'acompanhamento', ordem: 3 },
    { titulo: '4. Identificação de dons e ministérios', descricao: 'Conversar sobre dons, talentos e interesses. Apresentar os ministérios disponíveis (louvor, infantil, jovens, diaconato, etc). Auxiliar na escolha e inscrição.', categoria: 'integracao', ordem: 4 },
    { titulo: '5. Envolvimento em atividade prática', descricao: 'Convidar para participar de uma atividade prática da igreja: mutirão, ação social, apoio logístico em evento. Ajudar a criar senso de pertencimento.', categoria: 'integracao', ordem: 5 },
    { titulo: '6. Avaliação de integração (30 dias)', descricao: 'Após 30 dias, avaliar: frequência nos cultos, participação em grupo, envolvimento em ministério. Conversar com o pastor sobre o progresso.', categoria: 'acompanhamento', ordem: 6 },
  ],
  estudo_biblico: [
    { titulo: '1. Inscrição no curso de discipulado', descricao: 'Verificar turma aberta do curso de discipulado. Inscrever, informar datas, horários e local. Garantir material didático disponível. Apresentar ao facilitador.', categoria: 'integracao', ordem: 1 },
    { titulo: '2. Matrícula na classe de novos decididos', descricao: 'Matricular na classe específica de novos decididos da EBD. Acompanhar na primeira aula, apresentar aos colegas de classe e ao professor.', categoria: 'integracao', ordem: 2 },
    { titulo: '3. Participação na EBD semanal', descricao: 'Acompanhar frequência e participação na Escola Bíblica Dominical. Verificar se está compreendendo os estudos, oferecer apoio se necessário.', categoria: 'acompanhamento', ordem: 3 },
    { titulo: '4. Estudo bíblico em grupo', descricao: 'Incluir em um grupo de estudo bíblico semanal (presencial ou online). Garantir que tem Bíblia e materiais. Acompanhar evolução na compreensão bíblica.', categoria: 'integracao', ordem: 4 },
    { titulo: '5. Plano de leitura bíblica pessoal', descricao: 'Criar e compartilhar plano de leitura bíblica diária. Enviar lembretes semanais por WhatsApp. Discutir trechos lidos nos encontros.', categoria: 'mensagem', ordem: 5 },
    { titulo: '6. Avaliação de aprendizado', descricao: 'Ao final do curso/ciclo, conversar sobre o que aprendeu, dúvidas que surgiram, como está aplicando no dia a dia. Sugerir próximos passos de estudo.', categoria: 'acompanhamento', ordem: 6 },
  ],
  consolidacao: [
    { titulo: '1. Acompanhamento mensal (1o semestre)', descricao: 'Realizar encontros mensais durante o primeiro semestre. Conversar sobre crescimento espiritual, desafios na fé, participação na igreja. Orar juntos e encorajar.', categoria: 'acompanhamento', ordem: 1 },
    { titulo: '2. Preparação para batismo', descricao: 'Conversar sobre o significado do batismo, tirar dúvidas teológicas. Inscrever na classe de batismo, acompanhar nas aulas preparatórias. Auxiliar na preparação do testemunho.', categoria: 'acompanhamento', ordem: 2 },
    { titulo: '3. Cerimônia de batismo', descricao: 'Acompanhar no dia do batismo. Apoiar nos preparativos, convidar familiares, registrar o momento. Celebrar com a comunidade da igreja.', categoria: 'acolhimento', ordem: 3 },
    { titulo: '4. Carta de transferência (se aplicável)', descricao: 'Para membros vindos de outra igreja: auxiliar no processo de carta de transferência. Acompanhar a documentação, apresentar à liderança, formalizar a membresia.', categoria: 'outro', ordem: 4 },
    { titulo: '5. Acompanhamento trimestral (2o ano)', descricao: 'Após o primeiro ano, realizar encontros trimestrais. Avaliar maturidade espiritual, envolvimento nos ministérios, relacionamentos na comunidade.', categoria: 'acompanhamento', ordem: 5 },
    { titulo: '6. Apoio pastoral em crises', descricao: 'Estar atento a dificuldades pessoais, familiares ou espirituais. Encaminhar para aconselhamento pastoral quando necessário. Manter canal de comunicação aberto.', categoria: 'acompanhamento', ordem: 6 },
    { titulo: '7. Avaliação para membresia plena', descricao: 'Após período de consolidação (1-2 anos), avaliar com a liderança: fidelidade, participação, frutos espirituais. Encaminhar para reconhecimento como membro pleno.', categoria: 'acompanhamento', ordem: 7 },
  ],
  membro_pleno: [
    { titulo: '1. Capacitação para liderança', descricao: 'Identificar potencial de liderança. Inscrever em cursos de capacitação: liderança de célula, escola de líderes, treinamento ministerial. Mentorar com líder experiente.', categoria: 'integracao', ordem: 1 },
    { titulo: '2. Assumir função no ministério', descricao: 'Auxiliar na transição para função ativa: líder de célula, professor de EBD, diácono, equipe de louvor, ministério infantil, etc. Acompanhar nos primeiros meses.', categoria: 'integracao', ordem: 2 },
    { titulo: '3. Treinamento de obreiro/diácono', descricao: 'Para candidatos a obreiro: participar do curso de diaconato, acompanhar diácono experiente, aprender rotinas (santa ceia, recepção, apoio logístico).', categoria: 'integracao', ordem: 3 },
    { titulo: '4. Preparação da Santa Ceia', descricao: 'Auxiliar na organização da Santa Ceia: compra de insumos (pão, suco/vinho), preparação da mesa, distribuição dos elementos, limpeza após o culto.', categoria: 'outro', ordem: 4 },
    { titulo: '5. Mentoria de novos membros', descricao: 'Atribuir novos decididos/visitantes para acompanhar como "amigo". Aplicar a experiência adquirida para acolher e discipular novos na fé.', categoria: 'acompanhamento', ordem: 5 },
    { titulo: '6. Participação em missões e ações sociais', descricao: 'Envolver em projetos missionários e ações sociais da igreja: evangelismo, visitas a hospitais/asilos, distribuição de cestas, campanhas de arrecadação.', categoria: 'outro', ordem: 6 },
    { titulo: '7. Avaliação anual de crescimento', descricao: 'Reunião anual com a liderança para avaliar frutos do ministério, satisfação pessoal, desafios enfrentados, necessidades de capacitação e próximos passos.', categoria: 'acompanhamento', ordem: 7 },
  ],
};

// Compatibilidade: atividades padrão para grupos sem etapa definida
const ATIVIDADES_SUGERIDAS = ATIVIDADES_POR_ETAPA.triagem;

const initAtividades = async (req, res) => {
  try {
    const grupo = await TriagemGrupo.findById(req.params.id);
    if (!grupo) return res.status(404).json({ message: 'Grupo não encontrado' });

    if (grupo.atividades && grupo.atividades.length > 0) {
      return res.status(400).json({ message: 'Grupo já possui atividades. Use os endpoints individuais para gerenciar.' });
    }

    const template = ATIVIDADES_POR_ETAPA[grupo.etapa] || ATIVIDADES_SUGERIDAS;
    grupo.atividades = template.map((a) => ({ ...a }));
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

    // User role: must be a member of the group
    if (req.user.role === 'user') {
      const isMember = grupo.membros.some((m) => String(m.membro_id) === String(req.user.personId));
      if (!isMember) return res.status(403).json({ message: 'Acesso negado' });
    }

    const atividade = grupo.atividades.id(req.params.atividadeId);
    if (!atividade) return res.status(404).json({ message: 'Atividade não encontrada' });

    const { responsavel_id, responsavel_nome, concluida, titulo, descricao, prazo, observacao } = req.body;

    // User role: only allowed to update concluida and observacao
    if (req.user.role === 'user') {
      if (concluida !== undefined) {
        atividade.concluida = concluida;
        atividade.concluida_em = concluida ? new Date() : null;
      }
      if (observacao !== undefined) atividade.observacao = observacao;
    } else {
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
    }

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
