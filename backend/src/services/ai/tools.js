const mongoose = require('mongoose');
const Person = require('../../models/Person.model');
const User = require('../../models/User.model');
const EbdAula = require('../../models/EbdAula.model');
const CareAlert = require('../../models/CareAlert.model');
const Message = require('../../models/Message.model');
const whatsapp = require('../whatsapp.service');
const ebd = require('../ebd.service');
const engagement = require('../engagement.service');
const encontrosSvc = require('../encontro.service');
const GrupoEncontro = require('../../models/GrupoEncontro.model');
const Encontro = require('../../models/Encontro.model');
const { ATIVIDADES } = Encontro;
const { notifyLeadership, classLeaders } = require('../leadership.service');
const { registrarComunicacao, triggerVisitanteWhatsApp, triggerNovoDecididoWhatsApp } = require('../trigger.service');
const templates = require('../../templates/messages.templates');
const { buildDuplicateQuery } = require('../../controllers/person.controller');
const { normalizeName, determineGroup, calculateAge } = require('../../utils/person-rules');
const { escapeRegex } = require('../../utils/sanitize');
const { toLocal } = require('../../utils/phone');
const { lastSundayIso, dayRangeFromIso, formatBr, zonedParts, addDaysIso } = require('../../utils/time');
const { limitFor } = require('../../config/plans');
const { getTenant, runWithTenant } = require('../../tenancy/context');
const { timezone } = require('../../tenancy/brand');
const prayer = require('../prayer.service');

// ── helpers ──────────────────────────────────────────────────────────────
// Sem congregação definida só fica sem filtro quem tem escopo total (master, liderança geral).
// Lista vazia de congregações = nenhum acesso (falha fechado).
const scopeFilter = (actor, filter = {}) => {
  if (actor.congregacao) return { ...filter, congregacao: actor.congregacao };
  if (Array.isArray(actor.congregacoes)) return { ...filter, congregacao: { $in: actor.congregacoes } };
  return filter;
};

// Congregações em que o líder pode gravar (null = todas da igreja).
const writableCongregacoes = (actor) => {
  if (actor.congregacao) return [actor.congregacao];
  if (Array.isArray(actor.congregacoes)) return actor.congregacoes;
  return null;
};

const toolError = (message) => {
  const err = new Error(message);
  err.toolError = true;
  return err;
};

const resolveCongregacao = (actor, input) => {
  const tenant = getTenant();
  const lista = Array.isArray(actor.congregacoes) ? actor.congregacoes : tenant?.congregacoes || [];
  if (actor.congregacao) return actor.congregacao;
  if (input) {
    const hit = lista.find((c) => ebd.normalize(c) === ebd.normalize(input));
    if (hit) return hit;
    throw toolError(`Congregação "${input}" não encontrada. Opções: ${lista.join(', ')}`);
  }
  const doLider = [...new Set((actor.classes || []).map((c) => c.congregacao))];
  if (doLider.length === 1) return doLider[0];
  if (lista.length === 1) return lista[0];
  throw toolError(`Informe a congregação. Opções: ${lista.join(', ')}`);
};

const resolveClasseFor = (actor, input) => {
  const classe = ebd.resolveClasse(input);
  if (classe) return classe;
  const doLider = [...new Set((actor.classes || []).map((c) => c.classe))];
  if (!input && doLider.length === 1) return doLider[0];
  throw toolError(`Informe a classe da EBD. Opções: ${ebd.CLASSES.join(', ')}`);
};

const resolveSunday = (input) => {
  if (!input) return lastSundayIso(timezone());
  const iso = String(input).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw toolError('Data deve estar no formato AAAA-MM-DD');
  if (new Date(`${iso}T12:00:00Z`).getUTCDay() !== 0) throw toolError(`${iso} não é um domingo. Aulas da EBD só aos domingos.`);
  return iso;
};

const sortedRoster = (aula) => [...aula.presencas]
  .filter((p) => p.personId)
  .sort((a, b) => ebd.normalize(a.nome).localeCompare(ebd.normalize(b.nome)))
  .map((p) => ({ _id: p.personId, nome: p.nome }));

const personSummary = (p) => ({
  id: String(p._id),
  nome: p.nome,
  tipo: p.tipo,
  grupo: p.grupo,
  congregacao: p.congregacao,
  celular: p.celular || null,
  idade: calculateAge(p.dataNascimento),
  status: p.status,
});

// (71) 98876-5330 · 10 dígitos com 6-9 após o DDD provavelmente é celular sem o 9.
const formatPhone = (v) => {
  const d = toLocal(v);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d || null;
};
const phoneWarning = (v) => {
  const d = toLocal(v);
  if (!d) return null;
  if (d.length === 10 && /[6-9]/.test(d[2])) return `O número ${formatPhone(d)} tem 10 dígitos: celular normalmente tem o 9 na frente (ex.: (${d.slice(0, 2)}) 9${d.slice(2, 6)}-${d.slice(6)}). Confirme com a pessoa.`;
  if (d.length < 10 || d.length > 11) return `O número "${v}" parece incompleto. Confirme com DDD.`;
  return null;
};

// Ficha completa de uma pessoa (pesquisa pelo menu ou pelo agente).
const buildFicha = async (p) => {
  const grupos = await GrupoEncontro.find({ ativo: true, 'membros.personId': p._id }).select('nome').lean();
  return {
    id: String(p._id),
    nome: p.nome,
    status: p.status === 'inativo' ? `Inativo${p.motivoInativacao ? ` (${p.motivoInativacao})` : ''}` : 'Ativo',
    tipo: p.tipo,
    congregacao: p.congregacao,
    idade: calculateAge(p.dataNascimento),
    nascimento: p.dataNascimento ? formatBr(p.dataNascimento) : null,
    sexo: p.sexo,
    grupo: p.grupo,
    estadoCivil: p.estadoCivil,
    batizado: Boolean(p.batizado),
    dataBatismo: p.dataBatismo ? formatBr(p.dataBatismo) : null,
    grupos: grupos.map((g) => g.nome),
    ministerio: p.ministerio,
    celular: p.celular ? formatPhone(p.celular) : null,
    email: p.email,
    endereco: p.endereco,
    foto: Boolean(p.fotoUrl),
  };
};

// Envia a foto do cadastro ao líder (só no WhatsApp). Falha de envio não impede a ficha.
const sendFotoToActor = async (person, actor, channel) => {
  if (channel !== 'whatsapp' || !person.fotoUrl || !actor.telefone) return false;
  try {
    await whatsapp.sendImage(actor.telefone, person.fotoUrl, '');
    return true;
  } catch (err) {
    console.warn('[AGENTE] Falha ao enviar foto da pessoa:', err.message);
    return false;
  }
};

// Processa ausências em segundo plano, preservando o contexto do tenant.
const processAulaInBackground = (aulaId) => {
  const tenant = getTenant();
  setImmediate(() => runWithTenant(tenant, () => engagement.processAula(aulaId))
    .catch((err) => console.error('[AGENTE] Falha ao processar ausências:', err.message)));
};

// ── Grupos (uniões/encontros) pelo WhatsApp ────────────────────────────────
const isGestor = (actor) => ['master', 'admin'].includes(actor.role);

// Grupos que o líder pode ver: admin/master pelas congregações; líder de união só os seus.
const gruposAcessiveis = async (actor) => {
  const filter = scopeFilter(actor, { ativo: true, tipo: { $ne: 'ebd' } });
  // Líder de união/classe vê só os próprios grupos (nenhum, se não lidera grupo); liderança geral vê o escopo todo
  if (!isGestor(actor) && !actor.liderancaGeral) filter._id = { $in: (actor.grupos || []).map((g) => g.id) };
  return GrupoEncontro.find(filter).sort({ congregacao: 1, nome: 1 });
};

// Grupo acessível ao líder: admin/master pelas congregações; líder de união só os seus.
const findGrupoFor = async (actor, ref) => {
  const candidatos = await gruposAcessiveis(actor);
  const r = ebd.normalize(ref || '');
  const grupo = candidatos.find((g) => String(g._id) === String(ref))
    || candidatos.find((g) => ebd.normalize(g.nome) === r)
    || (r ? candidatos.find((g) => ebd.normalize(g.nome).includes(r)) : null)
    || (candidatos.length === 1 ? candidatos[0] : null);
  if (!grupo) throw toolError(`Qual grupo? Opções: ${candidatos.map((g) => `${g.nome} (${g.congregacao})`).join(', ') || 'nenhum grupo disponível para você'}`);
  return grupo;
};

