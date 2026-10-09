const Conversation = require('../../models/Conversation.model');
const AutomationRun = require('../../models/AutomationRun.model');
const whatsapp = require('../whatsapp.service');
const usage = require('../usage.service');
const engagement = require('../engagement.service');
const { runTool } = require('./tools');
const { handleFlow } = require('./flows');
const culto = require('../culto.service');
const escala = require('../escala.service');
const jornada = require('../jornada.service');
const optout = require('../optout.service');
const eventos = require('../evento.service');
const Person = require('../../models/Person.model');
const { phoneVariants } = require('../../utils/phone');
const { identifyActor, runAgent } = require('./agent.service');
const { transcribe, isTranscriptionConfigured } = require('./transcription.service');
const templates = require('../../templates/messages.templates');
const { hasFeature, getPlan } = require('../../config/plans');
const { getTenant } = require('../../tenancy/context');
const { ASSISTENTE_PADRAO } = require('../../config/assistentes');

const MAX_HISTORY = 30;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Serializa mensagens do mesmo contato (evita respostas cruzadas quando chegam em rajada).
const locks = new Map();
const withLock = (key, fn) => {
  const prev = locks.get(key) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  locks.set(key, next);
  next.finally(() => { if (locks.get(key) === next) locks.delete(key); });
  return next;
};

const pushTurn = (conversation, role, text) => {
  conversation.history.push({ role, text: String(text || '').slice(0, 4000), at: new Date() });
  if (conversation.history.length > MAX_HISTORY) conversation.history = conversation.history.slice(-MAX_HISTORY);
};

const reply = async (to, text) => {
  // WhatsApp limita ~4096 caracteres por mensagem.
  const chunks = String(text).match(/[\s\S]{1,3900}(\n|$)/g) || [String(text)];
  for (const chunk of chunks) await whatsapp.sendText(to, chunk.trim());
};

// Menu do membro: cada opção vira um pedido em linguagem natural para o agente.
// O menu do líder é guiado passo a passo em flows.js.
const MENU = {
  membro: {
    1: 'Quero fazer um pedido de oração. Pergunte qual é o pedido.',
    2: 'Quero ver meus dados cadastrais.',
    3: 'Quero atualizar meus dados. Pergunte o que devo alterar.',
  },
};
// "menu", "MENU", "opções", "ajuda", "início" abrem o menu a qualquer momento (cancelam o passo atual).
// Saudações só abrem o menu quando não há nada em andamento.
const MENU_FORCE = /^(menu|op[cç][oõ]es|ajuda|in[ií]cio|voltar)[!.\s]*$/i;
const MENU_GREETING = /^(oi|ol[aá]|bom dia|boa tarde|boa noite)[!.\s]*$/i;
// Estados conduzidos pelo agente/atalhos (não são passos de menu).
const AGENT_STATES = ['chamada', 'chamada_encontro', 'aprovacao_ausencia', 'contexto', 'celula_relatorio'];

const menuFor = (actor) => {
  const tenant = getTenant();
  const assistente = tenant?.ia?.nomeAssistente || ASSISTENTE_PADRAO;
  if (actor.papel === 'lider') return templates.menuLider(actor.nome, assistente);
  if (actor.papel === 'membro') return templates.menuMembro(actor.nome, assistente);
  return null; // desconhecido: o agente conduz o cadastro
};

