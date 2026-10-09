// Diagnóstico do operador da plataforma — SOMENTE LEITURA, não mostra senhas.
// Uso (no container): node backend/src/scripts/check-platform-admin.js
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const env = String(process.env.PLATFORM_ADMIN_EMAIL || '').trim().replace(/^(['"])(.*)\1$/, '$2').toLowerCase();
  const senhaEnv = String(process.env.PLATFORM_ADMIN_PASSWORD || '').trim().replace(/^(['"])(.*)\1$/, '$2');
  console.log(`PLATFORM_ADMIN_EMAIL: ${JSON.stringify(process.env.PLATFORM_ADMIN_EMAIL || '')} · senha no env: ${senhaEnv.length} caractere(s)`);
  const users = await mongoose.connection.db.collection('platformusers').find().toArray();
  if (!users.length) console.log('Nenhum operador da plataforma no banco.');
  for (const u of users) {
    const confere = u.email === env ? ` · senha do env confere: ${await bcrypt.compare(senhaEnv, u.senha)}` : '';
    console.log(`- ${u.email} · ativo: ${u.ativo} · criado: ${u.createdAt?.toISOString?.() || '?'} · último login: ${u.ultimoLoginEm?.toISOString?.() || 'nunca'}${confere}`);
  }
  if (env && !users.some((u) => u.email === env)) console.log(`⚠️ ${env} não existe no banco (é criado na próxima subida do servidor).`);
  await mongoose.disconnect();
})().catch((err) => { console.error(err.message); process.exit(1); });
