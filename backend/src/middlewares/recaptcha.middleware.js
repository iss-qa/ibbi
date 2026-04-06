const axios = require('axios');

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY;
const MIN_SCORE = parseFloat(process.env.RECAPTCHA_MIN_SCORE) || 0.5;

const verifyRecaptcha = async (req, res, next) => {
  // Se reCAPTCHA não está configurado, pular verificação
  if (!RECAPTCHA_SECRET) return next();

  const token = req.body.recaptchaToken;
  if (!token) {
    return res.status(400).json({ message: 'Token reCAPTCHA não informado.' });
  }

  try {
    const { data } = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: { secret: RECAPTCHA_SECRET, response: token },
    });

    if (!data.success || data.score < MIN_SCORE) {
      return res.status(403).json({ message: 'Verificação de segurança falhou. Tente novamente.' });
    }

    return next();
  } catch (err) {
    console.error('[RECAPTCHA] Erro na verificação:', err.message);
    // Em caso de falha de comunicação com Google, permitir passagem (fail-open)
    return next();
  }
};

module.exports = verifyRecaptcha;