// Atalhos determinísticos: economizam IA nas respostas mais comuns.
const fastPath = async ({ text, actor, conversation }) => {
  const t = String(text || '').trim().toLowerCase();
  const st = conversation.state;
  if (!t) return null;

  if (MENU_FORCE.test(t) || (MENU_GREETING.test(t) && (!st || st.tipo === 'menu' || st.tipo === 'contexto'))) {
    const menu = menuFor(actor);
    if (menu) {
      conversation.state = { tipo: 'menu' };
      return menu;
    }
  }
  if (actor.papel !== 'lider' || !st) return null;

  if (st.tipo === 'celula_relatorio') {
    const nums = t.match(/\d+/g);
    if (!nums) return null;
    const [visitantes = 0, decisoes = 0] = nums.map(Number);
    await require('../../models/Encontro.model').updateOne({ _id: st.encontroId }, { $set: { 'relatorio.visitantes': visitantes, 'relatorio.decisoes': decisoes } });
    conversation.state = null;
    return templates.celulaRelatorioSalvo(visitantes, decisoes);
  }

  if (st.tipo === 'chamada_encontro' && /^[\d\s,;.e]+$/.test(t)) {
    const numeros = t.split(/[^\d]+/).filter(Boolean);
    const r = await runTool('registrar_chamada_encontro', { pessoas: numeros, modo: 'lista_de_presentes' }, { actor, conversation });
    if (!r.salvo) return null;
    // Célula: pede visitantes e decisões logo depois da chamada.
    const celula = await require('../../models/GrupoEncontro.model').findOne({ _id: st.grupoId, tipo: 'celula' }).select('_id').lean();
    const enc = celula && await require('../../models/Encontro.model').findOne({ grupoId: st.grupoId }).sort({ updatedAt: -1 }).select('_id').lean();
    if (enc) conversation.state = { tipo: 'celula_relatorio', encontroId: String(enc._id) };
    return `✅ Frequência salva — *${r.grupo}* (${r.data}): ${r.presentes}/${r.total} presentes.${r.ausentes.length ? `\nAusentes: ${r.ausentes.join(', ')}.` : ''}${r.naoEncontrados.length ? `\nNão encontrei: ${r.naoEncontrados.join(', ')}.` : ''}${enc ? templates.celulaPerguntarRelatorio() : ''}`;
  }

  if (st.tipo === 'chamada' && /^[\d\s,;.e]+$/.test(t)) {
    const numeros = t.split(/[^\d]+/).filter(Boolean);
    const r = await runTool('registrar_chamada_ebd', { pessoas: numeros, modo: 'lista_de_presentes' }, { actor, conversation });
    if (!r.salvo) return null;
    return `✅ Chamada salva — *${r.classe}* (${r.data}): ${r.presentes}/${r.total} presentes.${r.ausentes.length ? `\nAusentes: ${r.ausentes.join(', ')}.` : ''}${r.naoEncontrados.length ? `\nNão encontrei: ${r.naoEncontrados.join(', ')}.` : ''}`;
  }

  if (st.tipo === 'aprovacao_ausencia') {
    if (/^(n[aã]o enviar|n[aã]o|cancelar)$/.test(t)) {
      conversation.state = null;
      return 'Ok, não vou enviar. As mensagens continuam disponíveis no painel *Cuidado Pastoral*.';
    }
    const m = t.match(/^(enviar|sim|pode enviar|pode mandar|manda)\s*([\d\s,e]*)$/);
    if (m) {
      const itens = (m[2] || '').split(/[^\d]+/).filter(Boolean).map(Number);
      const r = await runTool('enviar_mensagens_ausentes_pendentes', { itens }, { actor, conversation });
      return r.enviando ? `📤 Enviando ${r.enviando} mensagem(ns) com intervalo de 30s. Eu aviso se algo falhar.` : r.mensagem;
    }
  }
  return null;
};

/**
 * Atendimento sem IA que vale em todos os planos:
 *  - "CHEGUEI <código>" → check-in do culto (desconhecido: pede o nome e cadastra como visitante);
 *  - resposta "1/2" ao convite de escala de voluntários.
 * Retorna o texto de resposta ou null (segue o fluxo normal).
 */
