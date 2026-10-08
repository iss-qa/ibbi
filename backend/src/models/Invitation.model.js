const mongoose = require('mongoose');
const tenantPlugin = require('../tenancy/plugin');

const InvitationSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expiresAt: { type: Date },
    usedAt: { type: Date },
    permanente: { type: Boolean, default: false },
  },
  { timestamps: true }
);

InvitationSchema.plugin(tenantPlugin);

module.exports = mongoose.models.Invitation || mongoose.model('Invitation', InvitationSchema);
