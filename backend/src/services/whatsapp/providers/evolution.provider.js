const axios = require('axios');
const https = require('https');

// Evolution API v2 (WhatsApp não oficial via QR Code). Suporta grupos (JID …@g.us).
const createEvolutionProvider = ({ url, instance, apiKey, allowSelfSigned }) => {
  if (!url || !instance || !apiKey) throw new Error('Configuração Evolution API incompleta');
  const baseUrl = String(url).replace(/\/$/, '');
  const httpsAgent = allowSelfSigned ? new https.Agent({ rejectUnauthorized: false }) : undefined;
  const headers = { apikey: apiKey, 'Content-Type': 'application/json' };

  const post = async (path, payload, timeout = 15000) => {
    try {
      const response = await axios.post(`${baseUrl}${path}/${encodeURIComponent(instance)}`, payload, { headers, timeout, httpsAgent });
      return response.data;
    } catch (err) {
      const data = err?.response?.data;
      console.error('Evolution API erro:', err?.response?.status, data || err.message);
      throw new Error(data?.response?.message?.[0] || data?.message || err.message || 'Falha ao enviar WhatsApp');
    }
  };

  const toBase64 = async (media) => {
    if (String(media).startsWith('http')) {
      const response = await axios.get(media, { responseType: 'arraybuffer', timeout: 20000 });
      return Buffer.from(response.data, 'binary').toString('base64');
    }
    return String(media).replace(/^data:[a-z]+\/[a-z0-9.+-]+;base64,/i, '');
  };

  return {
    name: 'evolution',
    supportsGroups: true,
    requiresTemplates: false,

    // delay = "digitando…" antes do envio (anti-bloqueio)
    sendText: (number, text, { typingMs = 0 } = {}) => post('/message/sendText', { number, text, ...(typingMs ? { delay: typingMs } : {}) }, 15000 + typingMs),

    sendImage: async (number, media, caption = '') => post('/message/sendMedia', {
      number,
      delay: 1200,
      mediatype: 'image',
      media: await toBase64(media),
      caption,
    }, 25000),

    sendAudio: async (number, media) => post('/message/sendWhatsAppAudio', {
      number,
      audio: await toBase64(media),
    }, 25000),

    // Cartão de contato (vCard) para o destinatário salvar o número com um toque.
    sendContact: (number, { fullName, phoneNumber, organization }) => post('/message/sendContact', {
      number,
      contact: [{ fullName, wuid: String(phoneNumber).replace(/\D/g, ''), phoneNumber: `+${String(phoneNumber).replace(/\D/g, '')}`, organization }],
    }),

    // Botões são instáveis na API não oficial: degrada para texto com opções numeradas.
    sendButtons: (number, text, buttons) => post('/message/sendText', {
      number,
      text: `${text}\n\n${buttons.map((b, i) => `*${i + 1}* - ${b.title}`).join('\n')}`,
    }),

    getMediaBase64: async (messageKeyId) => {
      const data = await post('/chat/getBase64FromMediaMessage', {
        message: { key: { id: messageKeyId } },
        convertToMp4: false,
      }, 30000);
      return { base64: data?.base64, mimetype: data?.mimetype };
    },

    // Grupos (exclusivo da API não oficial)
    listGroups: async () => {
      try {
        const res = await axios.get(`${baseUrl}/group/fetchAllGroups/${encodeURIComponent(instance)}`, {
          headers, params: { getParticipants: false }, timeout: 90000, httpsAgent,
        });
        return (Array.isArray(res.data) ? res.data : []).map((g) => ({ jid: g.id, nome: g.subject, participantes: g.size }));
      } catch (err) {
        throw new Error(err?.response?.data?.response?.message?.[0] || err?.response?.data?.message || err.message);
      }
    },

    createGroup: async (subject, participants, description = '') => {
      const data = await post('/group/create', { subject, description, participants }, 30000);
      return { jid: data?.id || data?.groupJid || data?.gid, nome: data?.subject || subject };
    },

    connectionState: async () => {
      try {
        const res = await axios.get(`${baseUrl}/instance/connectionState/${encodeURIComponent(instance)}`, { headers, timeout: 15000, httpsAgent });
        const state = res.data?.instance?.state || res.data?.state || 'unknown';
        return { online: state === 'open' || state === 'connected', state };
      } catch (err) {
        return { online: false, error: `HTTP ${err?.response?.status || '?'} — ${err?.response?.data?.message || err.message}` };
      }
    },

    describe: () => ({ provider: 'evolution', url: baseUrl, instance }),
  };
};

module.exports = { createEvolutionProvider };
