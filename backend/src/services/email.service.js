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

const sendEmail = async ({ to, subject, text, html }) => {
  const t = getTransporter();
  if (!t) throw new Error('Transporter SMTP não configurado');

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  const info = await t.sendMail({ from, to, subject, text, html });
  console.log(`[EMAIL] Enviado para ${to} — messageId: ${info.messageId}`);
  return info;
};

module.exports = { sendEmail };