const DIAS_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const diaFromText = (v) => {
  if (v === undefined || v === null || v === '') return undefined;
  if (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 6) return Number(v);
  const i = DIAS_PT.findIndex((d) => ebd.normalize(v).startsWith(ebd.normalize(d).slice(0, 3)));
  return i >= 0 ? i : undefined;
};

// ── definições + handlers ────────────────────────────────────────────────
const TOOLS = {
  buscar_pessoas: {
    roles: ['lider'],
    definition: {
      name: 'buscar_pessoas',
      description: 'Busca pessoas cadastradas na igreja pelo nome (parcial). Use antes de agir sobre alguém para obter o id.',
      input_schema: {
        type: 'object',
        properties: { termo: { type: 'string', description: 'Parte do nome' } },
        required: ['termo'],
      },
    },
    run: async ({ termo }, { actor }) => {
      const pessoas = await Person.find(scopeFilter(actor, { nome: new RegExp(escapeRegex(termo), 'i') }))
        .select('nome tipo grupo congregacao celular dataNascimento status').limit(10).lean();
      return { total: pessoas.length, pessoas: pessoas.map(personSummary) };
    },
  },

  ficha_pessoa: {
    roles: ['lider'],
    definition: {
      name: 'ficha_pessoa',
      description: 'Ficha completa de UMA pessoa (status, congregação, idade, batismo, grupos, WhatsApp, endereço) e envia a foto do cadastro. Use depois de buscar_pessoas quando houver uma pessoa só ou o líder escolher uma. Mostre o campo "texto" EXATAMENTE como veio.',
      input_schema: { type: 'object', properties: { pessoaId: { type: 'string' } }, required: ['pessoaId'] },
    },
    run: async ({ pessoaId }, { actor, conversation, channel }) => {
      const person = await Person.findOne(scopeFilter(actor, { _id: pessoaId })).lean();
      if (!person) throw toolError('Pessoa não encontrada nas suas congregações');
      const ficha = await buildFicha(person);
      const fotoEnviada = await sendFotoToActor(person, actor, channel);
      if (conversation) conversation.state = { tipo: 'ficha', pessoaId: ficha.id, nome: ficha.nome };
      return { texto: templates.fichaPessoa(ficha), fotoEnviada };
    },
  },

  cadastrar_pessoa: {
    roles: ['lider'],
    definition: {
      name: 'cadastrar_pessoa',
      description: 'Cadastra uma nova pessoa (visitante, novo decidido ou congregado). Dispara as boas-vindas automáticas por WhatsApp para o celular da pessoa. Chame primeiro com confirmado=false: a ferramenta devolve "mensagemParaLider" (mostre exatamente) para o líder conferir os dados e o número do WhatsApp; só depois do "sim" chame de novo com confirmado=true.',
      input_schema: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'Nome completo' },
          tipo: { type: 'string', enum: ['visitante', 'novo decidido', 'congregado'], description: 'Padrão: visitante' },
          sexo: { type: 'string', enum: ['Masculino', 'Feminino'] },
          idade: { type: 'integer', description: 'Use quando não houver data de nascimento' },
          dataNascimento: { type: 'string', description: 'AAAA-MM-DD' },
          celular: { type: 'string', description: 'Com DDD' },
          email: { type: 'string' },
          endereco: { type: 'string' },
          congregacao: { type: 'string' },
          confirmado: { type: 'boolean', description: 'true somente depois que o líder conferiu os dados e o número' },
        },
        required: ['nome', 'confirmado'],
      },
    },
    run: async (input, { actor }) => {
      const tenant = getTenant();
      const maxPessoas = limitFor(tenant, 'pessoas');
      if (maxPessoas && await Person.countDocuments({ status: 'ativo' }) >= maxPessoas) {
        throw toolError(`Limite de ${maxPessoas} pessoas do plano atingido.`);
      }
      const payload = {
        nome: normalizeName(input.nome),
        tipo: input.tipo || 'visitante',
        sexo: input.sexo,
        celular: input.celular ? toLocal(input.celular) : undefined,
        email: input.email,
        endereco: input.endereco,
        congregacao: resolveCongregacao(actor, input.congregacao),
        status: 'ativo',
      };
      if (input.dataNascimento) payload.dataNascimento = new Date(`${input.dataNascimento}T12:00:00Z`);
      else if (Number.isInteger(input.idade)) payload.grupo = determineGroup(input.idade);
      if (payload.tipo === 'visitante') payload.dataVisita = new Date();
      if (payload.tipo === 'novo decidido') payload.dataDecisao = new Date();
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

      const dup = buildDuplicateQuery(payload);
      if (dup) {
        const existing = await Person.findOne(dup).lean();
        if (existing) return { duplicado: true, mensagem: 'Já existe um cadastro semelhante.', pessoa: personSummary(existing) };
      }
      const alertaCelular = phoneWarning(input.celular);
      if (!input.confirmado) {
        return {
          criado: false,
          mensagemParaLider: templates.cadastroConfirmar({
            nome: payload.nome, tipo: payload.tipo, sexo: payload.sexo, congregacao: payload.congregacao,
            nascimento: input.dataNascimento ? formatBr(payload.dataNascimento) : (Number.isInteger(input.idade) ? `${input.idade} anos` : null),
            celular: payload.celular ? formatPhone(payload.celular) : null, alertaCelular,
          }),
        };
      }
      const person = await Person.create(payload);
      if (person.tipo === 'visitante') triggerVisitanteWhatsApp(person, actor.userId);
      if (person.tipo === 'novo decidido') triggerNovoDecididoWhatsApp(person, actor.userId);
      return {
        criado: true,
        pessoa: personSummary(person),
        boasVindas: person.celular && ['visitante', 'novo decidido'].includes(person.tipo)
          ? `Mensagem de boas-vindas enviada para o WhatsApp da pessoa: ${formatPhone(person.celular)}. A liderança (triagem/Projeto Amigo) também é avisada.`
          : 'Sem celular: nenhuma mensagem de boas-vindas foi enviada.',
        modoTeste: process.env.FORCE_MOCK_RECIPIENT === 'true' ? 'Ambiente de teste: as mensagens estão sendo redirecionadas para o número de teste, não para a pessoa.' : undefined,
        observacao: payload.grupo ? `Grupo definido pela idade: ${payload.grupo}` : undefined,
      };
    },
  },

  editar_pessoa: {
    roles: ['lider'],
    definition: {
      name: 'editar_pessoa',
      description: 'Atualiza dados cadastrais de uma pessoa (use buscar_pessoas antes para obter o id). Mostre ao líder o que vai mudar e só chame com confirmado=true depois do "sim". Para inativar, informe status "inativo" e motivoInativacao. Para trocar a foto, use usarUltimaFoto=true (a última imagem enviada pelo líder nesta conversa).',
      input_schema: {
        type: 'object',
        properties: {
          pessoaId: { type: 'string' },
          confirmado: { type: 'boolean', description: 'true somente após aprovação explícita do líder' },
          nome: { type: 'string' },
          celular: { type: 'string' },
          email: { type: 'string' },
          endereco: { type: 'string' },
          dataNascimento: { type: 'string', description: 'AAAA-MM-DD' },
          sexo: { type: 'string', enum: ['Masculino', 'Feminino'] },
          tipo: { type: 'string', enum: ['membro', 'congregado', 'visitante', 'novo decidido', 'criança'] },
          estadoCivil: { type: 'string', enum: ['solteiro(a)', 'casado(a)', 'divorciado(a)', 'viúvo(a)', 'separado(a)', 'união estável'] },
          grupo: { type: 'string', enum: ['criança', 'adolescente', 'jovem', 'adulto 1', 'adulto 2', 'idoso', 'ancião'] },
          congregacao: { type: 'string' },
          ministerio: { type: 'string' },
          status: { type: 'string', enum: ['ativo', 'inativo'] },
          motivoInativacao: { type: 'string', enum: ['falecimento', 'desvio doutrinário', 'mudança de endereço', 'desconhecido', 'outro'] },
          usarUltimaFoto: { type: 'boolean', description: 'Atualiza a foto do cadastro com a última imagem recebida' },
        },
        required: ['pessoaId', 'confirmado'],
      },
    },
    run: async ({ pessoaId, confirmado, usarUltimaFoto, ...campos }, { actor, conversation }) => {
      if (!mongoose.isValidObjectId(pessoaId)) throw toolError('Pessoa não encontrada nas suas congregações');
      const person = await Person.findOne(scopeFilter(actor, { _id: pessoaId })).lean();
      if (!person) throw toolError('Pessoa não encontrada nas suas congregações');
      const set = {};
      const permitidos = ['nome', 'celular', 'email', 'endereco', 'dataNascimento', 'sexo', 'tipo', 'estadoCivil', 'grupo', 'congregacao', 'ministerio', 'status', 'motivoInativacao'];
      permitidos.forEach((k) => { if (campos[k] !== undefined && campos[k] !== '' && typeof campos[k] !== 'object') set[k] = campos[k]; });
      // O celular é a identidade no WhatsApp: celular/status de quem tem conta master/admin só o master altera
      if (actor.role !== 'master' && (set.celular || set.status) && String(person._id) !== String(actor.personId)) {
        const lider = await User.exists({ personId: person._id, role: { $in: ['master', 'admin'] } });
        if (lider) throw toolError('Celular e status de administradores só podem ser alterados pelo master, na plataforma.');
      }
      // Batizado ⇒ membro (regra 5) sobre o estado final, não só o que veio no pedido
      if (person.batizado && set.tipo && set.tipo !== 'membro') set.tipo = 'membro';
      if (usarUltimaFoto) {
        if (!conversation?.lastMediaDataUrl) throw toolError('Nenhuma foto recebida nesta conversa. Peça ao líder para enviar a foto.');
        set.fotoUrl = conversation.lastMediaDataUrl;
      }
      if (!Object.keys(set).length) throw toolError('Nenhum campo para alterar');
      if (set.nome) set.nome = normalizeName(set.nome);
      if (set.celular) set.celular = toLocal(set.celular);
      if (set.email) set.email = String(set.email).toLowerCase();
      if (set.dataNascimento) set.dataNascimento = new Date(`${String(set.dataNascimento).slice(0, 10)}T12:00:00Z`);
      if (set.congregacao) {
        // Só para congregações dentro do escopo do líder
        const permitidas = writableCongregacoes(actor);
        set.congregacao = resolveCongregacao({ ...actor, congregacao: null, ...(permitidas ? { congregacoes: permitidas } : {}) }, set.congregacao);
      }
      if (set.status === 'inativo' && !set.motivoInativacao && !person.motivoInativacao) throw toolError('Informe o motivo da inativação');
      const antes = Object.fromEntries(Object.keys(set).map((k) => [k, k === 'fotoUrl' ? (person.fotoUrl ? 'foto atual' : 'sem foto') : person[k] ?? null]));
      const alertaCelular = set.celular ? phoneWarning(set.celular) : null;
      if (set.fotoUrl && !confirmado) return { salvo: false, mensagem: 'Confirme com o líder antes de salvar.', alteracoes: { antes, depois: { ...set, fotoUrl: 'nova foto enviada' } }, alertaCelular };
      if (!confirmado) return { salvo: false, mensagem: 'Confirme com o líder antes de salvar.', alteracoes: { antes, depois: set }, alertaCelular };
      const updated = await Person.findOneAndUpdate({ _id: person._id }, { $set: set }, { new: true, runValidators: true }).lean();
      return { salvo: true, pessoa: personSummary(updated), alterados: Object.keys(set).map((k) => (k === 'fotoUrl' ? 'foto' : k)) };
    },
  },

  listar_grupos_encontro: {
    roles: ['lider'],
    definition: {
      name: 'listar_grupos_encontro',
      description: 'Lista os grupos que se reúnem (União Feminina, União Masculina, louvor…) com dia, horário, número de membros e líderes.',
      input_schema: { type: 'object', properties: { congregacao: { type: 'string' } } },
    },
    run: async ({ congregacao }, { actor }) => {
      const filter = scopeFilter(actor, { ativo: true, tipo: { $ne: 'ebd' } });
      if (congregacao) filter.congregacao = resolveCongregacao(actor, congregacao);
      const grupos = await GrupoEncontro.find(filter).select('nome congregacao diaSemana horario membros lideres').lean();
      const dias = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
      return {
        grupos: grupos.map((g) => ({
          id: String(g._id), nome: g.nome, congregacao: g.congregacao, dia: dias[g.diaSemana], horario: g.horario,
          membros: g.membros.length, lideres: g.lideres.map((l) => l.nome).join(', '),
        })),
      };
    },
  },

  registrar_chamada_encontro: {
    roles: ['lider'],
    definition: {
      name: 'registrar_chamada_encontro',
      description: 'Registra a frequência de um encontro de grupo (união feminina/masculina, louvor…). Cria o encontro se não existir (qualquer dia da semana). Aceita nomes ou números da lista. Nomes ambíguos: nada é salvo e as opções voltam.',
      input_schema: {
        type: 'object',
        properties: {
          grupo: { type: 'string', description: 'Nome ou id do grupo' },
          data: { type: 'string', description: 'AAAA-MM-DD. Padrão: hoje' },
          atividade: { type: 'string', enum: ATIVIDADES },
          tema: { type: 'string' },
          pessoas: { type: 'array', items: { type: 'string' } },
          modo: { type: 'string', enum: ['lista_de_presentes', 'lista_de_ausentes', 'adicionar_presentes'] },
        },
        required: ['pessoas', 'modo'],
      },
    },
    run: async (input, { actor, conversation }) => {
      const st = conversation?.state?.tipo === 'chamada_encontro' ? conversation.state : null;
      const grupo = await findGrupoFor(actor, input.grupo || st?.grupoId);
      const isoDate = String(input.data || st?.data || zonedParts(timezone()).isoDate).slice(0, 10);
      const grupoDoc = await GrupoEncontro.findById(grupo._id);
      const { encontro, criado } = await encontrosSvc.findOrCreateEncontro({
        grupo: grupoDoc, isoDate, atividade: input.atividade || st?.atividade || 'reuniao', tema: input.tema || st?.tema, userId: actor.userId, origem: 'whatsapp',
      });
      if (!ebd.canEditAula(encontro, actor.role)) throw toolError('Chamada bloqueada: passou de 7 dias.');

      let roster = encontrosSvc.sortedMembers(grupoDoc);
      if (st?.rosterIds?.length) {
        // Inclui quem já está no encontro sem ser membro (ex.: visitante), para a correção da chamada.
        const byId = new Map([...encontro.presencas.map((p) => [String(p.personId), { _id: p.personId, nome: p.nome }]), ...roster.map((r) => [String(r._id), r])]);
        roster = st.rosterIds.map((id) => byId.get(String(id))).filter(Boolean);
      }
      const { encontrados, naoEncontrados, ambiguos } = ebd.matchNames(input.pessoas || [], roster);
      if (ambiguos.length) return { salvo: false, ambiguos, mensagem: 'Pergunte ao líder qual pessoa ele quis dizer.' };
      const ids = new Set(encontrados.map((e) => String(e._id)));
      encontro.presencas.forEach((p) => {
        const hit = ids.has(String(p.personId));
        if (input.modo === 'lista_de_presentes') p.presente = hit;
        else if (input.modo === 'lista_de_ausentes') p.presente = !hit;
        else if (hit) p.presente = true;
      });
      if (input.tema) encontro.tema = input.tema;
      encontro.origem = 'whatsapp';
      encontro.ausenciasProcessadasEm = undefined;
      await encontro.save();
      if (st) conversation.state = null;
      const tenant = getTenant();
      setImmediate(() => runWithTenant(tenant, () => engagement.processEncontro(encontro._id))
        .catch((err) => console.error('[AGENTE] Falha ao processar encontro:', err.message)));
      return {
        salvo: true, encontroCriado: criado, grupo: grupo.nome, data: formatBr(encontro.data), atividade: encontro.atividade,
        presentes: encontro.presencas.filter((p) => p.presente).length, total: encontro.presencas.length,
        ausentes: encontro.presencas.filter((p) => !p.presente).map((p) => p.nome), naoEncontrados,
      };
    },
  },

  iniciar_chamada_ebd: {
    roles: ['lider'],
    definition: {
      name: 'iniciar_chamada_ebd',
      description: 'Inicia a chamada da EBD pelo WhatsApp: devolve a lista numerada da classe e deixa a conversa pronta para o líder responder com números ("1 3 5"), nomes ou áudio. Mostre a lista ao líder exatamente como numerada.',
      input_schema: {
        type: 'object',
        properties: { classe: { type: 'string' }, congregacao: { type: 'string' }, data: { type: 'string', description: 'AAAA-MM-DD (domingo). Padrão: domingo mais recente' } },
      },
    },
    run: async ({ classe, congregacao, data }, { actor, conversation }) => {
      const c = resolveClasseFor(actor, classe);
      const cong = resolveCongregacao(actor, congregacao);
      const isoDate = resolveSunday(data);
      const roster = (await ebd.getRoster(c, cong)).sort((a, b) => ebd.normalize(a.nome).localeCompare(ebd.normalize(b.nome)));
      if (!roster.length) throw toolError(`Nenhum aluno ativo em ${c} (${cong}).`);
      if (conversation) {
        conversation.state = { tipo: 'chamada', classe: c, congregacao: cong, data: isoDate, rosterIds: roster.map((p) => String(p._id)), rosterNomes: roster.map((p) => p.nome) };
      }
      return { classe: c, congregacao: cong, data: formatBr(new Date(`${isoDate}T12:00:00Z`)), lista: roster.map((p, i) => `${i + 1}. ${p.nome}`), instrucao: 'Peça ao líder os números ou nomes de quem veio.' };
    },
  },

  iniciar_chamada_encontro: {
    roles: ['lider'],
    definition: {
      name: 'iniciar_chamada_encontro',
      description: 'Inicia a chamada de um encontro de grupo (união feminina/masculina, louvor…): devolve a lista numerada de membros e deixa a conversa pronta para o líder responder com números, nomes ou áudio.',
      input_schema: {
        type: 'object',
        properties: { grupo: { type: 'string' }, data: { type: 'string', description: 'AAAA-MM-DD. Padrão: hoje' }, atividade: { type: 'string', enum: ATIVIDADES.filter((a) => a !== 'aula_ebd') }, tema: { type: 'string' } },
      },
    },
    run: async ({ grupo: ref, data, atividade, tema }, { actor, conversation }) => {
      const grupo = await findGrupoFor(actor, ref);
      const roster = encontrosSvc.sortedMembers(grupo);
      if (!roster.length) throw toolError(`O grupo ${grupo.nome} ainda não tem membros.`);
      const isoDate = String(data || zonedParts(timezone()).isoDate).slice(0, 10);
      if (conversation) {
        conversation.state = {
          tipo: 'chamada_encontro', grupoId: String(grupo._id), grupoNome: grupo.nome, data: isoDate, atividade, tema,
          rosterIds: roster.map((p) => String(p._id)), rosterNomes: roster.map((p) => p.nome),
        };
      }
      return { grupo: grupo.nome, data: formatBr(new Date(`${isoDate}T12:00:00Z`)), lista: roster.map((p, i) => `${i + 1}. ${p.nome}`), instrucao: 'Peça ao líder os números ou nomes de quem veio.' };
    },
  },

  ver_membros_grupo: {
    roles: ['lider'],
    definition: {
      name: 'ver_membros_grupo',
      description: 'Mostra os dados de um grupo (dia, horário, líderes) e a lista numerada de membros.',
      input_schema: { type: 'object', properties: { grupo: { type: 'string' } } },
    },
    run: async ({ grupo: ref }, { actor }) => {
      const grupo = await findGrupoFor(actor, ref);
      const membros = encontrosSvc.sortedMembers(grupo);
      return {
        id: String(grupo._id), grupo: grupo.nome, congregacao: grupo.congregacao,
        dia: DIAS_PT[grupo.diaSemana], horario: grupo.horario, local: grupo.local || null,
        lideres: grupo.lideres.map((l) => `${l.nome}${l.papel ? ` (${l.papel})` : ''}`),
        totalMembros: membros.length,
        membros: membros.map((m, i) => `${i + 1}. ${m.nome}`),
      };
    },
  },

  adicionar_membro_grupo: {
    roles: ['lider'],
    channels: ['web'], // pelo WhatsApp: plataforma web
    definition: {
      name: 'adicionar_membro_grupo',
      description: 'Adiciona uma pessoa já cadastrada (use buscar_pessoas para obter o id) a um grupo. Se a pessoa não existir, cadastre antes com cadastrar_pessoa.',
      input_schema: { type: 'object', properties: { grupo: { type: 'string' }, pessoaId: { type: 'string' } }, required: ['pessoaId'] },
    },
    run: async ({ grupo: ref, pessoaId }, { actor }) => {
      const grupo = await findGrupoFor(actor, ref);
      const person = await Person.findOne(scopeFilter(actor, { _id: pessoaId })).select('nome celular').lean();
      if (!person) throw toolError('Pessoa não encontrada nas suas congregações.');
      if (grupo.membros.some((m) => String(m.personId) === String(person._id))) return { ok: true, mensagem: `${person.nome} já está no grupo.` };
      grupo.membros.push({ personId: person._id, nome: person.nome, celular: person.celular });
      await grupo.save();
      return { ok: true, grupo: grupo.nome, adicionado: person.nome, totalMembros: grupo.membros.length };
    },
  },

  remover_membro_grupo: {
    roles: ['lider'],
    channels: ['web'], // pelo WhatsApp: plataforma web
    definition: {
      name: 'remover_membro_grupo',
      description: 'Remove uma pessoa de um grupo. Confirme com o líder antes (confirmado=true só depois do "sim").',
      input_schema: {
        type: 'object',
        properties: { grupo: { type: 'string' }, pessoa: { type: 'string', description: 'Nome, número da lista ou id' }, confirmado: { type: 'boolean' } },
        required: ['pessoa', 'confirmado'],
      },
    },
    run: async ({ grupo: ref, pessoa, confirmado }, { actor }) => {
      const grupo = await findGrupoFor(actor, ref);
      const roster = encontrosSvc.sortedMembers(grupo);
      const byId = roster.find((m) => String(m._id) === String(pessoa));
      const { encontrados, ambiguos } = byId ? { encontrados: [byId], ambiguos: [] } : ebd.matchNames([pessoa], roster);
      if (ambiguos.length) return { ok: false, ambiguos };
      if (!encontrados.length) throw toolError(`${pessoa} não está no grupo ${grupo.nome}.`);
      const alvo = encontrados[0];
      if (!confirmado) return { ok: false, confirmar: `Remover ${alvo.nome} do grupo ${grupo.nome}?` };
      grupo.membros = grupo.membros.filter((m) => String(m.personId) !== String(alvo._id));
      await grupo.save();
      return { ok: true, removido: alvo.nome, grupo: grupo.nome, totalMembros: grupo.membros.length };
    },
  },

  criar_grupo_encontro: {
    roles: ['lider'],
    channels: ['web'], // pelo WhatsApp: orientar a usar a plataforma web
    definition: {
      name: 'criar_grupo_encontro',
      description: 'Cria um grupo que se reúne (ex.: União Feminina). Membros entram automaticamente pelos critérios (sexo/idade). Quem pediu vira líder do grupo. Confirme os dados antes (confirmado=true).',
      input_schema: {
        type: 'object',
        properties: {
          nome: { type: 'string' },
          congregacao: { type: 'string' },
          diaSemana: { type: 'string', description: 'domingo…sábado' },
          horario: { type: 'string', description: 'HH:MM' },
          local: { type: 'string' },
          sexo: { type: 'string', enum: ['Masculino', 'Feminino'] },
          idadeMin: { type: 'integer' },
          idadeMax: { type: 'integer' },
          pedirChamada: { type: 'boolean', description: 'Pedir a chamada aos líderes no WhatsApp após o encontro' },
          confirmado: { type: 'boolean' },
        },
        required: ['nome', 'confirmado'],
      },
    },
    run: async (input, { actor }) => {
      const congregacao = resolveCongregacao(actor, input.congregacao);
      const dados = {
        nome: String(input.nome).trim(), congregacao, diaSemana: diaFromText(input.diaSemana) ?? 3, horario: input.horario || '19:30', local: input.local,
        criterios: { sexo: input.sexo || null, idadeMin: input.idadeMin, idadeMax: input.idadeMax },
        convocarChamada: input.pedirChamada !== false,
      };
      if (!input.confirmado) return { criado: false, confirmar: { ...dados, dia: DIAS_PT[dados.diaSemana] } };
      if (await GrupoEncontro.exists({ nome: dados.nome, congregacao })) throw toolError('Já existe um grupo com esse nome nesta congregação.');
      const grupo = new GrupoEncontro({
        ...dados,
        lideres: actor.telefone ? [{ personId: actor.personId, nome: actor.nome, celular: toLocal(actor.telefone), papel: 'Líder' }] : [],
        criadoPor: actor.userId,
      });
      await grupo.save();
      const c = dados.criterios;
      const adicionados = (c.sexo || c.idadeMin || c.idadeMax) ? await encontrosSvc.syncMembers(grupo) : 0;
      if (actor.grupos) actor.grupos.push({ id: String(grupo._id), nome: grupo.nome, congregacao });
      return { criado: true, grupo: grupo.nome, congregacao, dia: DIAS_PT[grupo.diaSemana], horario: grupo.horario, membrosAdicionados: adicionados };
    },
  },

  editar_grupo_encontro: {
    roles: ['lider'],
    channels: ['web'],
    definition: {
      name: 'editar_grupo_encontro',
      description: 'Altera um grupo: nome, dia, horário, local, pedir chamada no WhatsApp, adicionar líder (id de pessoa) ou remover líder (nome). Confirme antes (confirmado=true).',
      input_schema: {
        type: 'object',
        properties: {
          grupo: { type: 'string' },
          nome: { type: 'string' },
          diaSemana: { type: 'string' },
          horario: { type: 'string' },
          local: { type: 'string' },
          pedirChamada: { type: 'boolean' },
          adicionarLiderPessoaId: { type: 'string' },
          removerLider: { type: 'string' },
          confirmado: { type: 'boolean' },
        },
        required: ['confirmado'],
      },
    },
    run: async (input, { actor }) => {
      const grupo = await findGrupoFor(actor, input.grupo);
      const mudancas = {};
      if (input.nome) mudancas.nome = input.nome.trim();
      const dia = diaFromText(input.diaSemana);
      if (dia !== undefined) mudancas.diaSemana = dia;
      if (input.horario) mudancas.horario = input.horario;
      if (input.local) mudancas.local = input.local;
      if (typeof input.pedirChamada === 'boolean') mudancas.convocarChamada = input.pedirChamada;
      let novoLider = null;
      if (input.adicionarLiderPessoaId) {
        novoLider = await Person.findOne(scopeFilter(actor, { _id: input.adicionarLiderPessoaId })).select('nome celular').lean();
        if (!novoLider) throw toolError('Pessoa não encontrada para ser líder.');
      }
      if (!Object.keys(mudancas).length && !novoLider && !input.removerLider) throw toolError('Nada para alterar.');
      if (!input.confirmado) {
        return { salvo: false, confirmar: { grupo: grupo.nome, ...mudancas, ...(novoLider ? { novoLider: novoLider.nome } : {}), ...(input.removerLider ? { removerLider: input.removerLider } : {}) } };
      }
      Object.assign(grupo, mudancas);
      if (novoLider && !grupo.lideres.some((l) => String(l.personId) === String(novoLider._id))) {
        grupo.lideres.push({ personId: novoLider._id, nome: novoLider.nome, celular: novoLider.celular, papel: 'Líder' });
      }
      if (input.removerLider) {
        const r = ebd.normalize(input.removerLider);
        grupo.lideres = grupo.lideres.filter((l) => !ebd.normalize(l.nome).includes(r));
      }
      await grupo.save();
      return { salvo: true, grupo: grupo.nome, dia: DIAS_PT[grupo.diaSemana], horario: grupo.horario, lideres: grupo.lideres.map((l) => l.nome) };
    },
  },

  enviar_aviso_grupo: {
    roles: ['lider'],
    definition: {
      name: 'enviar_aviso_grupo',
      description: 'Envia um aviso por WhatsApp para todos os membros de um grupo (ex.: "o ensaio mudou para 20h"). Mostre o texto final ao líder e só envie com confirmado=true. Use {nome} para personalizar.',
      input_schema: {
        type: 'object',
        properties: { grupo: { type: 'string' }, mensagem: { type: 'string' }, confirmado: { type: 'boolean' } },
        required: ['mensagem', 'confirmado'],
      },
    },
    run: async ({ grupo: ref, mensagem, confirmado }, { actor }) => {
      const grupo = await findGrupoFor(actor, ref);
      const destinatarios = grupo.membros.filter((m) => m.celular).map((m, i) => ({ nome: m.nome, celular: m.celular, ordem: i }));
      if (!destinatarios.length) throw toolError('Nenhum membro do grupo tem celular cadastrado.');
      if (!confirmado) return { enviado: false, confirmar: `Enviar para ${destinatarios.length} membro(s) do grupo ${grupo.nome}?`, previa: mensagem.replace(/\{nome\}/gi, destinatarios[0].nome.split(' ')[0]) };
      const texto = templates.personalizada('{nome}', mensagem);
      const log = await Message.create({
        tipo: 'aviso',
        destinatarios: destinatarios.map((d) => ({ nome: d.nome, celular: d.celular, status: 'pendente', ordem: d.ordem })),
        conteudo: texto, status: 'enviando', enviadoPor: actor.userId, origemNome: actor.nome, origemCongregacao: grupo.congregacao,
      });
      const marcar = (ordem, patch) => Message.updateOne(
        { _id: log._id },
        { $set: Object.fromEntries(Object.entries(patch).map(([k, v]) => [`destinatarios.$[d].${k}`, v])) },
        { arrayFilters: [{ 'd.ordem': ordem }] },
      );
      await whatsapp.sendBatch(destinatarios, (d) => texto.replace(/\{nome\}/gi, String(d.nome).split(' ')[0]), {
        onSuccess: (d) => marcar(d.ordem, { status: 'concluido', processadoEm: new Date() }),
        onError: (d, err) => marcar(d.ordem, { status: 'erro', processadoEm: new Date(), erro: err.message }),
      });
      return { enviando: destinatarios.length, grupo: grupo.nome, observacao: 'Envio em fila, 1 mensagem a cada 30s (proteção contra bloqueio).' };
    },
  },

  listar_turma_ebd: {
    roles: ['lider'],
    definition: {
      name: 'listar_turma_ebd',
      description: 'Lista os alunos ativos de uma classe da EBD, numerados (a numeração pode ser usada na chamada).',
      input_schema: {
        type: 'object',
        properties: { classe: { type: 'string' }, congregacao: { type: 'string' } },
      },
    },
    run: async ({ classe, congregacao }, { actor }) => {
      const c = resolveClasseFor(actor, classe);
      const cong = resolveCongregacao(actor, congregacao);
      const roster = (await ebd.getRoster(c, cong))
        .sort((a, b) => ebd.normalize(a.nome).localeCompare(ebd.normalize(b.nome)));
      return { classe: c, congregacao: cong, alunos: roster.map((p, i) => `${i + 1}. ${p.nome}`) };
    },
  },

  registrar_chamada_ebd: {
    roles: ['lider'],
    definition: {
      name: 'registrar_chamada_ebd',
      description: 'Registra a frequência de uma aula da EBD. Cria a aula se não existir. Aceita nomes ou números da lista. Se algum nome for ambíguo nada é salvo e as opções são devolvidas. Nomes não encontrados podem ser visitantes: pergunte ao líder e use cadastrar_pessoa + marcar_presenca.',
      input_schema: {
        type: 'object',
        properties: {
          classe: { type: 'string' },
          congregacao: { type: 'string' },
          data: { type: 'string', description: 'AAAA-MM-DD (domingo). Padrão: domingo mais recente' },
          pessoas: { type: 'array', items: { type: 'string' }, description: 'Nomes ou números citados pelo líder' },
          modo: {
            type: 'string',
            enum: ['lista_de_presentes', 'lista_de_ausentes', 'adicionar_presentes'],
            description: 'lista_de_presentes: só esses vieram (demais ausentes). lista_de_ausentes: só esses faltaram. adicionar_presentes: marca presentes sem mexer nos demais.',
          },
          tema: { type: 'string', description: 'Tema da lição, se informado' },
        },
        required: ['pessoas', 'modo'],
      },
    },
    run: async (input, { actor, conversation }) => {
      const classe = resolveClasseFor(actor, input.classe || conversation?.state?.classe);
      const congregacao = resolveCongregacao(actor, input.congregacao || conversation?.state?.congregacao);
      const isoDate = resolveSunday(input.data || conversation?.state?.data);
      const { aula, criada } = await ebd.findOrCreateAula({
        isoDate, classe, congregacao, userId: actor.userId, origem: 'whatsapp', tema: input.tema,
      });
      if (!ebd.canEditAula(aula, actor.role)) throw toolError('Chamada bloqueada: passou de 7 dias. Só o master pode alterar.');

      let roster = sortedRoster(aula);
      const stateIds = conversation?.state?.tipo === 'chamada' && conversation.state.classe === classe ? conversation.state.rosterIds : null;
      if (stateIds?.length) {
        const byId = new Map(roster.map((r) => [String(r._id), r]));
        roster = stateIds.map((id) => byId.get(String(id))).filter(Boolean);
      }
      const { encontrados, naoEncontrados, ambiguos } = ebd.matchNames(input.pessoas || [], roster);
      if (ambiguos.length) return { salvo: false, ambiguos, mensagem: 'Pergunte ao líder qual pessoa ele quis dizer.' };

      const ids = new Set(encontrados.map((e) => String(e._id)));
      aula.presencas.forEach((p) => {
        const hit = ids.has(String(p.personId));
        if (input.modo === 'lista_de_presentes') p.presente = hit;
        else if (input.modo === 'lista_de_ausentes') p.presente = !hit;
        else if (hit) p.presente = true;
      });
      if (input.tema) aula.tema = input.tema;
      aula.origem = 'whatsapp';
      aula.ausenciasProcessadasEm = undefined;
      await aula.save();
      if (conversation?.state?.tipo === 'chamada') conversation.state = null;
      processAulaInBackground(aula._id);

      const presentes = aula.presencas.filter((p) => p.presente);
      return {
        salvo: true,
        aulaCriada: criada,
        classe,
        congregacao,
        data: formatBr(aula.data),
        presentes: presentes.length,
        total: aula.presencas.length,
        ausentes: aula.presencas.filter((p) => !p.presente).map((p) => p.nome),
        naoEncontrados,
        observacao: 'As mensagens de cuidado aos ausentes serão preparadas automaticamente conforme a configuração da igreja.',
      };
    },
  },

  marcar_presenca: {
    roles: ['lider'],
    definition: {
      name: 'marcar_presenca',
      description: 'Marca uma pessoa específica (por id) como presente numa aula da EBD, incluindo visitantes recém-cadastrados que não estavam na lista.',
      input_schema: {
        type: 'object',
        properties: {
          pessoaId: { type: 'string' },
          classe: { type: 'string', description: 'Padrão: classe correspondente ao grupo da pessoa' },
          data: { type: 'string', description: 'AAAA-MM-DD (domingo)' },
        },
        required: ['pessoaId'],
      },
    },
    run: async ({ pessoaId, classe, data }, { actor }) => {
      const person = await Person.findOne(scopeFilter(actor, { _id: pessoaId })).lean();
      if (!person) throw toolError('Pessoa não encontrada');
      const c = ebd.resolveClasse(classe) || ebd.GRUPO_TO_CLASSE[person.grupo] || resolveClasseFor(actor, classe);
      const isoDate = resolveSunday(data);
      const { aula } = await ebd.findOrCreateAula({ isoDate, classe: c, congregacao: person.congregacao, userId: actor.userId, origem: 'whatsapp' });
      if (!ebd.canEditAula(aula, actor.role)) throw toolError('Chamada bloqueada: passou de 7 dias.');
      const existing = aula.presencas.find((p) => String(p.personId) === String(person._id));
      if (existing) existing.presente = true;
      else aula.presencas.push({ personId: person._id, nome: person.nome, presente: true });
      await aula.save();
      return { ok: true, pessoa: person.nome, classe: c, data: formatBr(aula.data), totalPresentes: aula.presencas.filter((p) => p.presente).length };
    },
  },

  marcar_presenca_encontro: {
    roles: ['lider'],
    definition: {
      name: 'marcar_presenca_encontro',
      description: 'Marca uma pessoa (por id) como presente num encontro de união/grupo, inclusive visitante recém-cadastrado que não é membro. Use a chamada de encontro em andamento quando houver. adicionarAoGrupo=true também a inclui como membro.',
      input_schema: {
        type: 'object',
        properties: {
          pessoaId: { type: 'string' },
          grupo: { type: 'string', description: 'Padrão: grupo da chamada em andamento' },
          data: { type: 'string', description: 'AAAA-MM-DD. Padrão: data da chamada em andamento ou hoje' },
          adicionarAoGrupo: { type: 'boolean' },
        },
        required: ['pessoaId'],
      },
    },
    run: async ({ pessoaId, grupo: ref, data, adicionarAoGrupo }, { actor, conversation }) => {
      const st = conversation?.state?.tipo === 'chamada_encontro' ? conversation.state : null;
      const person = await Person.findOne(scopeFilter(actor, { _id: pessoaId })).select('nome celular').lean();
      if (!person) throw toolError('Pessoa não encontrada');
      const grupo = await findGrupoFor(actor, ref || st?.grupoId);
      const isoDate = String(data || st?.data || zonedParts(timezone()).isoDate).slice(0, 10);
      const { encontro } = await encontrosSvc.findOrCreateEncontro({ grupo, isoDate, atividade: st?.atividade || 'reuniao', userId: actor.userId, origem: 'whatsapp' });
      if (!ebd.canEditAula(encontro, actor.role)) throw toolError('Chamada bloqueada: passou de 7 dias.');
      const existing = encontro.presencas.find((p) => String(p.personId) === String(person._id));
      if (existing) existing.presente = true;
      else encontro.presencas.push({ personId: person._id, nome: person.nome, presente: true });
      await encontro.save();
      if (st && !st.rosterIds.includes(String(person._id))) {
        st.rosterIds.push(String(person._id));
        st.rosterNomes.push(person.nome);
      }
      if (adicionarAoGrupo && !grupo.membros.some((m) => String(m.personId) === String(person._id))) {
        grupo.membros.push({ personId: person._id, nome: person.nome, celular: person.celular });
        await grupo.save();
      }
      return { ok: true, pessoa: person.nome, grupo: grupo.nome, data: formatBr(encontro.data), totalPresentes: encontro.presencas.filter((p) => p.presente).length, adicionadoAoGrupo: Boolean(adicionarAoGrupo) };
    },
  },

  anexar_foto_aula: {
    roles: ['lider'],
    definition: {
      name: 'anexar_foto_aula',
      description: 'Anexa a última foto enviada pelo líder nesta conversa à aula da EBD. A foto é enviada junto com a mensagem de "sentimos sua falta" aos ausentes.',
      input_schema: {
        type: 'object',
        properties: { classe: { type: 'string' }, congregacao: { type: 'string' }, data: { type: 'string' } },
      },
    },
    run: async ({ classe, congregacao, data }, { actor, conversation }) => {
      if (!conversation?.lastMediaDataUrl) throw toolError('Nenhuma foto recebida nesta conversa.');
      const c = resolveClasseFor(actor, classe);
      const cong = resolveCongregacao(actor, congregacao);
      const isoDate = resolveSunday(data);
      const { aula } = await ebd.findOrCreateAula({ isoDate, classe: c, congregacao: cong, userId: actor.userId, origem: 'whatsapp' });
      aula.fotoUrl = conversation.lastMediaDataUrl;
      await aula.save();
      return { ok: true, classe: c, data: formatBr(aula.data) };
    },
  },

  aniversariantes: {
    roles: ['lider'],
    definition: {
      name: 'aniversariantes',
      description: 'Lista aniversariantes de hoje, da semana (próximos 7 dias) ou do mês.',
      input_schema: {
        type: 'object',
        properties: { periodo: { type: 'string', enum: ['hoje', 'semana', 'mes'] } },
        required: ['periodo'],
      },
    },
    run: async ({ periodo }, { actor }) => {
      const now = zonedParts(timezone());
      let match;
      if (periodo === 'mes') match = { m: now.month };
      else {
        const dias = periodo === 'hoje' ? 1 : 7;
        match = {
          $or: Array.from({ length: dias }, (_, i) => {
            const [, mm, dd] = addDaysIso(now.isoDate, i).split('-').map(Number);
            return { d: dd, m: mm };
          }),
        };
      }
      const rows = await Person.aggregate([
        { $match: scopeFilter(actor, { status: 'ativo', dataNascimento: { $ne: null } }) },
        { $addFields: { d: { $dayOfMonth: '$dataNascimento' }, m: { $month: '$dataNascimento' } } },
        { $match: match },
        { $sort: { m: 1, d: 1, nome: 1 } },
        { $project: { nome: 1, congregacao: 1, d: 1, m: 1 } },
      ]);
      return {
        total: rows.length,
        pessoas: rows.map((r) => `${String(r.d).padStart(2, '0')}/${String(r.m).padStart(2, '0')} — ${r.nome} (${r.congregacao})`),
      };
    },
  },

  membros_em_risco: {
    roles: ['lider'],
    definition: {
      name: 'membros_em_risco',
      description: 'Lista membros com faltas consecutivas na EBD (quem precisa de cuidado), com nível de risco e última presença.',
      input_schema: {
        type: 'object',
        properties: { minimo_faltas: { type: 'integer', description: 'Padrão 2' } },
      },
    },
    run: async ({ minimo_faltas: min = 2 }, { actor }) => {
      const ov = await engagement.overview({ congregacao: actor.congregacao || actor.congregacoes });
      const lista = ov.emRisco.filter((s) => s.faltasConsecutivas >= min).slice(0, 25);
      return {
        total: lista.length,
        pessoas: lista.map((s) => ({
          id: s.personId,
          nome: s.nome,
          classe: s.classe,
          congregacao: s.congregacao,
          faltasSeguidas: s.faltasConsecutivas,
          ultimaPresenca: s.ultimaPresenca ? formatBr(s.ultimaPresenca) : 'nunca registrada',
          nivel: s.nivel,
          statusCuidado: s.alerta?.status || 'sem alerta',
          motivoInformado: s.alerta?.motivoInformado || null,
        })),
      };
    },
  },

  resumo_frequencia: {
    roles: ['lider'],
    definition: {
      name: 'resumo_frequencia',
      description: 'Resumo de presença da semana: EBD do domingo (por classe) e encontros dos grupos nos 7 dias anteriores, com nomes dos ausentes.',
      input_schema: { type: 'object', properties: { data: { type: 'string', description: 'AAAA-MM-DD. Padrão: domingo mais recente' } } },
    },
    run: async ({ data }, { actor }) => {
      const isoDate = resolveSunday(data);
      const aulas = await EbdAula.find(scopeFilter(actor, { data: dayRangeFromIso(isoDate) })).lean();
      const fim = new Date(`${isoDate}T23:59:59`);
      const encontros = await Encontro.find(scopeFilter(actor, {
        ebdAulaId: null, data: { $gte: new Date(fim.getTime() - 7 * 864e5), $lte: new Date(fim.getTime() + 6 * 864e5) },
      })).lean();
      return {
        encontrosDaSemana: encontros.map((e) => ({
          grupo: e.grupoNome, data: formatBr(e.data), atividade: e.atividade, tema: e.tema,
          presentes: e.presencas.filter((p) => p.presente).length, total: e.presencas.length,
          ausentes: e.presencas.filter((p) => !p.presente).map((p) => p.nome),
        })),
        data: isoDate,
        aulasRegistradas: aulas.length,
        classes: aulas.map((a) => ({
          classe: a.classe,
          congregacao: a.congregacao,
          tema: a.tema,
          presentes: a.presencas.filter((p) => p.presente).length,
          total: a.presencas.length,
          ausentes: a.presencas.filter((p) => !p.presente).map((p) => p.nome),
        })),
      };
    },
  },

  enviar_whatsapp_pessoa: {
    roles: ['lider'],
    definition: {
      name: 'enviar_whatsapp_pessoa',
      description: 'Envia uma mensagem de WhatsApp em nome da igreja para uma pessoa. Mostre o texto ao líder e só chame com confirmado=true depois que ele aprovar explicitamente.',
      input_schema: {
        type: 'object',
        properties: {
          pessoaId: { type: 'string' },
          mensagem: { type: 'string' },
          confirmado: { type: 'boolean', description: 'true somente após aprovação explícita do líder' },
        },
        required: ['pessoaId', 'mensagem', 'confirmado'],
      },
    },
    run: async ({ pessoaId, mensagem, confirmado }, { actor }) => {
      if (!confirmado) return { enviado: false, mensagem: 'Peça a confirmação do líder antes de enviar.' };
      const person = await Person.findOne(scopeFilter(actor, { _id: pessoaId })).lean();
      if (!person?.celular) throw toolError('Pessoa sem celular cadastrado.');
      await whatsapp.sendText(person.celular, mensagem);
      await registrarComunicacao({
        tipo: 'agente', destinatarios: [{ nome: person.nome, celular: person.celular, status: 'concluido' }],
        conteudo: mensagem, status: 'concluido', enviadoPor: actor.userId, origemNome: actor.nome,
      });
      return { enviado: true, para: person.nome };
    },
  },

  enviar_mensagens_ausentes_pendentes: {
    roles: ['lider'],
    definition: {
      name: 'enviar_mensagens_ausentes_pendentes',
      description: 'Envia as mensagens de "sentimos sua falta" que estão aguardando aprovação do líder nesta conversa. Use quando o líder aprovar (ex.: "enviar", "pode mandar", "enviar 1 e 3").',
      input_schema: {
        type: 'object',
        properties: { itens: { type: 'array', items: { type: 'integer' }, description: 'Números aprovados (vazio = todas)' } },
      },
    },
    run: async ({ itens = [] }, { conversation }) => {
      const state = conversation?.state;
      if (state?.tipo !== 'aprovacao_ausencia' || !state.itens?.length) return { enviado: false, mensagem: 'Não há mensagens pendentes.' };
      const pendentes = state.itens;
      conversation.state = null;
      const tenant = getTenant();
      setImmediate(() => runWithTenant(tenant, () => engagement.sendApproved(pendentes, itens))
        .catch((err) => console.error('[AGENTE] Falha ao enviar aprovadas:', err.message)));
      const total = itens.length ? itens.length : pendentes.length;
      return { enviando: total, observacao: 'Envio em fila com intervalo de 30s entre mensagens.' };
    },
  },

  registrar_cuidado: {
    roles: ['lider'],
    definition: {
      name: 'registrar_cuidado',
      description: 'Registra uma ação de cuidado pastoral feita pelo líder (ligação, visita, oração, mensagem) para uma pessoa.',
      input_schema: {
        type: 'object',
        properties: {
          pessoaId: { type: 'string' },
          tipo: { type: 'string', enum: ['ligacao', 'visita', 'oracao', 'mensagem_manual', 'outro'] },
          descricao: { type: 'string' },
          resolvido: { type: 'boolean', description: 'true se a situação foi resolvida' },
        },
        required: ['pessoaId', 'tipo'],
      },
    },
    run: async ({ pessoaId, tipo, descricao, resolvido }, { actor }) => {
      const person = await Person.findOne(scopeFilter(actor, { _id: pessoaId })).lean();
      if (!person) throw toolError('Pessoa não encontrada');
      let alert = await CareAlert.findOne({ personId: person._id, status: { $in: ['aberto', 'em_contato'] } });
      if (!alert) alert = new CareAlert({ personId: person._id, nome: person.nome, celular: person.celular, congregacao: person.congregacao });
      alert.acoes.push({ tipo, canal: tipo === 'visita' ? 'presencial' : 'telefone', descricao, por: actor.nome });
      alert.status = resolvido ? 'resolvido' : 'em_contato';
      if (resolvido) alert.resolvidoEm = new Date();
      await alert.save();
      return { ok: true, pessoa: person.nome, status: alert.status };
    },
  },

  pedido_oracao: {
    roles: ['lider', 'membro', 'desconhecido'],
    definition: {
      name: 'pedido_oracao',
      description: 'Encaminha um pedido de oração para a igreja.',
      input_schema: {
        type: 'object',
        properties: { mensagem: { type: 'string' } },
        required: ['mensagem'],
      },
    },
    run: async ({ mensagem }, { actor }) => {
      if (await prayer.pedidoRecente({ userId: actor.userId, personId: actor.personId, nome: actor.nome })) {
        return { enviado: false, mensagem: 'Já recebemos um pedido nesta última hora.' };
      }
      await prayer.registrarPedido({
        nome: actor.nome || `Contato ${actor.telefone}`, personId: actor.personId, userId: actor.userId,
        celular: actor.telefone, congregacao: actor.congregacao || '', texto: String(mensagem).trim(), origem: 'whatsapp', enviadoPor: actor.userId,
      });
      return { enviado: true, observacao: 'O pedido foi registrado e a liderança da igreja vai orar.' };
    },
  },

  meus_dados: {
    roles: ['membro'],
    definition: {
      name: 'meus_dados',
      description: 'Mostra os dados cadastrais da própria pessoa que está conversando.',
      input_schema: { type: 'object', properties: {} },
    },
    run: async (_input, { actor }) => {
      const p = await Person.findById(actor.personId).lean();
      if (!p) throw toolError('Cadastro não encontrado');
      return { ...personSummary(p), email: p.email, endereco: p.endereco, dataNascimento: p.dataNascimento ? formatBr(p.dataNascimento) : null };
    },
  },

  atualizar_meus_dados: {
    roles: ['membro'],
    definition: {
      name: 'atualizar_meus_dados',
      description: 'Atualiza email, endereço ou data de nascimento da própria pessoa. Confirme os novos valores antes.',
      input_schema: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          endereco: { type: 'string' },
          dataNascimento: { type: 'string', description: 'AAAA-MM-DD' },
        },
      },
    },
    run: async (input, { actor }) => {
      const set = {};
      if (input.email) set.email = String(input.email).toLowerCase();
      if (input.endereco) set.endereco = input.endereco;
      if (input.dataNascimento) set.dataNascimento = new Date(`${input.dataNascimento}T12:00:00Z`);
      if (!Object.keys(set).length) throw toolError('Nada para atualizar');
      await Person.findOneAndUpdate({ _id: actor.personId }, { $set: set });
      return { ok: true, atualizados: Object.keys(set) };
    },
  },

  registrar_resposta_ausencia: {
    roles: ['membro'],
    definition: {
      name: 'registrar_resposta_ausencia',
      description: 'Quando um membro responde à mensagem de "sentimos sua falta", registra o motivo informado. Se houver doença, luto, crise, pedido de visita ou sinal de afastamento, marque precisa_contato_pastoral=true para avisar a liderança.',
      input_schema: {
        type: 'object',
        properties: {
          resumo: { type: 'string', description: 'Resumo curto e respeitoso do que a pessoa contou' },
          categoria: { type: 'string', enum: ['saude', 'trabalho', 'viagem', 'familia', 'luto', 'desanimo', 'conflito', 'mudanca', 'outro'] },
          precisa_contato_pastoral: { type: 'boolean' },
        },
        required: ['resumo', 'categoria', 'precisa_contato_pastoral'],
      },
    },
    run: async ({ resumo, categoria, precisa_contato_pastoral: precisa }, { actor }) => {
      const person = await Person.findById(actor.personId).lean();
      let alert = await CareAlert.findOne({ personId: actor.personId, status: { $in: ['aberto', 'em_contato'] } });
      if (!alert) alert = new CareAlert({ personId: actor.personId, nome: person?.nome, celular: person?.celular, congregacao: person?.congregacao });
      alert.motivoInformado = `${categoria}: ${resumo}`;
      alert.status = 'em_contato';
      alert.precisaVisita = alert.precisaVisita || precisa;
      alert.acoes.push({ tipo: 'resposta_membro', canal: 'whatsapp', descricao: resumo, por: person?.nome });
      await alert.save();
      if (precisa) {
        await notifyLeadership({
          tipo: 'ausencias',
          congregacao: person?.congregacao,
          extra: alert.classe ? classLeaders(alert.classe, alert.congregacao) : [],
          texto: templates.liderancaAlertaAusencia({
            nome: person?.nome, classe: alert.classe, congregacao: person?.congregacao,
            faltas: alert.faltasConsecutivas || 1, celular: person?.celular, motivo: alert.motivoInformado,
          }),
          emailSubject: `${person?.nome} precisa de contato pastoral`,
        });
      }
      return { ok: true, liderancaAvisada: Boolean(precisa) };
    },
  },

  cadastrar_me: {
    roles: ['desconhecido'],
    definition: {
      name: 'cadastrar_me',
      description: 'Cadastra como visitante a própria pessoa que está conversando (o celular é o do WhatsApp). Colete nome completo e, se possível, data de nascimento e congregação que visitou.',
      input_schema: {
        type: 'object',
        properties: {
          nome: { type: 'string' },
          dataNascimento: { type: 'string', description: 'AAAA-MM-DD' },
          sexo: { type: 'string', enum: ['Masculino', 'Feminino'] },
          email: { type: 'string' },
          congregacao: { type: 'string' },
        },
        required: ['nome'],
      },
    },
    run: async (input, { actor, conversation }) => {
      const tenant = getTenant();
      if (tenant?.ia?.cadastroPublico === false) throw toolError('Cadastro pelo WhatsApp desativado pela igreja.');
      const lista = tenant?.congregacoes || [];
      const congregacao = lista.find((c) => ebd.normalize(c) === ebd.normalize(input.congregacao)) || lista[0] || 'Não atribuído';
      const payload = {
        nome: normalizeName(input.nome),
        tipo: 'visitante',
        celular: toLocal(actor.telefone),
        sexo: input.sexo,
        email: input.email,
        congregacao,
        dataVisita: new Date(),
        status: 'ativo',
      };
      if (input.dataNascimento) payload.dataNascimento = new Date(`${input.dataNascimento}T12:00:00Z`);
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
      const dup = buildDuplicateQuery(payload);
      if (dup && await Person.findOne(dup).lean()) return { duplicado: true, mensagem: 'Você já tem cadastro conosco.' };
      const person = await Person.create(payload);
      triggerVisitanteWhatsApp(person, null);
      if (conversation) {
        conversation.personId = person._id;
        conversation.papel = 'membro';
        conversation.nome = person.nome;
      }
      return { criado: true, nome: person.nome, congregacao };
    },
  },
};

