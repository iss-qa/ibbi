const axios = require('axios');

const verifyRecaptcha = async (req, res, next) => {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  const minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE) || 0.5;

  if (!secret) return next();

  // RECAPTCHA_REQUIRED=true: sem token = bloqueio (senão basta omitir o token para pular a checagem).
  // Ative só com VITE_RECAPTCHA_SITE_KEY no build do front, ou todos os logins serão recusados.
  const required = process.env.RECAPTCHA_REQUIRED === 'true';
  const token = typeof req.body?.recaptchaToken === 'string' ? req.body.recaptchaToken : '';
  if (!token) {
    return required ? res.status(403).json({ message: 'Verificação de segurança ausente. Recarregue a página.' }) : next();
  }

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
    return required ? res.status(503).json({ message: 'Verificação de segurança indisponível. Tente novamente.' }) : next();
  }
};

module.exports = verifyRecaptcha;
