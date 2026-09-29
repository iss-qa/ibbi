const crypto = require('crypto');

// AES-256-GCM para segredos de tenant (API keys de WhatsApp) armazenados no banco.
// DATA_ENCRYPTION_KEY: 32 bytes em hex (64 chars) ou base64. Sem ela, deriva do JWT_SECRET.
let cachedKey = null;
const getKey = () => {
  if (cachedKey) return cachedKey;
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (raw) {
    const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (buf.length !== 32) throw new Error('DATA_ENCRYPTION_KEY deve ter 32 bytes');
    cachedKey = buf;
  } else {
    console.warn('[CRYPTO] DATA_ENCRYPTION_KEY não configurada — derivando do JWT_SECRET.');
    cachedKey = crypto.createHash('sha256').update(String(process.env.JWT_SECRET || '')).digest();
  }
  return cachedKey;
};

const encrypt = (plain) => {
  if (plain === undefined || plain === null || plain === '') return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
};

const decrypt = (payload) => {
  if (!payload) return '';
  const [version, ivB64, tagB64, dataB64] = String(payload).split(':');
  if (version !== 'v1') return '';
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
};

const mask = (value) => {
  if (!value) return '';
  const s = String(value);
  return s.length <= 6 ? '••••' : `${s.slice(0, 3)}••••${s.slice(-3)}`;
};

const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString('hex');

module.exports = { encrypt, decrypt, mask, randomToken };
