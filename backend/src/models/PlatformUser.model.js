const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Operadores do painel administrativo da plataforma (SaaS). Separado de User (tenant).
const PlatformUserSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  senha: { type: String, required: true },
  ativo: { type: Boolean, default: true },
  ultimoLoginEm: { type: Date },
}, { timestamps: true });

PlatformUserSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('senha')) return next();
  this.senha = await bcrypt.hash(this.senha, await bcrypt.genSalt(10));
  return next();
});

PlatformUserSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.senha);
};

PlatformUserSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.senha;
  return obj;
};

module.exports = mongoose.models.PlatformUser || mongoose.model('PlatformUser', PlatformUserSchema);
