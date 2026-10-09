// Transcrição de áudios do WhatsApp: endpoint Whisper (TRANSCRIPTION_*) ou, sem ele, o Gemini.
// Qualquer endpoint compatível com /audio/transcriptions (Whisper): OpenAI, Groq, servidor próprio.
const gemini = require('./gemini.client');
const usage = require('../usage.service');

// Sem endpoint Whisper configurado, usa o Gemini (entende áudio nativamente).
const isTranscriptionConfigured = () => Boolean(process.env.TRANSCRIPTION_API_KEY) || gemini.isGeminiConfigured();

// seconds: duração do áudio (WhatsApp informa) — Whisper é cobrado por minuto.
const transcribe = async (base64, mimetype = 'audio/ogg', { seconds } = {}) => {
  const inicio = Date.now();
  if (!process.env.TRANSCRIPTION_API_KEY) {
    return gemini.isGeminiConfigured() ? gemini.transcribeAudio(base64, mimetype) : null;
  }
  const baseUrl = (process.env.TRANSCRIPTION_API_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const form = new FormData();
  const ext = (mimetype.split('/')[1] || 'ogg').split(';')[0];
  form.append('file', new Blob([Buffer.from(base64, 'base64')], { type: mimetype }), `audio.${ext}`);
  const model = process.env.TRANSCRIPTION_MODEL || 'whisper-1';
  form.append('model', model);
  form.append('language', 'pt');

  const res = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.TRANSCRIPTION_API_KEY}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `Falha na transcrição (HTTP ${res.status})`);
  await usage.recordAi({
    provider: /groq/i.test(baseUrl) ? 'groq' : 'openai',
    model,
    operacao: 'transcricao',
    // Sem a duração (raro), estima pelo tamanho: áudio do WhatsApp (opus) ≈ 2 KB/s
    audioSeconds: Number(seconds) || Math.max(1, Math.round(Buffer.byteLength(base64, 'base64') / 2000)),
    ms: Date.now() - inicio,
  });
  return json.text || '';
};

module.exports = { transcribe, isTranscriptionConfigured };