const allowedIn = (tool, channel) => !tool.channels || tool.channels.includes(channel || 'whatsapp');
const toolsFor = (papel, channel = 'whatsapp') => Object.values(TOOLS).filter((t) => t.roles.includes(papel) && allowedIn(t, channel));

// Argumentos vêm do modelo (sujeito a prompt injection): chave "$…" em qualquer nível viraria
// operador do Mongo (ex.: pessoaId: { "$ne": null } casaria com qualquer pessoa).
const hasOperatorKey = (v, depth = 0) => {
  if (!v || typeof v !== 'object' || depth > 6) return false;
  if (Array.isArray(v)) return v.some((x) => hasOperatorKey(x, depth + 1));
  return Object.keys(v).some((k) => k.startsWith('$') || hasOperatorKey(v[k], depth + 1));
};

const runTool = async (name, input, ctx) => {
  const tool = TOOLS[name];
  if (!tool || !tool.roles.includes(ctx.actor.papel) || !allowedIn(tool, ctx.channel)) throw toolError(`Ferramenta ${name} não permitida`);
  if (hasOperatorKey(input)) throw toolError('Parâmetros inválidos');
  // Ids sempre como texto: objeto no lugar de id não pode virar filtro
  const args = { ...(input || {}) };
  Object.keys(args).forEach((k) => {
    if (/Id$/.test(k) && args[k] !== undefined && args[k] !== null && typeof args[k] !== 'string') throw toolError(`Parâmetro ${k} inválido`);
  });
  return tool.run(args, ctx);
};

module.exports = {
  TOOLS, toolsFor, runTool, scopeFilter, gruposAcessiveis, buildFicha, sendFotoToActor, formatPhone, phoneWarning, DIAS_PT,
};
