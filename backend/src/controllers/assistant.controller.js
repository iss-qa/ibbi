const Conversation = require('../models/Conversation.model');
const { actorFromUser, runAgent } = require('../services/ai/agent.service');
const { isAiConfigured } = require('../services/ai/llm');
const { hasFeature } = require('../config/plans');

const MAX_HISTORY = 30;
const IMAGE_RE = /^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/;

const findConversation = (userId) => Conversation.findOneAndUpdate(
  { canal: 'web', chave: String(userId) },
  { $setOnInsert: { canal: 'web', chave: String(userId), papel: 'lider', userId } },
  { upsert: true, new: true },
);

// Assistente no painel web: o mesmo agente do WhatsApp, para líderes que abrem o sistema.
const chat = async (req, res) => {
  if (!hasFeature(req.tenant, 'agenteWhatsApp')) return res.status(403).json({ message: 'Assistente de IA disponível a partir do plano Crescer.' });
  if (!isAiConfigured()) return res.status(503).json({ message: 'IA não configurada no servidor (GEMINI_API_KEY ou ANTHROPIC_API_KEY).' });

  const mensagem = String(req.body?.mensagem || '').trim();
  const imagem = req.body?.imagem;
  if (!mensagem && !imagem) return res.status(400).json({ message: 'Mensagem vazia' });

  const conversation = await findConversation(req.user._id);
  const actor = await actorFromUser(req.user);
  const images = [];
  if (imagem) {
    const m = String(imagem).match(IMAGE_RE);
    if (!m) return res.status(400).json({ message: 'Imagem inválida' });
    if (!hasFeature(req.tenant, 'multimodal')) return res.status(403).json({ message: 'Leitura de imagens disponível no plano Multiplicar.' });
    images.push({ mimetype: m[1], base64: m[2] });
    conversation.lastMediaDataUrl = imagem;
  }

  try {
    const resposta = await runAgent({ actor, conversation, input: { text: mensagem, images }, channel: 'web' });
    conversation.history.push({ role: 'user', text: images.length ? `[imagem] ${mensagem}` : mensagem });
    conversation.history.push({ role: 'assistant', text: resposta });
    if (conversation.history.length > MAX_HISTORY) conversation.history = conversation.history.slice(-MAX_HISTORY);
    conversation.markModified('state');
    await conversation.save();
    return res.json({ resposta });
  } catch (err) {
    if (err.code === 'PLAN_LIMIT') return res.status(429).json({ message: err.message });
    console.error('[ASSISTENTE] Erro:', err?.message || err);
    return res.status(502).json({ message: 'O assistente não conseguiu responder agora. Tente novamente.' });
  }
};

const history = async (req, res) => {
  const conversation = await Conversation.findOne({ canal: 'web', chave: String(req.user._id) }).lean();
  res.json({ history: conversation?.history || [] });
};

const clear = async (req, res) => {
  await Conversation.updateOne({ canal: 'web', chave: String(req.user._id) }, { $set: { history: [], state: null } });
  res.json({ ok: true });
};

module.exports = { chat, history, clear };
