// Aceita qualquer valor (ex.: ?search[]=a chega como array e derrubava com "str.replace is not a function")
const escapeRegex = (str) => String(Array.isArray(str) ? str[0] ?? '' : str ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Remove objetos da querystring (?status[$ne]=x vira { $ne: 'x' } e entra como operador no filtro Mongo).
// Strings e arrays de strings seguem normalmente.
const sanitizeQuery = (req, res, next) => {
  Object.keys(req.query || {}).forEach((key) => {
    const value = req.query[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) delete req.query[key];
    else if (Array.isArray(value)) req.query[key] = value.filter((v) => typeof v === 'string');
  });
  next();
};

// Paginação com teto (o front usa até 9999 para listas completas)
const MAX_PAGE_LIMIT = 10000;
const pageParams = (query, defaultLimit = 20) => {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), MAX_PAGE_LIMIT);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  return { page, limit, skip: (page - 1) * limit };
};

// Foto: só data URI base64 de imagem (gerada pelo upload) ou arquivo em /uploads/ sem "..".
// Qualquer outra coisa vira SSRF/injeção de HTML no Puppeteer que renderiza os cards.
const DATA_IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/;
const UPLOAD_PATH_RE = /^\/uploads\/[A-Za-z0-9._-]+$/;
const sanitizeFotoUrl = (url) => {
  if (url === null || url === '') return url;
  if (typeof url !== 'string') return undefined;
  if (DATA_IMAGE_RE.test(url)) return url;
  if (UPLOAD_PATH_RE.test(url) && !url.includes('..')) return url;
  return undefined;
};

// Campos que o formulário público (convite) pode enviar; o resto é interno da igreja.
const PUBLIC_PERSON_FIELDS = [
  'nome', 'sexo', 'dataNascimento', 'email', 'celular', 'tipo', 'grupo', 'estadoCivil',
  'batizado', 'dataBatismo', 'dataCasamento', 'congregacao', 'endereco', 'ministerio',
  'fotoUrl', 'dataVisita', 'dataDecisao',
];
const pickFields = (obj, fields) => Object.fromEntries(
  fields.filter((f) => obj && Object.prototype.hasOwnProperty.call(obj, f)).map((f) => [f, obj[f]]),
);

module.exports = {
  escapeRegex, sanitizeQuery, pageParams, sanitizeFotoUrl, PUBLIC_PERSON_FIELDS, pickFields,
};
