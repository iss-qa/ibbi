const Person = require('../../models/Person.model');
const User = require('../../models/User.model');
const { createMessage, textOf, isAiConfigured, provider } = require('./llm');
const { toolsFor, runTool } = require('./tools');
const { getTenant } = require('../../tenancy/context');
const { churchName, timezone } = require('../../tenancy/brand');
const { phoneVariants, samePhone } = require('../../utils/phone');
const { zonedParts, lastSundayIso, isoToBr } = require('../../utils/time');
const usage = require('../usage.service');
const { getUserCongregacoes } = require('../../utils/access');
const { gruposDoLider } = require('../encontro.service');
const { assistenteInfo, ASSISTENTE_PADRAO } = require('../../config/assistentes');
const { getPlan } = require('../../config/plans');

// Congregação única vira `congregacao`; várias ficam em `congregacoes` (escopo com $in nas tools).
const scopeFromList = (lista) => (!lista ? { congregacao: null }
  : lista.length === 1 ? { congregacao: lista[0] } : { congregacao: null, congregacoes: lista });

const MAX_TOOL_ROUNDS = 8;
const HISTORY_TURNS = 12;
const WEEKDAY = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/**
 * Quem está falando com o agente pelo WhatsApp.
 * lider: master/admin com celular cadastrado, líder de EBD (Tenant.ebdLideres) ou contato da liderança.
 */
const identifyActor = async (phone) => {
  const tenant = getTenant();
  const variants = phoneVariants(phone);
  const persons = await Person.find({ celular: { $in: variants } }).select('nome congregacao').lean();
  const person = persons[0] || null;
  const user = persons.length
    ? await User.findOne({ personId: { $in: persons.map((p) => p._id) }, ativo: true }).lean()
    : null;
  const ebdClasses = (tenant?.ebdLideres || []).filter((l) => samePhone(l.celular, phone));
  const lideranca = (tenant?.lideranca || []).find((l) => samePhone(l.celular, phone));
  const grupos = await gruposDoLider(phone);

  const base = { telefone: phone, personId: person?._id, userId: user?._id, nome: person?.nome || lideranca?.nome || ebdClasses[0]?.nome, grupos };

  if (user?.role === 'master') return { ...base, papel: 'lider', role: 'master', congregacao: null, classes: ebdClasses };
  if (user?.role === 'admin') {
    // Falha ao calcular o escopo = só a congregação do cadastro, ou nenhuma (nunca a igreja inteira)
    const lista = await getUserCongregacoes(user).catch(() => (person?.congregacao ? [person.congregacao] : []));
    return { ...base, papel: 'lider', role: 'admin', ...scopeFromList(lista), classes: ebdClasses };
  }
  if (lideranca) return { ...base, papel: 'lider', role: 'lider', liderancaGeral: true, congregacao: lideranca.congregacao || null, classes: ebdClasses };
  if (ebdClasses.length || grupos.length) {
    const congs = [...new Set([...ebdClasses.map((c) => c.congregacao), ...grupos.map((g) => g.congregacao)])];
    return { ...base, papel: 'lider', role: 'lider', ...scopeFromList(congs.filter(Boolean)), classes: ebdClasses };
  }
  if (person) return { ...base, papel: 'membro', role: user?.role || 'user', congregacao: person.congregacao };
  return { ...base, papel: 'desconhecido', role: null, congregacao: null };
};

const actorFromUser = async (user) => {
  const person = user.personId ? await Person.findById(user.personId).select('nome congregacao celular').lean() : null;
  const classes = person?.celular ? (getTenant()?.ebdLideres || []).filter((l) => samePhone(l.celular, person.celular)) : [];
  return {
    papel: 'lider',
    role: user.role,
    nome: user.nome,
    userId: user._id,
    personId: user.personId,
    telefone: person?.celular,
    ...scopeFromList(user.role === 'master' ? null : await getUserCongregacoes(user).catch(() => (person?.congregacao ? [person.congregacao] : []))),
    classes,
  };
};

