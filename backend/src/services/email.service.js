const nodemailer = require('nodemailer');

const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('[EMAIL] Configuração SMTP incompleta — emails desativados.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

let transporter = null;

const getTransporter = () => {
  if (!transporter) transporter = createTransporter();
  return transporter;
};

// Modo teste (FORCE_MOCK_RECIPIENT=true): emails vão para MOCK_EMAIL — ou não saem, se vazio —
// exceto os endereços em MOCK_ALLOWED_EMAILS.
const resolveEmailRecipients = (to) => {
  if (process.env.FORCE_MOCK_RECIPIENT !== 'true') return { to, subjectPrefix: '' };
  const allowed = (process.env.MOCK_ALLOWED_EMAILS || '').split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
  const lista = String(to || '').split(/[,;]/).map((e) => e.trim()).filter(Boolean);
  const liberados = lista.filter((e) => allowed.includes(e.toLowerCase()));
  const redirecionados = lista.filter((e) => !allowed.includes(e.toLowerCase()));
  const mock = process.env.MOCK_EMAIL;
  const destino = [...liberados, ...(redirecionados.length && mock ? [mock] : [])];
  if (redirecionados.length) console.warn(`[EMAIL] ⚠️  MODO MOCK — ${redirecionados.join(', ')} → ${mock || '(não enviado)'}`);
  return { to: [...new Set(destino)].join(', '), subjectPrefix: redirecionados.length ? `[TESTE → ${redirecionados.join(', ')}] ` : '' };
};

const sendEmail = async ({ to: originalTo, subject: originalSubject, text, html, attachments, from }) => {
  const t = getTransporter();
  if (!t) throw new Error('Transporter SMTP não configurado');
  const { to, subjectPrefix } = resolveEmailRecipients(originalTo);
  if (!to) return { messageId: null, mock: true };
  const subject = `${subjectPrefix}${originalSubject || ''}`;

  const fromAddress = from || process.env.SMTP_FROM || process.env.SMTP_USER;

  const info = await t.sendMail({ from: fromAddress, to, subject, text, html, attachments });
  console.log(`[EMAIL] Enviado para ${to} — messageId: ${info.messageId}`);
  return info;
};

module.exports = { sendEmail };
