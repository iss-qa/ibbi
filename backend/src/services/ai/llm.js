const claude = require('./claude.client');
const gemini = require('./gemini.client');

/**
 * Provedor de IA ativo. AI_PROVIDER=anthropic | gemini.
 * Sem AI_PROVIDER: usa Anthropic se houver ANTHROPIC_API_KEY, senão Gemini se houver GEMINI_API_KEY.
 * Ambos expõem o mesmo formato (content com text/tool_use, stop_reason, usage).
 */
const provider = () => {
  const explicit = String(process.env.AI_PROVIDER || '').toLowerCase();
  if (explicit === 'gemini' || explicit === 'anthropic') return explicit;
  if (claude.isAiConfigured()) return 'anthropic';
  if (gemini.isGeminiConfigured()) return 'gemini';
  return null;
};

const isAiConfigured = () => {
  const p = provider();
  if (p === 'anthropic') return claude.isAiConfigured();
  if (p === 'gemini') return gemini.isGeminiConfigured();
  return false;
};

const createMessage = (params, opts) => (provider() === 'gemini'
  ? gemini.createMessage(params, opts)
  : claude.createMessage(params, opts));

const modelName = () => (provider() === 'gemini' ? gemini.MODEL() : claude.MODEL());

const GEMINI_MIN_TOKENS = 4000;

// Texto simples (mensagens pastorais, resumos). null se indisponível → chamador usa template.
const generateText = async ({ system, prompt, maxTokens = 2000 }) => {
  if (!isAiConfigured()) return null;
  if (provider() === 'anthropic') return claude.generateText({ system, prompt, maxTokens });
  try {
    // O Gemini gasta parte do limite "pensando" antes do texto: limites baixos cortam a resposta.
    const response = await gemini.createMessage({ system, max_tokens: Math.max(maxTokens, GEMINI_MIN_TOKENS), messages: [{ role: 'user', content: prompt }] });
    if (response.stop_reason === 'refusal') return null;
    return claude.textOf(response) || null;
  } catch (err) {
    console.error(`[IA] Gemini falhou (${err.status || '?'}):`, err.message);
    return null;
  }
};

module.exports = { provider, isAiConfigured, createMessage, generateText, textOf: claude.textOf, modelName };
