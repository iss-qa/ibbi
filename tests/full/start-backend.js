// Sobe o backend da suíte E2E com ambiente controlado:
// 1) zera TODAS as variáveis do .env real (dotenv não sobrescreve variável já definida, nem vazia);
// 2) aplica o ambiente de teste (config.js); 3) recria o banco de teste (seed.js); 4) inicia o servidor.
const fs = require('fs');
const path = require('path');
const E2E = require('./config');

const envReal = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envReal)) {
  fs.readFileSync(envReal, 'utf8').split('\n').forEach((linha) => {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (m) process.env[m[1]] = '';
  });
}
Object.assign(process.env, E2E.backendEnv);

(async () => {
  await require('./seed').seed();
  process.chdir(path.resolve(__dirname, '../../backend'));
  require(path.resolve(__dirname, '../../backend/server.js'));
})().catch((err) => {
  console.error('[e2e] falha ao subir o backend:', err);
  process.exit(1);
});