const preAtendimento = async ({ text, actor, conversation, chave }) => {
  const tenant = getTenant();
  const t = String(text || '').trim();
  const st = conversation.state;
  if (!t) return null;

  const checkinMatch = t.match(culto.CHECKIN_RE);
  if (checkinMatch && hasFeature(tenant, 'checkinCulto')) {
    const r = await culto.checkin({ codigo: checkinMatch[1], telefone: chave });
    if (r.status === 'invalido') return templates.checkinInvalido();
    if (r.status === 'precisaNome') {
      conversation.state = { tipo: 'checkin_nome', cultoId: r.cultoId };
      return templates.checkinPedirNome();
    }
    return r.status === 'ok' ? templates.checkinOk(r.nome, r.titulo) : templates.checkinRepetido(r.nome);
  }

  if (st?.tipo === 'checkin_nome' && !MENU_FORCE.test(t)) {
    const r = await culto.checkinVisitante({ cultoId: st.cultoId, nome: t, telefone: chave });
    if (r.status === 'nomeIncompleto') return 'Pode me mandar o seu *nome e sobrenome*? 😊';
    conversation.state = null;
    if (r.status === 'invalido') return templates.checkinInvalido();
    conversation.papel = 'membro';
    return templates.checkinVisitanteOk(r.nome);
  }

  // Eventos: "INSCREVER ABC12" (sem IA)
  const inscreverMatch = t.match(eventos.INSCREVER_RE);
  if (inscreverMatch) {
    const r = await eventos.inscreverPorWhatsApp({ codigo: inscreverMatch[1], telefone: chave });
    if (r.status === 'precisaNome') {
      conversation.state = { tipo: 'evento_nome', codigo: inscreverMatch[1].toUpperCase() };
      return templates.eventoPedirNome(r.titulo);
    }
    return respostaInscricao(r, chave);
  }
  if (st?.tipo === 'evento_nome' && !MENU_FORCE.test(t)) {
    if (t.split(/\s+/).filter((p) => p.length > 1).length < 2) return 'Pode me mandar o seu *nome e sobrenome*? 😊';
    conversation.state = null;
    const r = await eventos.inscreverPorWhatsApp({ codigo: st.codigo, telefone: chave, nome: t });
    return respostaInscricao(r, chave);
  }

  // Lembrete dos cultos (opt-in)
  if (/^\s*(parar|sem|desativar|cancelar)\s+lembretes?\s*[.!]*$/i.test(t)) {
    await Person.updateMany({ celular: { $in: phoneVariants(chave) } }, { $set: { lembreteCulto: false } });
    return templates.lembreteDesativado();
  }
  if (/^\s*(lembrete|lembretes|quero lembrete|ativar lembretes?)\s*[.!]*$/i.test(t)) {
    const r = await Person.updateMany({ celular: { $in: phoneVariants(chave) } }, { $set: { lembreteCulto: true } });
    if (!r.matchedCount) return 'Para receber os lembretes, primeiro precisamos do seu cadastro. Fale com a recepção da igreja ou envie *menu*. 🙏';
    return templates.lembreteAtivado(actor.nome);
  }

  if (st?.tipo === 'escala_convite' && hasFeature(tenant, 'escalas')) {
    return escala.responderConvite({ conversation, text: t });
  }
  return null;
};

// Resposta da inscrição; evento pago manda o Pix copia-e-cola e o QR logo depois.
const respostaInscricao = async (r, chave) => {
  if (r.status === 'invalido') return templates.eventoInvalido();
  const e = eventos.resumo(r.evento);
  if (r.status === 'ja') return templates.eventoJaInscrito(r.nome, e.titulo, r.inscricao.status);
  if (r.status === 'espera') return templates.eventoEspera(r.nome, e.titulo);
  if (r.pix) {
    setTimeout(() => {
      whatsapp.sendText(chave, r.pix.copiaECola).then(() => whatsapp.sendImage(chave, r.pix.qr, `Pix: ${e.titulo}`)).catch((err) => console.warn('[EVENTO] Pix:', err.message));
    }, 1500);
  }
  return templates.eventoInscrito(r.nome, e, r.pix);
};

/**
 * Mensagem recebida (já normalizada pelo webhook do provider).
 * msg: { from, messageId, pushName, text, media: { kind: 'image'|'audio', ref, mimetype, base64 } }
 */
