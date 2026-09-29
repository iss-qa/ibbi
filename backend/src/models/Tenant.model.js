const mongoose = require('mongoose');

const EBD_CLASSES = ['Crianças', 'Adolescentes', 'Jovens', 'Adultos 1', 'Adultos 2', 'Idosos', 'Anciãos'];

const ContatoLiderancaSchema = new mongoose.Schema({
  nome: { type: String, trim: true },
  celular: { type: String, trim: true }, // dígitos, ou JID de grupo (…@g.us) quando provider = evolution
  email: { type: String, trim: true, lowercase: true },
  papel: { type: String, trim: true }, // Pastor, Secretaria, Líder de rede…
  congregacao: { type: String, trim: true }, // vazio = todas
  recebeAniversarios: { type: Boolean, default: true },
  recebeAlertasAusencia: { type: Boolean, default: true },
  recebeRelatorioSemanal: { type: Boolean, default: true },
}, { _id: true });

const EbdLiderSchema = new mongoose.Schema({
  classe: { type: String, enum: EBD_CLASSES, required: true },
  congregacao: { type: String, trim: true, required: true },
  nome: { type: String, trim: true },
  celular: { type: String, trim: true, required: true },
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
}, { _id: true });

const TenantSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  nomeCurto: { type: String, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9-]{2,40}$/ },
  documento: { type: String, trim: true }, // CNPJ
  email: { type: String, trim: true, lowercase: true },
  telefone: { type: String, trim: true },
  responsavel: { type: String, trim: true },
  cidade: { type: String, trim: true },
  uf: { type: String, trim: true },

  status: {
    type: String,
    enum: ['trial', 'ativa', 'inadimplente', 'suspensa', 'cancelada'],
    default: 'trial',
    index: true,
  },
  plano: { type: String, enum: ['semente', 'crescer', 'multiplicar', 'rede'], default: 'crescer' },
  trialEndsAt: { type: Date },
  canceladaEm: { type: Date },
  motivoCancelamento: { type: String, trim: true },
  limitesCustom: {
    pessoas: { type: Number },
    whatsappMensagensMes: { type: Number },
    iaInteracoesMes: { type: Number },
  },

  billing: {
    ciclo: { type: String, enum: ['mensal', 'anual'], default: 'mensal' },
    valorMensal: { type: Number }, // override (negociação / plano Rede)
    isento: { type: Boolean, default: false }, // cliente fundador / cortesia
    diaVencimento: { type: Number, min: 1, max: 28, default: 10 },
    asaasCustomerId: { type: String },
  },

  timezone: { type: String, default: 'America/Bahia' },
  congregacoes: { type: [String], default: ['Sede'] },
  programacaoSemanal: { type: String, trim: true, maxlength: 3000 }, // usada nas boas-vindas

  branding: {
    logoUrl: { type: String },
    corPrimaria: { type: String, default: '#0a1f44' },
    corSecundaria: { type: String, default: '#c9a227' },
    assinatura: { type: String, trim: true }, // assinatura das mensagens; default = nome
    portalUrl: { type: String, trim: true },
  },

  whatsapp: {
    provider: { type: String, enum: ['evolution', 'cloud', 'none'], default: 'none' },
    useEnvFallback: { type: Boolean, default: false }, // usa EVOLUTION_* do .env (tenant fundador)
    numeroIgreja: { type: String, trim: true }, // recebe pedidos de oração
    numeroInstancia: { type: String, trim: true }, // número conectado que envia as mensagens (com 55)
    apresentacaoEnviadaEm: { type: Date }, // mensagem "salve nosso contato" enviada à liderança
    apresentacaoNumero: { type: String }, // para qual número a apresentação foi feita
    // Grupo de WhatsApp da liderança (somente Evolution)
    grupoLideranca: {
      jid: { type: String, trim: true },
      nome: { type: String, trim: true },
    },
    // individual | grupo | ambos — como os avisos chegam à liderança
    liderancaEnvio: { type: String, enum: ['individual', 'grupo', 'ambos'], default: 'individual' },
    // Regras anti-bloqueio (vazio = padrões do servidor; intervalo mínimo nunca < 30s)
    antiban: {
      intervaloMinSeg: { type: Number, min: 30 },
      intervaloMaxSeg: { type: Number, min: 30 },
      horarioInicio: { type: String },
      horarioFim: { type: String },
      limitePorHora: { type: Number, min: 1 },
      limiteDiario: { type: Number, min: 1 },
      pausaACada: { type: Number, min: 0 },
      pausaMin: { type: Number, min: 0 },
      digitando: { type: Boolean },
    },
    webhookToken: { type: String },
    evolution: {
      url: { type: String, trim: true },
      instance: { type: String, trim: true },
      apiKeyEnc: { type: String },
    },
    cloud: {
      phoneNumberId: { type: String, trim: true, index: true, sparse: true },
      wabaId: { type: String, trim: true },
      accessTokenEnc: { type: String },
      // Templates aprovados pela Meta para mensagens fora da janela de 24h
      templates: {
        aniversario: { type: String },
        ausencia: { type: String },
        aviso: { type: String },
        idioma: { type: String, default: 'pt_BR' },
      },
    },
  },

  automacoes: {
    aniversario: {
      ativo: { type: Boolean, default: true },
      hora: { type: String, default: '08:00' },
      enviarEmail: { type: Boolean, default: true },
      notificarLideranca: { type: Boolean, default: true },
    },
    chamadaEbd: {
      ativo: { type: Boolean, default: false },
      hora: { type: String, default: '11:30' }, // domingo, horário local
    },
    ausencia: {
      ativo: { type: Boolean, default: false },
      autoEnviar: { type: Boolean, default: false }, // false = líder aprova antes
      mensagemPrimeiraFalta: { type: Boolean, default: true },
      semanasAlerta: { type: Number, default: 4, min: 2, max: 12 },
      incluirEncontros: { type: Boolean, default: true }, // aplica também aos encontros das uniões
      enviarEmail: { type: Boolean, default: true },
    },
    relatorioSemanal: {
      ativo: { type: Boolean, default: false },
      diaSemana: { type: Number, default: 1, min: 0, max: 6 }, // 1 = segunda
      hora: { type: String, default: '08:00' },
    },
  },

  ia: {
    ativo: { type: Boolean, default: true },
    nomeAssistente: { type: String, default: 'Barnabé' }, // catálogo com apresentação bíblica em config/assistentes.js
    tom: { type: String, default: 'pastoral, acolhedor e objetivo' },
    cadastroPublico: { type: Boolean, default: true }, // desconhecidos podem se cadastrar pelo WhatsApp
    instrucoesExtras: { type: String, trim: true, maxlength: 2000 },
  },

  lideranca: [ContatoLiderancaSchema],
  ebdLideres: [EbdLiderSchema],

  onboarding: {
    concluido: { type: Boolean, default: false },
    origem: { type: String, trim: true },
  },
}, { timestamps: true });

TenantSchema.index({ 'whatsapp.webhookToken': 1 }, { sparse: true });

module.exports = mongoose.models.Tenant || mongoose.model('Tenant', TenantSchema);
module.exports.EBD_CLASSES = EBD_CLASSES;
