const mongoose = require('mongoose');

const RegistrationRequestSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  celular: { type: String, trim: true },
  congregacao: { type: String, trim: true },
  fotoUrl: { type: String },
  submittedData: { type: Object },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNote: { type: String },
  approvedPersonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
  approvedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

module.exports = mongoose.models.RegistrationRequest || mongoose.model('RegistrationRequest', RegistrationRequestSchema);
