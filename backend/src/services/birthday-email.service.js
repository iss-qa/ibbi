const { sendEmail } = require('./email.service');
const {
  birthdayEmailSubject,
  birthdayEmailHtml,
  birthdayEmailText,
  CID_CARTAO,
} = require('../templates/birthday-email.template');

// Remetente fixo: a sede da igreja. Cai para SMTP_FROM/SMTP_USER se não definido.
const CHURCH_FROM = process.env.SMTP_FROM || process.env.SMTP_USER || 'ibbisede@gmail.com';

/**
 * Envia o email de Feliz Aniversário para o membro, com o cartão embutido.
 * @param {Object} person  - documento Person (precisa de nome e email)
 * @param {Buffer} imageBuffer - PNG do cartão (reaproveitado do envio WhatsApp)
 * @returns {Promise<Object|null>} info do nodemailer, ou null se sem email
 */
const sendBirthdayEmail = async (person, imageBuffer) => {
  if (!person || !person.email) return null;

  const attachments = imageBuffer
    ? [{
      filename: 'cartao-aniversario.png',
      content: imageBuffer,
      cid: CID_CARTAO, // referenciado no HTML como cid:cartao-aniversario
    }]
    : [];

  const info = await sendEmail({
    from: CHURCH_FROM,
    to: person.email,
    subject: birthdayEmailSubject(person.nome),
    text: birthdayEmailText(person),
    html: birthdayEmailHtml(person),
    attachments,
  });

  return info;
};

module.exports = { sendBirthdayEmail };
