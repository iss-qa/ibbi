// Catálogo de planos comerciais. Valores em BRL.
// Congregações não são limitadas: uma igreja com N congregações é 1 tenant / 1 cobrança.
// Limites `null` = ilimitado.
const PLANS = {
  semente: {
    id: 'semente',
    nome: 'Semente',
    descricao: 'Para igrejas que querem sair da planilha e nunca mais esquecer um aniversário.',
    precoMensal: 97,
    precoAnual: 970, // 2 meses grátis
    limites: {
      pessoas: 150,
      whatsappMensagensMes: 1500,
      iaInteracoesMes: 0,
      usuariosAdmin: 3,
    },
    features: {
      aniversariosAutomaticos: true,
      notificacaoLideranca: true,
      ebd: true,
      agenteWhatsApp: false,
      reengajamento: false,
      relatorioSemanalIA: false,
      multimodal: false,
      whatsappOficial: false,
    },
  },
  crescer: {
    id: 'crescer',
    nome: 'Crescer',
    descricao: 'Agente de IA no WhatsApp da liderança + motor de reengajamento de ausentes.',
    precoMensal: 197,
    precoAnual: 1970,
    destaque: true,
    limites: {
      pessoas: 500,
      whatsappMensagensMes: 5000,
      iaInteracoesMes: 1500,
      usuariosAdmin: 10,
    },
    features: {
      aniversariosAutomaticos: true,
      notificacaoLideranca: true,
      ebd: true,
      agenteWhatsApp: true,
      reengajamento: true,
      relatorioSemanalIA: true,
      multimodal: false,
      whatsappOficial: false,
    },
  },
  multiplicar: {
    id: 'multiplicar',
    nome: 'Multiplicar',
    descricao: 'IA multimodal (áudio e foto de ficha), WhatsApp Oficial e alto volume.',
    precoMensal: 397,
    precoAnual: 3970,
    limites: {
      pessoas: 2000,
      whatsappMensagensMes: 15000,
      iaInteracoesMes: 6000,
      usuariosAdmin: null,
    },
    features: {
      aniversariosAutomaticos: true,
      notificacaoLideranca: true,
      ebd: true,
      agenteWhatsApp: true,
      reengajamento: true,
      relatorioSemanalIA: true,
      multimodal: true,
      whatsappOficial: true,
    },
  },
  rede: {
    id: 'rede',
    nome: 'Rede',
    descricao: 'Convenções e redes de igrejas. Limites e SLA sob medida.',
    precoMensal: 0, // sob consulta — usar valorMensal customizado no tenant
    precoAnual: 0,
    sobConsulta: true,
    limites: {
      pessoas: null,
      whatsappMensagensMes: null,
      iaInteracoesMes: null,
      usuariosAdmin: null,
    },
    features: {
      aniversariosAutomaticos: true,
      notificacaoLideranca: true,
      ebd: true,
      agenteWhatsApp: true,
      reengajamento: true,
      relatorioSemanalIA: true,
      multimodal: true,
      whatsappOficial: true,
    },
  },
};

const TRIAL_DAYS = Number(process.env.TRIAL_DAYS) || 14;
const TRIAL_PLAN = 'crescer';

const getPlan = (id) => PLANS[id] || PLANS.semente;

// Valor mensal efetivo (MRR) de um tenant, considerando override, ciclo e isenção.
const monthlyPriceFor = (tenant) => {
  if (!tenant || tenant.billing?.isento) return 0;
  if (tenant.billing?.valorMensal != null) return Number(tenant.billing.valorMensal);
  const plan = getPlan(tenant.plano);
  if (tenant.billing?.ciclo === 'anual') return Math.round((plan.precoAnual / 12) * 100) / 100;
  return plan.precoMensal;
};

// Valor de uma fatura (mensal ou anual cheia).
const invoiceAmountFor = (tenant) => {
  if (!tenant || tenant.billing?.isento) return 0;
  if (tenant.billing?.valorMensal != null) {
    const mensal = Number(tenant.billing.valorMensal);
    return tenant.billing?.ciclo === 'anual' ? mensal * 12 : mensal;
  }
  const plan = getPlan(tenant.plano);
  return tenant.billing?.ciclo === 'anual' ? plan.precoAnual : plan.precoMensal;
};

const hasFeature = (tenant, feature) => Boolean(getPlan(tenant?.plano).features[feature]);
const limitFor = (tenant, limit) => {
  const custom = tenant?.limitesCustom?.[limit];
  if (custom !== undefined && custom !== null) return custom;
  return getPlan(tenant?.plano).limites[limit];
};

module.exports = {
  PLANS,
  TRIAL_DAYS,
  TRIAL_PLAN,
  getPlan,
  monthlyPriceFor,
  invoiceAmountFor,
  hasFeature,
  limitFor,
};
