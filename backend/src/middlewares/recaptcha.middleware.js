const axios = require('axios');

const verifyRecaptcha = async (req, res, next) => {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  const minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE) || 0.5;

  if (!secret) return next();

  const token = req.body.recaptchaToken;
  if (!token) return next();

  try {
    const { data } = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: { secret, response: token },
    });

    if (!data.success || data.score < minScore) {
      return res.status(403).json({ message: 'Verificação de segurança falhou. Tente novamente.' });
    }

    return next();
  } catch (err) {
    console.error('[RECAPTCHA] Erro na comunicação:', err.message);
    return next();
  }
};

module.exports = verifyRecaptcha;
