const axios = require('axios');

const verifyRecaptcha = async (req, res, next) => {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  const minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE) || 0.5;

  // Se reCAPTCHA não está configurado, pular verificação
  if (!secret) return next();

  const token = req.body.recaptchaToken;
  if (!token) return next();

  try {
    const { data } = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: { secret, response: token },
    });

    if (!data.success) {
      console.error('[RECAPTCHA] Falha:', data['error-codes']);
      return res.status(403).json({
        message: 'Verificação de segurança falhou. Tente novamente.',
        debug: data['error-codes'],
      });
    }

    if (data.score < minScore) {
      console.warn('[RECAPTCHA] Score baixo:', data.score);
      return res.status(403).json({
        message: 'Verificação de segurança falhou. Tente novamente.',
        debug: `score: ${data.score}`,
      });
    }

    return next();
  } catch (err) {
    console.error('[RECAPTCHA] Erro:', err.message);
    return next();
  }
};

module.exports = verifyRecaptcha;
