// Preço dos modelos de IA em US$ por 1 milhão de tokens, com vigência (o custo é gravado no
// momento da chamada, em AiUsageEvent / UsageCounter.iaCustoUsd). Saída inclui os tokens de
// "pensamento". cached = leitura do cache; cacheWrite = escrita no cache (Claude: TTL de 5 min).
// Modelo fora da tabela: AI_PRICE_INPUT_USD / AI_PRICE_CACHED_USD / AI_PRICE_OUTPUT_USD no .env.
// Fontes: tabela oficial da Anthropic (preços de 06/10/2026) e do Google (gemini-3.8-flash:
// preço introdutório até 31/12/2026). Revise ao trocar de modelo.

const claude = (input, output, cached, cacheWrite = input * 1.25) => [{ ate: null, input, output, cached, cacheWrite }];

const PRICES = {
  'gemini-3.8-flash': [
    { ate: '2026-12-31', input: 0.75, cached: 0.075, output: 3.75 },
    { ate: null, input: 1.5, cached: 0.15, output: 7.5 },
  ],
  // Anthropic — cache: leitura 0,1× a entrada (exceções abaixo), escrita 1,25×
  'claude-fable-5-1': claude(10, 50, 0.25),
  'claude-mythos-5-1': claude(10, 50, 0.25),
  'claude-fable-5': claude(10, 50, 1),
  'claude-opus-5-5': claude(4, 20, 0.2),
  'claude-opus-5': claude(5, 25, 0.5),
  'claude-opus-4-8': claude(5, 25, 0.5),
  'claude-opus-4-7': claude(5, 25, 0.5),
  'claude-opus-4-6': claude(5, 25, 0.5),
  'claude-sonnet-5-5': claude(2, 10, 0.2),
  'claude-sonnet-5': claude(2, 10, 0.2),
  'claude-sonnet-4-6': claude(3, 15, 0.3),
  // Haiku 5.5: duas tabelas pelo tamanho do prompt (até 100 mil tokens / acima)
  'claude-haiku-5-5': [{ ate: null, input: 0.1, output: 0.5, cached: 0.01, cacheWrite: 0.125, longo: { acima: 100000, input: 0.5, output: 2.5, cached: 0.05, cacheWrite: 0.625 } }],
  'claude-haiku-4-5': claude(1, 5, 0.1),
};

// Transcrição de áudio cobrada por minuto (US$/min). Sobrescreva com TRANSCRIPTION_PRICE_USD_MIN.
const AUDIO_PRICES = {
  'whisper-1': 0.006,
  'gpt-4o-transcribe': 0.006,
  'gpt-4o-mini-transcribe': 0.003,
};

const PROVIDER_LABEL = { anthropic: 'Anthropic (Claude)', gemini: 'Google (Gemini)', openai: 'OpenAI', groq: 'Groq' };

const envPrice = () => {
  const input = Number(process.env.AI_PRICE_INPUT_USD);
  const output = Number(process.env.AI_PRICE_OUTPUT_USD);
  if (!input || !output) return null;
  return { input, output, cached: Number(process.env.AI_PRICE_CACHED_USD) || input / 10, cacheWrite: input * 1.25 };
};

// "claude-opus-5-5-20261001" ou "models/gemini-3.8-flash-001" → chave da tabela
const baseModel = (model) => {
  const m = String(model || '').toLowerCase().replace(/^models\//, '');
  if (PRICES[m]) return m;
  return Object.keys(PRICES).sort((a, b) => b.length - a.length).find((k) => m.startsWith(k)) || m;
};

const priceFor = (model, date = new Date()) => {
  const faixas = PRICES[baseModel(model)];
  if (!faixas) return envPrice();
  const dia = new Date(date).toISOString().slice(0, 10);
  return faixas.find((f) => !f.ate || dia <= f.ate) || faixas[faixas.length - 1];
};

const avisados = new Set();
// input = todos os tokens de entrada (inclusive lidos do cache e escritos no cache);
// cached = parte lida do cache; cacheWrite = parte escrita no cache (cacheWrite1h: TTL de 1h, 2× a entrada).
const costUsd = ({ model, input = 0, cached = 0, cacheWrite = 0, cacheWrite1h = 0, output = 0, date }) => {
  let p = priceFor(model, date);
  if (!p) {
    if (!avisados.has(model)) console.warn(`[IA] Sem preço para o modelo ${model}: custo não registrado (defina AI_PRICE_*_USD).`);
    avisados.add(model);
    return 0;
  }
  if (p.longo && input > p.longo.acima) p = p.longo;
  const w5 = Math.max(0, (cacheWrite || 0) - (cacheWrite1h || 0));
  const normal = Math.max(0, (input || 0) - (cached || 0) - (cacheWrite || 0));
  return (normal * p.input + (cached || 0) * p.cached + w5 * (p.cacheWrite ?? p.input)
    + (cacheWrite1h || 0) * p.input * 2 + (output || 0) * p.output) / 1e6;
};

const audioCostUsd = ({ model, seconds = 0 }) => {
  const porMin = Number(process.env.TRANSCRIPTION_PRICE_USD_MIN) || AUDIO_PRICES[String(model || '').toLowerCase()] || 0;
  return (Math.max(0, seconds) / 60) * porMin;
};

// ── Câmbio ──────────────────────────────────────────────────────────────
// Cotação comercial do dólar (AwesomeAPI, sem chave), renovada a cada 6h. Falhou → USD_BRL
// do .env (ou 5,4). O custo em reais de cada chamada é gravado com a cotação do momento.
const FX_TTL_MS = 6 * 60 * 60 * 1000;
let fx = { valor: Number(process.env.USD_BRL) || 5.4, fonte: 'env', em: null };

const refreshUsdBrl = async () => {
  if (process.env.USD_BRL_FIXO === 'true' || process.env.NODE_ENV === 'test') return fx;
  if (fx.em && Date.now() - fx.em < FX_TTL_MS) return fx;
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', { signal: AbortSignal.timeout(5000) });
    const valor = Number((await res.json())?.USDBRL?.bid);
    if (res.ok && valor > 1 && valor < 20) fx = { valor, fonte: 'awesomeapi', em: Date.now() };
    else fx = { ...fx, em: Date.now() }; // não tenta de novo a cada chamada
  } catch {
    fx = { ...fx, em: Date.now() };
  }
  return fx;
};

const usdBrl = () => {
  refreshUsdBrl().catch(() => {});
  return fx.valor;
};
const usdBrlInfo = () => ({ valor: fx.valor, fonte: fx.fonte, atualizadoEm: fx.em ? new Date(fx.em) : null });

module.exports = { PRICES, AUDIO_PRICES, PROVIDER_LABEL, baseModel, priceFor, costUsd, audioCostUsd, usdBrl, usdBrlInfo, refreshUsdBrl };
