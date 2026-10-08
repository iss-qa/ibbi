// Celulares são armazenados só com dígitos e DDD (sem 55). O WhatsApp entrega o número
// com 55 e, para alguns celulares antigos, sem o 9º dígito — geramos as variantes.
const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

const toLocal = (value) => {
  const d = onlyDigits(value);
  return d.startsWith('55') && d.length >= 12 ? d.slice(2) : d;
};

const phoneVariants = (value) => {
  const local = toLocal(value);
  if (!local) return [];
  const set = new Set([local]);
  if (local.length === 11 && local[2] === '9') set.add(local.slice(0, 2) + local.slice(3));
  if (local.length === 10) set.add(`${local.slice(0, 2)}9${local.slice(2)}`);
  [...set].forEach((v) => set.add(`55${v}`));
  return [...set];
};

const samePhone = (a, b) => {
  if (!a || !b) return false;
  const va = new Set(phoneVariants(a));
  return phoneVariants(b).some((v) => va.has(v));
};

// "5571999998888@s.whatsapp.net" → "5571999998888"
const fromJid = (jid) => onlyDigits(String(jid || '').split('@')[0].split(':')[0]);

module.exports = { onlyDigits, toLocal, phoneVariants, samePhone, fromJid };
