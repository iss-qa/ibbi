// Cria usuários de teste para desenvolvimento local (idempotente).
// Uso: npm run seed:dev   — nunca roda com NODE_ENV=production.
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });
const { runInTenant } = require('./tenant-script');
const Person = require('../models/Person.model');
const User = require('../models/User.model');

const isLocalDb = /^mongodb:\/\/([^@/]*@)?(localhost|127\.0\.0\.1)(:\d+)?\//.test(process.env.MONGO_URI || '');
if (process.env.NODE_ENV === 'production' || (!isLocalDb && process.env.ALLOW_DEV_SEED !== 'true')) {
  console.error('seed-dev-users só roda contra MongoDB local (ou com ALLOW_DEV_SEED=true), nunca em produção.');
  process.exit(1);
}

const DEV_USERS = [
  { login: 'membro.teste', nome: 'Membro Teste', role: 'user', senha: process.env.DEV_MEMBRO_PASSWORD || 'Dev@12345', tipo: 'membro' },
  { login: 'admin.teste', nome: 'Administrador Teste', role: 'admin', senha: process.env.DEV_ADMIN_PASSWORD || 'Dev@12345', tipo: 'membro' },
  // Dono da igreja (master): vê Administração (Usuários, Configurações, Assinatura)
  { login: 'master.teste', nome: 'Gestor Teste', role: 'master', senha: process.env.DEV_MASTER_PASSWORD || 'Dev@12345', tipo: 'membro' },
];

const main = async () => {
  for (const u of DEV_USERS) {
    let person = await Person.findOne({ nome: u.nome });
    if (!person) person = await Person.create({ nome: u.nome, tipo: u.tipo, congregacao: 'Sede', status: 'ativo' });
    const existing = await User.findOne({ login: u.login });
    if (existing) {
      existing.senha = u.senha;
      existing.role = u.role;
      existing.ativo = true;
      existing.mustChangePassword = false;
      await existing.save();
    } else {
      await User.create({ nome: u.nome, login: u.login, senha: u.senha, role: u.role, personId: person._id, mustChangePassword: false });
    }
    console.log(`✔ ${u.role.padEnd(6)} ${u.login}`);
  }
  console.log(`✔ plataforma ${process.env.PLATFORM_ADMIN_EMAIL || '(defina PLATFORM_ADMIN_EMAIL/PLATFORM_ADMIN_PASSWORD no .env)'}`);
  await mongoose.disconnect();
};

runInTenant(main).catch((err) => {
  console.error(err);
  mongoose.disconnect();
  process.exit(1);
});