const handleInbound = async (msg) => {
  const tenant = getTenant();
  if (!msg.from || whatsapp.isGroupJid(msg.from)) return;
  if (msg.messageId && !(await AutomationRun.claim(`in:${msg.messageId}`, 'inbound'))) return; // retry do webhook
  await usage.increment({ whatsappRecebidas: 1 });

  // Check-in do culto e resposta de escala não usam IA: valem em todos os planos.
  const iaLiberada = Boolean(tenant?.ia?.ativo && hasFeature(tenant, 'agenteWhatsApp'));

  const chave = whatsapp.sanitizeNumber(msg.from);
  await withLock(chave, async () => {
    const actor = await identifyActor(chave);
    const conversation = await Conversation.findOneAndUpdate(
      { canal: 'whatsapp', chave },
      { $setOnInsert: { canal: 'whatsapp', chave }, $set: { lastInboundAt: new Date(), papel: actor.papel, personId: actor.personId, userId: actor.userId, nome: actor.nome || msg.pushName } },
      { upsert: true, new: true },
    );
    if (!actor.nome && msg.pushName) actor.nome = msg.pushName;

    // ── Descadastro: vem antes de tudo (menus, IA, check-in, escalas) ──
    const textoCru = String(msg.text || '').trim();
    if (!msg.media && optout.SAIR_RE.test(textoCru)) {
      await optout.sair(chave, { detalhe: textoCru });
      conversation.state = null;
      pushTurn(conversation, 'user', textoCru);
      pushTurn(conversation, 'assistant', '[descadastrado: SAIR]');
      conversation.markModified('state');
      await conversation.save();
      // Única mensagem após o SAIR: a confirmação de como voltar.
      await whatsapp.sendText(chave, templates.optoutConfirmado(actor.nome), { ignorarOptOut: true }).catch((err) => console.error('[OPTOUT] Confirmação:', err.message));
      return;
    }
    if (await optout.bloqueado(chave)) {
      if (!msg.media && optout.VOLTAR_RE.test(textoCru)) {
        await optout.voltar(chave, { detalhe: textoCru });
        pushTurn(conversation, 'user', textoCru);
        pushTurn(conversation, 'assistant', templates.optoutVoltou(actor.nome));
        await conversation.save();
        await reply(chave, templates.optoutVoltou(actor.nome));
        return;
      }
      // Descadastrado: registra que escreveu, mas não responde nada (nem IA).
      pushTurn(conversation, 'user', msg.media ? `[${msg.media.kind}] ${textoCru}` : textoCru);
      await conversation.save();
      return;
    }
    if (actor.personId) jornada.marcarResposta(actor.personId);

    if (!msg.media) {
      const pre = await preAtendimento({ text: msg.text || '', actor, conversation, chave }).catch((err) => {
        console.error('[INBOUND] Pré-atendimento falhou:', err.message);
        return null;
      });
      if (pre) {
        pushTurn(conversation, 'user', msg.text || '');
        pushTurn(conversation, 'assistant', pre);
        conversation.markModified('state');
        await conversation.save();
        await reply(chave, pre);
        return;
      }
    }
    if (!iaLiberada) {
      conversation.markModified('state');
      await conversation.save();
      return;
    }

    let text = msg.text || '';
    let plain = text; // sem o prefixo de transcrição (menus e atalhos)
    let flowMedia = null;
    const images = [];
    try {
      if (msg.media) {
        if (!hasFeature(tenant, 'multimodal')) {
          // Plano sem áudio/foto: o líder entende o motivo e o caminho (upgrade); o membro só é orientado a escrever.
          await reply(chave, actor.papel === 'lider' ? templates.midiaForaDoPlano(getPlan(tenant?.plano).nome) : templates.midiaSoTexto());
          return;
        }
        const media = msg.media.base64 ? msg.media : { ...msg.media, ...(await whatsapp.getMediaBase64(msg.media.ref)) };
        const mimetype = String(media.mimetype || '').split(';')[0];
        if (msg.media.kind === 'audio') {
          if (!isTranscriptionConfigured()) {
            await reply(chave, 'Ainda não consigo ouvir áudios. Pode me mandar por texto? 🙏');
            return;
          }
          const transcrito = await transcribe(media.base64, mimetype || 'audio/ogg');
          if (!transcrito) {
            await reply(chave, 'Não consegui entender o áudio. Pode repetir ou mandar por texto? 🙏');
            return;
          }
          plain = transcrito.trim();
          text = `[áudio transcrito] ${plain}`;
        } else if (msg.media.kind === 'image' && IMAGE_TYPES.includes(mimetype)) {
          images.push({ base64: media.base64, mimetype });
          if (actor.papel === 'lider') {
            conversation.lastMediaDataUrl = `data:${mimetype};base64,${media.base64}`;
            flowMedia = { kind: 'image', mimetype, base64: media.base64 };
          }
        }
      }

      pushTurn(conversation, 'user', images.length ? `[imagem] ${text}` : text);

      let resposta = null;

      // Líder: menus guiados (números) antes da IA. Opções abertas viram pedido ao agente.
      if (actor.papel === 'lider' && !MENU_FORCE.test(plain.trim())) {
        const flow = await handleFlow({ text: plain, media: flowMedia, audioSegundos: msg.media?.seconds, actor, conversation });
        if (typeof flow === 'string') resposta = flow;
        else if (flow?.agente) text = flow.agente;
        else if (conversation.state && !AGENT_STATES.includes(conversation.state.tipo)) {
          // Resposta livre no meio de um menu: a IA assume, sabendo onde o líder estava.
          conversation.state = conversation.state.contexto ? { tipo: 'contexto', contexto: conversation.state.contexto } : null;
        }
      }

      // Membro: opção numérica do menu → pedido em linguagem natural para o agente.
      if (actor.papel === 'membro' && conversation.state?.tipo === 'menu' && /^\s*\d{1,2}\s*$/.test(plain)) {
        const pedido = MENU.membro[Number(plain.trim())];
        conversation.state = null;
        if (pedido) text = pedido;
      }

      if (!resposta) resposta = await fastPath({ text: plain, actor, conversation });
      if (!resposta) resposta = await runAgent({ actor, conversation, input: { text, images } });
      // Um "contexto" vale só para a próxima resposta da IA.
      if (conversation.state?.tipo === 'contexto' && conversation.state.usado) conversation.state = null;
      else if (conversation.state?.tipo === 'contexto') conversation.state.usado = true;
      if (!resposta) resposta = templates.agenteIndisponivel();

      pushTurn(conversation, 'assistant', resposta);
      conversation.markModified('state');
      await conversation.save();
      await reply(chave, resposta);
    } catch (err) {
      console.error('[INBOUND] Erro ao processar mensagem:', err?.stack || err?.message || err);
      const texto = err.code === 'PLAN_LIMIT' ? templates.agenteLimitePlano() : templates.agenteIndisponivel();
      conversation.markModified('state');
      await conversation.save().catch(() => {});
      await reply(chave, texto).catch(() => {});
    }
  });
};

