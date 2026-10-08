const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const tenantPlugin = require('../tenancy/plugin');

const UserSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    login: { type: String, required: true, trim: true },
    senha: { type: String, required: true },
    role: { type: String, enum: ['master', 'admin', 'user'], default: 'user' },
    personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
    // Congregações que um admin gere (definido pelo master). Vazio = a do próprio cadastro.
    congregacoesAcesso: { type: [String], default: [] },
    ativo: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    passwordChangedAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

UserSchema.index({ tenantId: 1, login: 1 }, { unique: true });
UserSchema.plugin(tenantPlugin);

UserSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('senha')) return next();
  const salt = await bcrypt.genSalt(10);
  this.senha = await bcrypt.hash(this.senha, salt);
  next();
});

UserSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.senha);
};

UserSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.senha;
  return obj;
};

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
