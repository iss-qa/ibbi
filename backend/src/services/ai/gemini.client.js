const crypto = require('crypto');
const usage = require('../usage.service');

// Google Gemini (generateContent) com o mesmo "formato de conversa" usado pelo agente
// (blocos text / image / tool_use / tool_result), para trocar de provedor sem mexer no loop.
const MODEL = () => process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

const isGeminiConfigured = () => Boolean(process.env.GEMINI_API_KEY);

class GeminiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// JSON Schema das tools → subconjunto OpenAPI aceito pelo Gemini.
const toGeminiSchema = (schema) => {
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  ['type', 'description', 'enum', 'required', 'format'].forEach((k) => { if (schema[k] !== undefined) out[k] = schema[k]; });
  if (schema.items) out.items = toGeminiSchema(schema.items);
  if (schema.properties) {
    out.properties = Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, toGeminiSchema(v)]));
  }
  return out;
};

const toFunctionDeclarations = (tools = []) => tools.map((t) => {
  const hasParams = t.input_schema?.properties && Object.keys(t.input_schema.properties).length;
  return { name: t.name, description: t.description, ...(hasParams ? { parameters: toGeminiSchema(t.input_schema) } : {}) };
});

const systemText = (system) => (Array.isArray(system) ? system.map((b) => b.text).join('\n\n') : system || '');

// Mensagens do agente → contents do Gemini.
const toContents = (messages = []) => {
  const toolNames = new Map(); // tool_use_id → nome (o Gemini responde por nome)
  return messages.map((m) => {
    const blocks = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content;
    const parts = [];
    for (const b of blocks) {
      if (b.type === 'text' && b.text) parts.push({ text: b.text });
      else if (b.type === 'image') parts.push({ inlineData: { mimeType: b.source.media_type, data: b.source.data } });
      else if (b.type === 'tool_use') {
        toolNames.set(b.id, b.name);
        // Reenvia a parte original (com thoughtSignature), exigida pelos modelos com raciocínio.
        parts.push(b._geminiPart || { functionCall: { name: b.name, args: b.input || {} } });
      } else if (b.type === 'tool_result') {
        let response;
        try {
          response = JSON.parse(b.content);
        } catch {
          response = { resultado: b.content };
        }
        if (b.is_error) response = { erro: typeof response === 'object' ? response : String(response) };
        parts.push({ functionResponse: { name: toolNames.get(b.tool_use_id) || 'tool', response: Array.isArray(response) ? { itens: response } : response } });
      }
    }
    return { role: m.role === 'assistant' ? 'model' : 'user', parts: parts.length ? parts : [{ text: '...' }] };
  });
};

let callSeq = 0;
// Resposta do Gemini → formato do agente (content / stop_reason / usage).
const fromResponse = (json) => {
  const cand = json.candidates?.[0];
  const content = [];
  for (const part of cand?.content?.parts || []) {
    if (part.functionCall) {
      callSeq += 1;
      content.push({ type: 'tool_use', id: `gem_${Date.now()}_${callSeq}`, name: part.functionCall.name, input: part.functionCall.args || {}, _geminiPart: part });
    } else if (part.text && !part.thought) {
      content.push({ type: 'text', text: part.text });
    }
  }
  const blocked = json.promptFeedback?.blockReason || ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'].includes(cand?.finishReason);
  let stopReason = 'end_turn';
  if (blocked) stopReason = 'refusal';
  else if (content.some((c) => c.type === 'tool_use')) stopReason = 'tool_use';
  else if (cand?.finishReason === 'MAX_TOKENS') stopReason = 'max_tokens';
  return {
    content,
    stop_reason: stopReason,
    usage: {
      input_tokens: json.usageMetadata?.promptTokenCount || 0, // inclui os tokens lidos do cache
      cached_tokens: json.usageMetadata?.cachedContentTokenCount || 0,
      output_tokens: (json.usageMetadata?.candidatesTokenCount || 0) + (json.usageMetadata?.thoughtsTokenCount || 0),
      thinking_tokens: json.usageMetadata?.thoughtsTokenCount || 0,
    },
    model: json.modelVersion || MODEL(), // versão exata que respondeu (ex.: gemini-3.8-flash-001)
  };
};

// ── Cache de contexto explícito ──────────────────────────────────────────
// Instruções fixas + ferramentas (~4 mil tokens) ficam num cachedContent por igreja/papel/conjunto
// de tools. Leitura de cache custa 10x menos que entrada normal; o armazenamento é cobrado por hora,
// então o TTL é curto e renovado enquanto houver conversa. Falhou? Segue sem cache.
const CACHE_TTL_SEG = Number(process.env.GEMINI_CACHE_TTL_SEG) || 600;
const CACHE_RENOVAR_MS = 3 * 60e3; // renova quando faltar menos que isso
const caches = new Map(); // chave → { name, expira } | { semCache: true }
const cacheKey = (sys, decls) => crypto.createHash('sha1').update(`${MODEL()}|${sys}|${JSON.stringify(decls)}`).digest('hex');

