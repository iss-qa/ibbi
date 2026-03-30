const axios = require('axios');
const https = require('https');

const MIN_DELAY_MS = 30 * 1000;

const sanitizeNumber = (input) => {
  if (!input) return '';
  const digits = String(input).replace(/\D/g, '');
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
};

const resolveRecipient = (input) => {
  const mock = process.env.MOCK_WHATSAPP_NUMBER;
  const forceMock = process.env.FORCE_MOCK_RECIPIENT === 'true';
  if (forceMock && mock) {
    console.warn(`[WHATSAPP] ⚠️  MODO MOCK ATIVO — redirecionando ${input} → ${mock}`);
    return sanitizeNumber(mock);
  }
  return sanitizeNumber(input);
};

class WhatsAppQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.canceled = false;
    this.total = 0;
    this.sent = 0;
    this.errors = 0;
    this.lastSentAt = null;
  }

  getStatus() {
    return {
      total: this.total,
      enviado: this.sent,
      erro: this.errors,
      status: this.isProcessing ? 'enviando' : 'parado',
      pendente: this.queue.length,
    };
  }

  cancel() {
    this.queue = [];
    this.canceled = true;
    this.isProcessing = false;
  }

  async processNext() {
    if (this.isProcessing) return;
    if (this.queue.length === 0) return;

    this.isProcessing = true;
    this.canceled = false;

    while (this.queue.length > 0) {
      if (this.canceled) {
        this.isProcessing = false;
        return;
      }

      const job = this.queue.shift();
      if (this.lastSentAt) {
        const elapsed = Date.now() - this.lastSentAt;
        if (elapsed < MIN_DELAY_MS) {
          await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_MS - elapsed));
        }
      }
      try {
        await sendText(job.number, job.text);
        this.sent += 1;
        this.lastSentAt = Date.now();
        if (job.onSuccess) job.onSuccess();
      } catch (err) {
        this.errors += 1;
        this.lastSentAt = Date.now();
        if (job.onError) job.onError(err);
      }
    }

    this.isProcessing = false;
  }

  enqueueBatch(jobs) {
    this.total += jobs.length;
    if (!this.isProcessing && this.queue.length === 0 && jobs.length > 0) {
      const [first, ...rest] = jobs;
      this.queue.push(...rest);
      sendText(first.number, first.text)
        .then(() => {
          this.sent += 1;
          this.lastSentAt = Date.now();
          if (first.onSuccess) first.onSuccess();
        })
        .catch((err) => {
          this.errors += 1;
          this.lastSentAt = Date.now();
          if (first.onError) first.onError(err);
        })
        .finally(() => {
          this.processNext();
        });
      return;
    }
    this.queue.push(...jobs);
    this.processNext();
  }

  enqueueSingle(job) {
    this.total += 1;
    this.queue.push(job);
    this.processNext();
  }
}

const queue = new WhatsAppQueue();

const sendText = async (number, text) => {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const instance = process.env.EVOLUTION_INSTANCE;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!baseUrl || !instance || !apiKey) {
    throw new Error('Configuração Evolution API incompleta');
  }

  const url = `${baseUrl}/message/sendText/${instance}`;
  const payload = { number: resolveRecipient(number), text };

  const allowSelfSigned = process.env.EVOLUTION_ALLOW_SELF_SIGNED === 'true';
  const httpsAgent = allowSelfSigned ? new https.Agent({ rejectUnauthorized: false }) : undefined;

  try {
    const response = await axios.post(url, payload, {
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
      httpsAgent,
    });
    return response.data;
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error('Evolution API erro:', status, data || err.message);
    throw new Error(data?.message || err.message || 'Falha ao enviar WhatsApp');
  }
};

const sendMedia = async (number, caption, mediaUrl) => {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const instance = process.env.EVOLUTION_INSTANCE;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!baseUrl || !instance || !apiKey) {
    throw new Error('Configuração Evolution API incompleta');
  }

  const url = `${baseUrl}/message/sendMedia/${instance}`;
  
  let base64Media = '';
  try {
    const response = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
    base64Media = Buffer.from(response.data, 'binary').toString('base64');
  } catch (e) {
    throw new Error('Falha ao obter mídia');
  }

  const payload = { 
    number: resolveRecipient(number),
    mediatype: 'image',
    media: base64Media,
    caption
  };

  const allowSelfSigned = process.env.EVOLUTION_ALLOW_SELF_SIGNED === 'true';
  const httpsAgent = allowSelfSigned ? new https.Agent({ rejectUnauthorized: false }) : undefined;

  try {
    const response = await axios.post(url, payload, {
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 25000,
      httpsAgent,
    });
    return response.data;
  } catch (err) {
    throw new Error(err?.response?.data?.message || err.message || 'Falha ao enviar WhatsAppMedia');
  }
};

const sendSingle = async (celular, mensagem) => {
  await sendText(celular, mensagem);
};

const sendBatch = async (destinatarios, mensagem, onProgress) => {
  const getText = typeof mensagem === 'function' ? mensagem : () => mensagem;
  const jobs = destinatarios.map((dest) => ({
    number: dest.celular,
    text: getText(dest),
    onSuccess: () => onProgress && onProgress(dest, null),
    onError: (err) => onProgress && onProgress(dest, err),
  }));

  queue.enqueueBatch(jobs);
};

const cancelQueue = () => queue.cancel();
const getQueueStatus = () => queue.getStatus();

module.exports = {
  sendSingle,
  sendBatch,
  cancelQueue,
  getQueueStatus,
  sendMedia,
};
