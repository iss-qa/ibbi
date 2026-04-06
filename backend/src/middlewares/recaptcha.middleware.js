const axios = require('axios');

const verifyRecaptcha = async (req, res, next) => {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  const minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE) || 0.5;

  console.log('[RECAPTCHA DEBUG] secret configurado:', !!secret);
  console.log('[RECAPTCHA DEBUG] token recebido:', !!req.body.recaptchaToken);

  // Se reCAPTCHA não está configurado, pular verificação
  if (!secret) {
    console.log('[RECAPTCHA DEBUG] Secret não configurado, pulando verificação');
    return next();
  }

  const token = req.body.recaptchaToken;
  if (!token) {
    // Frontend não enviou token — permitir passagem
    // (frontend pode não ter VITE_RECAPTCHA_SITE_KEY configurado)
    console.log('[RECAPTCHA DEBUG] Token não enviado pelo frontend, permitindo passagem');
    return next();
  }

  try {
    const { data } = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: { secret, response: token },
    });

    console.log('[RECAPTCHA DEBUG] Resposta Google:', JSON.stringify(data));

    if (!data.success) {
      console.error('[RECAPTCHA] Falha na validação:', data['error-codes']);
      return res.status(403).json({ message: 'Verificação de segurança falhou. Tente novamente.' });
    }

    if (data.score < minScore) {
      console.warn('[RECAPTCHA] Score baixo:', data.score, '(mínimo:', minScore, ')');
      return res.status(403).json({ message: 'Verificação de segurança falhou. Tente novamente.' });
    }

    console.log('[RECAPTCHA DEBUG] Verificação OK, score:', data.score);
    return next();
  } catch (err) {
    console.error('[RECAPTCHA] Erro na comunicação:', err.message);
    return next();
  }
};

module.exports = verifyRecaptcha;
