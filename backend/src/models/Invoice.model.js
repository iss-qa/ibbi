const mongoose = require('mongoose');

// Fatura da assinatura (nível plataforma — não usa tenantPlugin).
const InvoiceSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  competencia: { type: String, required: true }, // YYYY-MM
  descricao: { type: String, trim: true },
  plano: { type: String },
  ciclo: { type: String, enum: ['mensal', 'anual'], default: 'mensal' },
  valor: { type: Number, required: true, min: 0 },
  desconto: { type: Number, default: 0 },
  vencimento: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pendente', 'pago', 'vencido', 'cancelado'],
    default: 'pendente',
    index: true,
  },
  pagoEm: { type: Date },
  valorPago: { type: Number },
  metodo: { type: String, enum: ['pix', 'boleto', 'cartao', 'transferencia', 'dinheiro', 'outro', 'credito'] }, // credito = mês grátis por indicação
  observacao: { type: String, trim: true },
  // Cobrança Pix na Woovi (OpenPix). id = correlationID (pastoria-<fatura>-<n>); uma nova é
  // gerada quando a anterior expira ou o valor muda (troca de plano).
  gateway: {
    provider: { type: String },
    id: { type: String, index: true, sparse: true },
    chargeId: { type: String },
    invoiceUrl: { type: String }, // página de pagamento (paymentLinkUrl)
    brCode: { type: String }, // Pix copia e cola
    valor: { type: Number }, // valor da cobrança no gateway (R$), para detectar reajuste
    expiraEm: { type: Date },
    status: { type: String }, // ACTIVE | COMPLETED | EXPIRED
    tentativas: { type: Number, default: 0 },
    // Boleto (cobrança BOLETO da Woovi: gera boleto + Pix). Só com WOOVI_BOLETO=true e endereço da igreja.
    boleto: {
      digitable: { type: String },
      barcode: { type: String },
      imagem: { type: String },
    },
    verificadoEm: { type: Date }, // última conferência direta na Woovi
  },
  lembretesEnviados: { type: Number, default: 0 },
  // Link público de pagamento (/pagar/:token), enviado por email. Sem login; revogável trocando o token.
  publicToken: { type: String, index: { unique: true, sparse: true } },
  emailEnviadoEm: { type: Date },
}, { timestamps: true });

InvoiceSchema.index({ tenantId: 1, competencia: 1 }, { unique: true });

module.exports = mongoose.models.Invoice || mongoose.model('Invoice', InvoiceSchema);
