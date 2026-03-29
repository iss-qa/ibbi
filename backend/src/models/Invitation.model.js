const mongoose = require('mongoose');

const InvitationSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expiresAt: { type: Date },
    usedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Invitation || mongoose.model('Invitation', InvitationSchema);
