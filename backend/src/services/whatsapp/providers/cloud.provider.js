const axios = require('axios');

// WhatsApp Business Platform — Cloud API oficial da Meta.
// Fora da janela de 24h desde a última mensagem do contato, só templates aprovados são entregues.
const GRAPH_VERSION = () => process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';

const createCloudProvider = ({ phoneNumberId, accessToken, templates = {} }) => {
  if (!phoneNumberId || !accessToken) throw new Error('Configuração WhatsApp Cloud API incompleta');
  const base = `https://graph.facebook.com/${GRAPH_VERSION()}`;
  const auth = { Authorization: `Bearer ${accessToken}` };

  const send = async (payload) => {
    try {
      const { data } = await axios.post(`${base}/${phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        ...payload,
      }, { headers: { ...auth, 'Content-Type': 'application/json' }, timeout: 20000 });
      return data;
    } catch (err) {
      const e = err?.response?.data?.error;
      console.error('WhatsApp Cloud API erro:', err?.response?.status, e || err.message);
      throw new Error(e?.error_user_msg || e?.message || err.message || 'Falha ao enviar WhatsApp');
    }
  };

  const uploadMedia = async (media, fallbackMime = 'image/jpeg') => {
    let buffer;
    let mime = fallbackMime;
    if (String(media).startsWith('http')) {
      const res = await axios.get(media, { responseType: 'arraybuffer', timeout: 20000 });
      buffer = Buffer.from(res.data);
      mime = res.headers['content-type'] || mime;
    } else {
      const match = String(media).match(/^data:([a-z]+\/[a-z0-9.+-]+);base64,/i);
      if (match) mime = match[1];
      buffer = Buffer.from(String(media).replace(/^data:[^;]+;base64,/, ''), 'base64');
    }
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mime);
    form.append('file', new Blob([buffer], { type: mime }), `arquivo.${mime.split('/')[1] || 'bin'}`);
    const res = await fetch(`${base}/${phoneNumberId}/media`, { method: 'POST', headers: auth, body: form });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || 'Falha no upload de mídia');
    return json.id;
  };

  return {
    name: 'cloud',
    supportsGroups: false,
    requiresTemplates: true,
    templates,

    sendText: (number, text) => send({ to: number, type: 'text', text: { body: text, preview_url: false } }),

    sendImage: async (number, media, caption = '') => send({
      to: number,
      type: 'image',
      image: { id: await uploadMedia(media), ...(caption ? { caption } : {}) },
    }),

    sendAudio: async (number, media) => send({
      to: number,
      type: 'audio',
      audio: { id: await uploadMedia(media, 'audio/ogg') },
    }),

    // Até 3 botões de resposta rápida (título ≤ 20 caracteres).
    sendButtons: (number, text, buttons) => send({
      to: number,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text },
        action: {
          buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: String(b.title).slice(0, 20) } })),
        },
      },
    }),

    sendContact: (number, { fullName, phoneNumber, organization }) => send({
      to: number,
      type: 'contacts',
      contacts: [{
        name: { formatted_name: fullName, first_name: fullName },
        phones: [{ phone: `+${String(phoneNumber).replace(/\D/g, '')}`, type: 'WORK', wa_id: String(phoneNumber).replace(/\D/g, '') }],
        ...(organization ? { org: { company: organization } } : {}),
      }],
    }),

    sendTemplate: (number, name, bodyParams = [], language = templates.idioma || 'pt_BR') => send({
      to: number,
      type: 'template',
      template: {
        name,
        language: { code: language },
        ...(bodyParams.length ? {
          components: [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text: String(text) })) }],
        } : {}),
      },
    }),

    getMediaBase64: async (mediaId) => {
      const { data: meta } = await axios.get(`${base}/${mediaId}`, { headers: auth, timeout: 15000 });
      const res = await axios.get(meta.url, { headers: auth, responseType: 'arraybuffer', timeout: 30000 });
      return { base64: Buffer.from(res.data).toString('base64'), mimetype: meta.mime_type };
    },

    connectionState: async () => {
      try {
        const { data } = await axios.get(`${base}/${phoneNumberId}`, {
          headers: auth,
          params: { fields: 'display_phone_number,verified_name,quality_rating' },
          timeout: 15000,
        });
        return { online: true, state: 'open', numero: data.display_phone_number, nome: data.verified_name, qualidade: data.quality_rating };
      } catch (err) {
        return { online: false, error: err?.response?.data?.error?.message || err.message };
      }
    },

    describe: () => ({ provider: 'cloud', phoneNumberId }),
  };
};

module.exports = { createCloudProvider };