// O que o plano da igreja permite (fica na parte fixa do prompt: muda só quando a igreja troca de plano).
const planoRegras = (tenant) => {
  const plano = getPlan(tenant?.plano);
  const f = plano.features;
  return [
    `Plano da igreja: ${plano.nome}.`,
    f.multimodal ? 'Áudios e fotos de fichas: disponíveis.' : 'Áudios e fotos NÃO estão no plano: não ofereça enviar áudio/foto; se pedirem, diga que é do plano Multiplicar (upgrade em Assinatura, na plataforma).',
    f.whatsappOficial ? '' : 'WhatsApp Oficial (API da Meta) não está no plano (disponível no Multiplicar).',
  ].filter(Boolean).join(' ');
};

// Parte estável do prompt (cacheável): regras por papel.
const stableSystem = (papel) => {
  const tenant = getTenant();
  const info = assistenteInfo(tenant?.ia?.nomeAssistente || ASSISTENTE_PADRAO);
  const { nome } = info;
  const comum = [
    `Você é ${nome}, assistente de IA da plataforma ${process.env.PRODUCT_NAME || 'PastorIA'}, a serviço da ${churchName()}, uma igreja evangélica no Brasil. Você conversa pelo WhatsApp.`,
    info.significado ? `Se perguntarem sobre o seu nome: ${nome} significa "${info.significado}"; ${info.apresentacao}.` : '',
    `Tom: ${tenant?.ia?.tom || 'pastoral, acolhedor e objetivo'}. Português do Brasil. Respostas curtas (WhatsApp), formatação *negrito* e _itálico_, sem markdown de títulos ou tabelas.`,
    'Nunca invente dados: use as ferramentas para consultar e registrar. Se uma ferramenta falhar, explique de forma simples.',
    'Dados pessoais são sensíveis (LGPD): só compartilhe informações de outras pessoas com líderes, e apenas o necessário.',
    planoRegras(tenant),
  ];
  const porPapel = {
    lider: [
      'Quem fala com você é um LÍDER da igreja (pastor, secretaria, professor ou líder de EBD). Seu trabalho é poupar o tempo dele: ele não precisa abrir o sistema.',
      'Capacidades: pesquisar, cadastrar e EDITAR pessoas (editar_pessoa, sempre confirmando antes), registrar chamada da EBD (texto, números da lista, áudio transcrito), cadastrar visitantes/novos decididos (inclusive lendo foto de ficha), marcar presença, anexar foto da turma, consultar aniversariantes, membros em risco, resumo de frequência, registrar ações de cuidado e enviar mensagens.',
      'Encontros das uniões/grupos (quarta, ensaio, culto): listar_grupos_encontro, ver_membros_grupo, iniciar_chamada_encontro/registrar_chamada_encontro, marcar_presenca_encontro e enviar_aviso_grupo — diferente da EBD de domingo (iniciar_chamada_ebd/registrar_chamada_ebd).',
      'Criar ou editar grupos e adicionar ou remover membros de grupos NÃO é feito pelo WhatsApp: se pedirem, diga com gentileza que é pela plataforma web, menu Encontros.',
      'Pesquisa de pessoa: buscar_pessoas; se houver uma só (ou o líder escolher), chame ficha_pessoa e mostre o campo "texto" exatamente como veio (a foto é enviada pela ferramenta).',
      'Cadastro: chame cadastrar_pessoa com confirmado=false, mostre a "mensagemParaLider" exatamente e só confirme depois do "sim". SEMPRE repita o número do WhatsApp para o líder conferir; se vier "alertaCelular", destaque o alerta. Após criar, informe para qual número as boas-vindas foram (campo boasVindas) e, se houver "modoTeste", avise.',
      'Foto: se o líder enviar uma foto de rosto de alguém (ou pedir para trocar a foto), use editar_pessoa com usarUltimaFoto=true, confirmando antes de quem é a foto. Foto de ficha de papel é cadastro, não foto de perfil.',
      'Menus: quando listar opções para o líder escolher, numere (1., 2., 3.) para ele responder só com o número.',
      'Para registrar chamada, prefira iniciar_chamada_* (envia a lista numerada) e depois registrar com o que o líder responder. Ações que alteram grupos ou enviam mensagens: mostre o resumo e peça "sim" antes (confirmado=true).',
      'Chamada: "vieram Pedro, Maria e Lucas" → registrar_chamada_* modo lista_de_presentes. "faltaram X e Y" → lista_de_ausentes. Visitante na aula ou no encontro ("visitante Samuel, 22 anos, masculino") → cadastrar_pessoa (tipo visitante, confirmando os dados) e depois marcar_presenca (EBD) ou marcar_presenca_encontro (união/grupo) com o id retornado.',
      'Foto de ficha de visitante: extraia nome, data de nascimento, telefone, endereço e mostre ao líder pedindo confirmação ANTES de cadastrar. Foto da turma: pergunte se deve anexar à aula (anexar_foto_aula).',
      'Nunca envie mensagem a membros sem aprovação explícita do líder (enviar_whatsapp_pessoa com confirmado=true só após o "sim").',
      'Ao concluir uma ação, confirme em 1-3 linhas com números (ex.: "✅ Chamada salva: 8/10 presentes. Ausentes: Beatriz, Gabriel.").',
    ],
    membro: [
      'Quem fala com você é um MEMBRO/frequentador da igreja. Seja caloroso e pastoral.',
      'Você pode: receber pedidos de oração, mostrar/atualizar os dados cadastrais da própria pessoa e acolher respostas às mensagens de "sentimos sua falta".',
      'Visitantes e novos convertidos recebem mensagens de acolhimento (jornada de 30 dias). Se a pessoa responder pedindo contato, querendo saber do batismo ("quero saber mais"), aceitando conhecer um grupo ("sim") ou contando uma dificuldade, acolha e use registrar_resposta_ausencia com precisa_contato_pastoral=true para a liderança procurá-la.',
      'Se a pessoa contar por que tem faltado, registre com registrar_resposta_ausencia. Doença, luto, crise, desânimo ou pedido de visita → precisa_contato_pastoral=true e diga que a liderança vai procurá-la.',
      'Você não é pastor: para aconselhamento, acolha brevemente, ofereça oração e diga que a liderança entrará em contato. Em risco de vida, oriente ligar 188 (CVV) ou 192.',
    ],
    desconhecido: [
      'Quem fala com você ainda NÃO tem cadastro na igreja (provavelmente um visitante).',
      'Dê boas-vindas, pergunte o nome completo e, com naturalidade, a data de nascimento e qual congregação visitou; então cadastre com cadastrar_me. Não peça documentos.',
      'Você também pode receber pedidos de oração. Não compartilhe dados de outras pessoas.',
    ],
  };
  return [...comum, ...porPapel[papel]].filter(Boolean).join('\n');
};

