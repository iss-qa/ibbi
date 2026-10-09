const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');
const axios = require('axios');

// Proteção contra SSRF em requisições de saída para URLs que vêm de usuário/tenant
// (URL da Evolution configurada pela igreja, mídia remota). Bloqueia loopback, redes
// privadas, link-local (metadata da nuvem), CGNAT e afins — tanto em IP literal quanto
// no IP resolvido pelo DNS (o lookup do agent valida na hora da conexão: sem DNS rebinding).

const BLOCKED_V4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3],
];
const v4ToInt = (ip) => ip.split('.').reduce((acc, o) => (acc * 256) + Number(o), 0);
const isPrivateV4 = (ip) => {
  const n = v4ToInt(ip);
  return BLOCKED_V4.some(([base, bits]) => {
    const size = 2 ** (32 - bits);
    const start = v4ToInt(base);
    return n >= start && n < start + size;
  });
};
const isPrivateIp = (ip) => {
  if (net.isIPv4(ip)) return isPrivateV4(ip);
  if (!net.isIPv6(ip)) return true;
  const v = ip.toLowerCase();
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateV4(mapped[1]);
  // IPv4 mapeado em hexa (o parser de URL normaliza [::ffff:127.0.0.1] para [::ffff:7f00:1])
  const mappedHex = v.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isPrivateV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith('ff');
};

// Hosts liberados explicitamente pelo operador da plataforma (ex.: Evolution na rede interna do Docker).
const allowedHosts = () => String(process.env.OUTBOUND_ALLOWED_HOSTS || '')
  .split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
const isAllowedHost = (host) => allowedHosts().includes(String(host || '').toLowerCase());

const safeLookup = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const bad = addresses.find((a) => isPrivateIp(a.address));
    if (bad && !isAllowedHost(hostname)) {
      return callback(Object.assign(new Error(`Destino bloqueado (rede interna): ${hostname}`), { code: 'EBLOCKED' }));
    }
    if (options && options.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  });
};

/** Valida a URL de forma síncrona (protocolo, credenciais embutidas, IP literal interno). */
const checkOutboundUrl = (value, { allowHttp = false } = {}) => {
  let u;
  try {
    u = new URL(String(value || '').trim());
  } catch {
    return { ok: false, reason: 'URL inválida' };
  }
  if (!(u.protocol === 'https:' || (allowHttp && u.protocol === 'http:'))) return { ok: false, reason: 'Use uma URL https://' };
  if (u.username || u.password) return { ok: false, reason: 'URL não pode conter usuário/senha' };
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (isAllowedHost(host)) return { ok: true, url: u };
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, reason: 'Endereço interno não permitido' };
  }
  if (net.isIP(host) && isPrivateIp(host)) return { ok: false, reason: 'Endereço interno não permitido' };
  if (!net.isIP(host) && !host.includes('.')) return { ok: false, reason: 'Endereço interno não permitido' };
  return { ok: true, url: u };
};

const assertOutboundUrl = (value, opts) => {
  const r = checkOutboundUrl(value, opts);
  if (!r.ok) throw Object.assign(new Error(r.reason), { status: 400 });
  return r.url;
};

const safeHttpAgent = new http.Agent({ lookup: safeLookup });
const createSafeHttpsAgent = (extra = {}) => new https.Agent({ lookup: safeLookup, ...extra });
const safeHttpsAgent = createSafeHttpsAgent();

/** Baixa mídia remota com SSRF guard, sem redirect e com teto de tamanho. */
const MAX_MEDIA_BYTES = 16 * 1024 * 1024;
const fetchRemoteMedia = async (url, { maxBytes = MAX_MEDIA_BYTES, timeout = 20000 } = {}) => {
  assertOutboundUrl(url);
  const res = await axios.get(url, {
    responseType: 'arraybuffer', timeout, maxRedirects: 0, maxContentLength: maxBytes,
    httpAgent: safeHttpAgent, httpsAgent: safeHttpsAgent,
  });
  return { buffer: Buffer.from(res.data), mime: String(res.headers['content-type'] || '').split(';')[0].trim() };
};

module.exports = {
  isPrivateIp, checkOutboundUrl, assertOutboundUrl, safeLookup,
  safeHttpAgent, safeHttpsAgent, createSafeHttpsAgent, fetchRemoteMedia,
};
