const Layer = require('express/lib/router/layer');

// Express 4 não captura promises rejeitadas de handlers async: o erro vira
// unhandledRejection e derruba o processo. Aqui toda rejeição de handler/middleware
// é encaminhada para next(err) e cai no error handler do server.js.
// (Mesma técnica do pacote express-async-errors; carregar antes das rotas.)
const original = Layer.prototype.handle_request;

Layer.prototype.handle_request = function handleRequestWithAsync(req, res, next) {
  const fn = this.handle;
  if (fn.length > 3) return original.call(this, req, res, next);
  try {
    const ret = fn(req, res, next);
    if (ret && typeof ret.catch === 'function') ret.catch(next);
  } catch (err) {
    next(err);
  }
  return undefined;
};

// Status HTTP para erros conhecidos do Mongoose (antes caíam como 500 ou derrubavam o servidor).
const httpStatusFor = (err) => {
  if (err.status || err.statusCode) return err.status || err.statusCode;
  if (err.name === 'ValidationError' || err.name === 'CastError' || err.name === 'StrictModeError') return 400;
  if (err.code === 11000) return 409;
  if (err.type === 'entity.parse.failed') return 400;
  if (err.type === 'entity.too.large') return 413;
  return 500;
};

module.exports = { httpStatusFor };
