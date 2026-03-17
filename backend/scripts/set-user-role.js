const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const User = require('../src/models/User.model');

const login = process.argv[2];
const role = process.argv[3];
if (!login || !role) {
  console.log('Uso: node scripts/set-user-role.js <login> <role>');
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ login });
  if (!user) {
    console.log('Usuário não encontrado');
    await mongoose.disconnect();
    process.exit(1);
  }
  user.role = role;
  await user.save();
  console.log(`Atualizado ${user.login} -> ${user.role}`);
  await mongoose.disconnect();
})();