// Exposto para o scheduler: abre a chamada da EBD na conversa do líder.
const openChamada = async ({ lider, classe, congregacao, isoDate, roster }) => {
  const chave = whatsapp.sanitizeNumber(lider.celular);
  await Conversation.findOneAndUpdate(
    { canal: 'whatsapp', chave },
    {
      $setOnInsert: { canal: 'whatsapp', chave },
      $set: {
        papel: 'lider',
        nome: lider.nome,
        state: { tipo: 'chamada', classe, congregacao, data: isoDate, rosterIds: roster.map((p) => String(p._id)), rosterNomes: roster.map((p) => p.nome) },
      },
    },
    { upsert: true },
  );
};

// Exposto para o scheduler: abre a chamada de um encontro de grupo na conversa do líder.
const openChamadaEncontro = async ({ lider, grupo, isoDate, roster }) => {
  const chave = whatsapp.sanitizeNumber(lider.celular);
  await Conversation.findOneAndUpdate(
    { canal: 'whatsapp', chave },
    {
      $setOnInsert: { canal: 'whatsapp', chave },
      $set: {
        papel: 'lider',
        nome: lider.nome,
        state: {
          tipo: 'chamada_encontro', grupoId: String(grupo._id), grupoNome: grupo.nome, data: isoDate,
          rosterIds: roster.map((p) => String(p._id)), rosterNomes: roster.map((p) => p.nome),
        },
      },
    },
    { upsert: true },
  );
};

module.exports = { handleInbound, openChamada, openChamadaEncontro };