const geminiFetch = (path, method, payload) => fetch(`${BASE_URL}/${path}`, {
  method,
  headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
  body: payload ? JSON.stringify(payload) : undefined,
  signal: AbortSignal.timeout(30 * 1000),
});

const cachedContentFor = async (sys, decls, toolConfig) => {
  if (process.env.GEMINI_CACHE === 'off') return null;
  const key = cacheKey(sys, decls);
  const atual = caches.get(key);
  if (atual?.semCache) return null;
  const agora = Date.now();
  if (atual && atual.expira - agora > CACHE_RENOVAR_MS) return atual.name;
  try {
    if (atual && atual.expira > agora + 5e3) {
      const r = await geminiFetch(`${atual.name}?updateMask=ttl`, 'PATCH', { ttl: `${CACHE_TTL_SEG}s` });
      if (r.ok) {
        atual.expira = agora + CACHE_TTL_SEG * 1000;
        return atual.name;
      }
    }
    const r = await geminiFetch('cachedContents', 'POST', {
      model: `models/${MODEL()}`,
      systemInstruction: { parts: [{ text: sys }] },
      tools: [{ functionDeclarations: decls }],
      toolConfig,
      ttl: `${CACHE_TTL_SEG}s`,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.name) {
      // Ex.: conteúdo abaixo do mínimo do modelo. Não tenta de novo para este prompt.
      console.warn(`[IA] Cache de contexto indisponível (${r.status}): ${j?.error?.message || 'sem nome'}`);
      caches.set(key, { semCache: true });
      return null;
    }
    caches.set(key, { name: j.name, expira: agora + CACHE_TTL_SEG * 1000 });
    return j.name;
  } catch (err) {
    console.warn('[IA] Falha ao criar cache de contexto:', err.message);
    return null;
  }
};

const createMessage = async ({ system, tools, messages, max_tokens: maxTokens = 8000 }, { countInteraction = true, operacao = 'agente' } = {}) => {
  const inicio = Date.now();
  const body = {
    contents: toContents(messages),
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 },
  };
  const sys = systemText(system);
  const decls = tools?.length ? toFunctionDeclarations(tools) : null;
  const toolConfig = { functionCallingConfig: { mode: 'AUTO' } };
  const cacheName = sys && decls ? await cachedContentFor(sys, decls, toolConfig) : null;
  if (cacheName) {
    body.cachedContent = cacheName; // sistema, tools e toolConfig já estão no cache
  } else {
    if (sys) body.systemInstruction = { parts: [{ text: sys }] };
    if (decls) {
      body.tools = [{ functionDeclarations: decls }];
      body.toolConfig = toolConfig;
    }
  }

  const res = await fetch(`${BASE_URL}/models/${MODEL()}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120 * 1000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && cacheName && /cache/i.test(json?.error?.message || '')) {
    // Cache expirou do lado do Google antes do previsto: esquece e refaz sem ele.
    for (const [k, v] of caches) if (v.name === cacheName) caches.delete(k);
    return createMessage({ system, tools, messages, max_tokens: maxTokens }, { countInteraction, operacao });
  }
  if (!res.ok) throw new GeminiError(res.status, json?.error?.message || `Gemini HTTP ${res.status}`);

  const response = fromResponse(json);
  await usage.recordAi({
    provider: 'gemini',
    model: MODEL(),
    modelVersion: response.model,
    operacao,
    countInteraction,
    input: response.usage.input_tokens,
    cached: response.usage.cached_tokens,
    output: response.usage.output_tokens,
    thinking: response.usage.thinking_tokens,
    ms: Date.now() - inicio,
  });
  return response;
};

// Transcrição nativa de áudio (o Gemini entende áudio diretamente).
const transcribeAudio = async (base64, mimetype = 'audio/ogg') => {
  const inicio = Date.now();
  const res = await fetch(`${BASE_URL}/models/${MODEL()}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [
        { inlineData: { mimeType: mimetype.split(';')[0], data: base64 } },
        { text: 'Transcreva este áudio em português do Brasil, literalmente, sem comentários.' },
      ] }],
      generationConfig: { temperature: 0 },
    }),
    signal: AbortSignal.timeout(120 * 1000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new GeminiError(res.status, json?.error?.message || `Gemini HTTP ${res.status}`);
  const um = json.usageMetadata || {};
  const saida = (um.candidatesTokenCount || 0) + (um.thoughtsTokenCount || 0);
  await usage.recordAi({
    provider: 'gemini',
    model: MODEL(),
    modelVersion: json.modelVersion || MODEL(),
    operacao: 'transcricao',
    input: um.promptTokenCount || 0,
    cached: um.cachedContentTokenCount || 0,
    output: saida,
    thinking: um.thoughtsTokenCount || 0,
    ms: Date.now() - inicio,
  });
  return (json.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
};

module.exports = { MODEL, GeminiError, isGeminiConfigured, createMessage, transcribeAudio };
