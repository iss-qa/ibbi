// Entrada serverless da Vercel: reaproveita o mesmo app Express do backend/server.js
// (mesmas rotas, middlewares e multi-tenant). Scheduler, monitor da Evolution e fila
// anti-ban dependem de processo contínuo e não rodam aqui — o backend completo roda via Dockerfile.
const { app, init } = require('../backend/server');

module.exports = async (req, res) => {
  try {
    await init();
  } catch (err) {
    console.error('[api] Falha ao iniciar (MongoDB/tenancy):', err.message);
    return res.status(500).json({ message: 'Erro de conexão com banco de dados' });
  }
  return app(req, res);
};