// Parte dinâmica (fica depois do ponto de cache).
const dynamicContext = (actor, conversation, channel) => {
  const tenant = getTenant();
  const tz = timezone();
  const now = zonedParts(tz);
  const lines = [
    `Hoje: ${WEEKDAY[now.weekday]}, ${isoToBr(now.isoDate)} ${now.hhmm} (${tz}). Domingo mais recente: ${lastSundayIso(tz)}.`,
    `Canal: ${channel}.`,
    `Congregações da igreja: ${(tenant?.congregacoes || []).join(', ') || 'Sede'}.`,
    `Pessoa: ${actor.nome || 'nome desconhecido'} | papel: ${actor.papel}${actor.role ? ` (${actor.role})` : ''}${actor.congregacao ? ` | congregação: ${actor.congregacao}` : actor.congregacoes ? ` | congregações: ${actor.congregacoes.join(', ')}` : actor.papel === 'lider' ? ' | acesso a todas as congregações' : ''}.`,
  ];
  if (actor.classes?.length) lines.push(`Classes que lidera na EBD: ${actor.classes.map((c) => `${c.classe} (${c.congregacao})`).join(', ')}.`);
  if (actor.grupos?.length) lines.push(`Grupos que lidera (encontros): ${actor.grupos.map((g) => `${g.nome} (${g.congregacao})`).join(', ')}.`);
  const st = conversation?.state;
  if (st?.tipo === 'chamada') {
    lines.push(`CHAMADA EM ANDAMENTO: classe ${st.classe}, ${st.congregacao}, domingo ${st.data}. Se o líder responder com nomes/números, registre com registrar_chamada_ebd (modo lista_de_presentes). Lista enviada:\n${(st.rosterNomes || []).map((n, i) => `${i + 1}. ${n}`).join('\n')}`);
  }
  if (st?.tipo === 'chamada_encontro') {
    lines.push(`CHAMADA DE ENCONTRO EM ANDAMENTO: grupo ${st.grupoNome}, ${st.data}. Se o líder responder com nomes/números, use registrar_chamada_encontro (modo lista_de_presentes). Lista enviada:\n${(st.rosterNomes || []).map((n, i) => `${i + 1}. ${n}`).join('\n')}`);
  }
  if (st?.contexto) lines.push(`ONDE O LÍDER ESTÁ NO MENU: ${st.contexto}`);
  if (st?.tipo === 'aprovacao_ausencia') {
    lines.push(`MENSAGENS AGUARDANDO APROVAÇÃO (${st.itens.length}): ${st.itens.map((it, i) => `${i + 1}. ${it.nome}`).join('; ')}. Se o líder aprovar, use enviar_mensagens_ausentes_pendentes.`);
  }
  if (tenant?.ia?.instrucoesExtras) lines.push(`Orientações da igreja: ${tenant.ia.instrucoesExtras}`);
  return lines.join('\n');
};

