// Preço dos modelos de IA em US$ por 1 milhão de tokens, com vigência (o custo é gravado no
// momento da chamada, em UsageCounter.iaCustoUsd). Saída inclui os tokens de "pensamento".
// Modelo fora da tabela: use AI_PRICE_INPUT_USD / AI_PRICE_CACHED_USD / AI_PRICE_OUTPUT_USD no .env.
// Fonte (gemini-3.8-flash): preço introdutório até 31/12/2026; tabela cheia a partir de 01/01/2027.

const PRICES = {
  'gemini-3.8-flash': [
    { ate: '2026-12-31', input: 0.75, cached: 0.075, output: 3.75 },
    { ate: null, input: 1.5, cached: 0.15, output: 7.5 },
  ],
};

const envPrice = () => {
  const input = Number(process.env.AI_PRICE_INPUT_USD);
  const output = Number(process.env.AI_PRICE_OUTPUT_USD);
  if (!input || !output) return null;
  return { input, output, cached: Number(process.env.AI_PRICE_CACHED_USD) || input / 10 };
};

const priceFor = (model, date = new Date()) => {
  const override = envPrice();
  if (override) return override;
  const faixas = PRICES[String(model || '').toLowerCase()];
  if (!faixas) return null;
  const dia = date.toISOString().slice(0, 10);
  return faixas.find((f) => !f.ate || dia <= f.ate) || faixas[faixas.length - 1];
};

let avisado = false;
// input = todos os tokens de entrada (inclusive os lidos do cache); cached = parte que veio do cache.
const costUsd = ({ model, input = 0, cached = 0, output = 0, date }) => {
  const p = priceFor(model, date);
  if (!p) {
    if (!avisado) console.warn(`[IA] Sem preço para o modelo ${model}: custo não registrado (defina AI_PRICE_*_USD).`);
    avisado = true;
    return 0;
  }
  const naoCacheado = Math.max(0, input - cached);
  return (naoCacheado * p.input + cached * p.cached + output * p.output) / 1e6;
};

// Câmbio para exibir em reais no painel (ajuste USD_BRL no .env).
const usdBrl = () => Number(process.env.USD_BRL) || 5.4;

module.exports = { PRICES, priceFor, costUsd, usdBrl };
