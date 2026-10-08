const Anthropic = require('@anthropic-ai/sdk');
const usage = require('../usage.service');
const { costUsd } = require('../../config/ai-pricing');

// Modelo padrão configurável. Para reduzir custo em alto volume, AI_MODEL pode apontar
// para um modelo menor (ex.: claude-sonnet-5) — avalie a qualidade antes de trocar.
const MODEL = () => process.env.AI_MODEL || 'claude-opus-5';
const EFFORT = () => process.env.AI_EFFORT || 'medium';
const FALLBACK_MODELS = new Set(['claude-opus-5', 'claude-fable-5-1']);

let client = null;
const isAiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const getClient = () => {
  if (!client) client = new Anthropic({ maxRetries: 2, timeout: 120 * 1000 });
  return client;
};

/**
 * Chamada única à Messages API com medição de consumo por tenant.
 * Em modelos com classificadores (Opus 5), usa fallback server-side por categoria de recusa.
 */
const createMessage = async (params, { countInteraction = true } = {}) => {
  const model = params.model || MODEL();
  const request = {
    model,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: EFFORT() },
    ...params,
  };
  if (FALLBACK_MODELS.has(model)) {
    request.betas = ['server-side-fallback-2026-07-01'];
    request.fallbacks = 'default';
  }

  const response = await getClient().beta.messages.create(request);

  const entrada = (response.usage?.input_tokens || 0)
    + (response.usage?.cache_read_input_tokens || 0)
    + (response.usage?.cache_creation_input_tokens || 0);
  await usage.increment({
    iaInputTokens: entrada,
    iaCachedTokens: response.usage?.cache_read_input_tokens || 0,
    iaOutputTokens: response.usage?.output_tokens || 0,
    iaCustoUsd: costUsd({ model, input: entrada, cached: response.usage?.cache_read_input_tokens || 0, output: response.usage?.output_tokens || 0 }),
    ...(countInteraction ? { iaInteracoes: 1 } : {}),
  });

  return response;
};

const textOf = (response) => (response?.content || [])
  .filter((b) => b.type === 'text')
  .map((b) => b.text)
  .join('\n')
  .trim();

// Geração de texto simples (mensagens pastorais, resumos). Retorna null se a IA estiver
// indisponível ou recusar — o chamador usa o template padrão.
const generateText = async ({ system, prompt, maxTokens = 2000 }) => {
  if (!isAiConfigured()) return null;
  try {
    const response = await createMessage({
      max_tokens: maxTokens,
      output_config: { effort: 'low' },
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    if (response.stop_reason === 'refusal') return null;
    return textOf(response) || null;
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) console.warn('[IA] Rate limit ao gerar texto');
    else if (err instanceof Anthropic.APIError) console.error(`[IA] Erro ${err.status}:`, err.message);
    else console.error('[IA] Falha ao gerar texto:', err.message);
    return null;
  }
};

module.exports = { Anthropic, MODEL, isAiConfigured, getClient, createMessage, generateText, textOf };