// A mensagem atual já vai como entrada: sai do histórico (senão o modelo recebe "2" + "2" = "22").
const toHistoryMessages = (history = []) => {
  const turns = history.slice(-HISTORY_TURNS);
  while (turns.length && turns[turns.length - 1].role === 'user') turns.pop();
  while (turns.length && turns[0].role !== 'user') turns.shift();
  return turns.map((t) => ({ role: t.role, content: t.text || '...' }));
};

/**
 * Executa o agente para uma mensagem. Retorna o texto de resposta.
 * input: { text, images: [{ base64, mimetype }] }
 */
const runAgent = async ({ actor, conversation, input, channel = 'whatsapp' }) => {
  if (!isAiConfigured()) return null;
  await usage.assertWithinLimit('iaInteracoesMes');

  const tools = toolsFor(actor.papel, channel).map((t) => t.definition);
  // Cache de contexto: o sistema tem SÓ a parte fixa (regras do papel + ferramentas), idêntica em toda
  // chamada, para o provedor reaproveitar o prefixo (Gemini: cache implícito; Anthropic: cache_control).
  // O que muda a cada mensagem (hora, estado do menu, congregação) vai junto da mensagem do usuário.
  const system = [
    { type: 'text', text: stableSystem(actor.papel), cache_control: { type: 'ephemeral' } },
  ];

  const userContent = [{ type: 'text', text: `[Contexto atual, não responda a isto]\n${dynamicContext(actor, conversation, channel)}` }];
  for (const img of input.images || []) {
    userContent.push({ type: 'image', source: { type: 'base64', media_type: img.mimetype, data: img.base64 } });
  }
  userContent.push({ type: 'text', text: input.text || (input.images?.length ? '(imagem enviada sem legenda)' : '...') });

  const messages = [...toHistoryMessages(conversation?.history), { role: 'user', content: userContent }];
  const ctx = { actor, conversation, channel };

  let response;
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    try {
      response = await createMessage({ system, tools, messages, max_tokens: 8000 }, { countInteraction: round === 0 });
    } catch (err) {
      console.error(`[AGENTE] Erro no provedor ${provider()} (${err.status || '?'}):`, err.message);
      throw err;
    }

    if (response.stop_reason === 'refusal') {
      return 'Desculpe, não consigo ajudar com isso por aqui. Se precisar, fale com a liderança da igreja. 🙏';
    }
    if (response.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: response.content });
      continue;
    }
    if (response.stop_reason !== 'tool_use') break;

    messages.push({ role: 'assistant', content: response.content });
    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    // Uma ferramenta por vez: envios de WhatsApp em paralelo furariam o ritmo anti-ban
    const results = [];
    for (const tu of toolUses) {
      try {
        const result = await runTool(tu.name, tu.input, ctx);
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result ?? { ok: true }) });
      } catch (err) {
        // Só a mensagem: o objeto de erro do axios carrega headers (token da Meta/Evolution)
        if (!err.toolError) console.error(`[AGENTE] Tool ${tu.name} falhou:`, err?.message || err);
        results.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true, content: err.toolError ? err.message : 'Erro interno ao executar a ação.' });
      }
    }
    messages.push({ role: 'user', content: results });
  }

  return textOf(response) || 'Pronto! ✅';
};

module.exports = { identifyActor, actorFromUser, runAgent };
