const Tenant = require('../models/Tenant.model');
const Person = require('../models/Person.model');
const GrupoEncontro = require('../models/GrupoEncontro.model');
const Conversation = require('../models/Conversation.model');
const whatsapp = require('./whatsapp.service');
const { hasFeature } = require('../config/plans');
const { TERMOS_VERSAO } = require('../config/legal');
const { invalidateTenant } = require('../tenancy/tenant.service');

/**
 * Primeiros passos da igreja. Cada etapa é calculada pelo estado real (não por clique),
 * exceto as de revisão ("congregacoes", "assistente"), confirmadas pelo master.
 * Quando todas as obrigatórias ficam prontas, o onboarding é marcado como concluído.
 */
const CONFIRMAVEIS = ['congregacoes', 'assistente', 'automacoes'];

const whatsappOnline = async (tenant) => {
  if (!whatsapp.isConfigured(tenant)) return false;
  try {
    const st = await Promise.race([whatsapp.connectionState(tenant), new Promise((r) => setTimeout(() => r({ online: false }), 6000))]);
    return Boolean(st?.online);
  } catch {
    return false;
  }
};

const calcular = async (tenant) => {
  const confirmadas = new Set(tenant.onboarding?.etapasConfirmadas || []);
  const ia = hasFeature(tenant, 'agenteWhatsApp');
  const [pessoas, grupos, testeLider, online] = await Promise.all([
    Person.countDocuments({ status: 'ativo' }),
    GrupoEncontro.countDocuments({ ativo: true }),
    ia ? Conversation.exists({ papel: 'lider', lastInboundAt: { $ne: null } }) : null,
    whatsappOnline(tenant),
  ]);
  const a = tenant.automacoes || {};
  const automacoesLigadas = [a.aniversario?.ativo !== false, a.ausencia?.ativo, a.jornada?.ativo !== false && hasFeature(tenant, 'jornadaVisitante'), a.chamadaEbd?.ativo].filter(Boolean).length;

  const etapas = [
    { id: 'termos', titulo: 'Aceitar os Termos e a Política de Privacidade', descricao: 'A igreja é responsável pelos dados dos membros; o PastorIA trata esses dados só para os serviços contratados.', feito: tenant.termos?.versao === TERMOS_VERSAO, obrigatoria: true, acao: 'termos' },
    { id: 'igreja', titulo: 'Completar os dados da igreja', descricao: 'Nome, cidade/UF e um contato (telefone ou email).', feito: Boolean(tenant.nome && (tenant.cidade || tenant.uf) && (tenant.telefone || tenant.email)), obrigatoria: true, link: '/configuracoes?aba=igreja' },
    { id: 'congregacoes', titulo: 'Revisar as congregações', descricao: 'Sede e congregações: cada uma terá relatórios, liderança e grupos próprios.', feito: (tenant.congregacoes || []).length > 1 || confirmadas.has('congregacoes'), obrigatoria: true, link: '/configuracoes?aba=igreja', confirmavel: true },
    { id: 'lideranca', titulo: 'Cadastrar a liderança', descricao: 'Pastores e líderes recebem avisos de aniversários, ausências e o relatório semanal.', feito: (tenant.lideranca || []).length + (tenant.ebdLideres || []).length > 0, obrigatoria: true, link: '/configuracoes?aba=lideranca' },
    { id: 'whatsapp', titulo: 'Conectar o WhatsApp da igreja', descricao: 'Leia o QR Code com o número da igreja (ou configure a API Oficial).', feito: online, obrigatoria: true, link: '/configuracoes?aba=whatsapp' },
    { id: 'pessoas', titulo: 'Trazer as pessoas da igreja', descricao: 'Importe a planilha (CSV) ou envie o link de cadastro para os membros. Pelo menos 10 pessoas.', feito: pessoas >= 10, obrigatoria: true, link: '/members', detalhe: `${pessoas} pessoa(s) ativa(s)` },
    { id: 'grupos', titulo: 'Criar as uniões e grupos', descricao: 'União feminina, jovens, louvor, células: a frequência deles alimenta o cuidado pastoral.', feito: grupos > 0, obrigatoria: false, link: '/encontros' },
    { id: 'automacoes', titulo: 'Ligar as automações', descricao: 'Aniversários, jornada do visitante, reengajamento de ausentes e chamada da EBD.', feito: automacoesLigadas >= 2 || confirmadas.has('automacoes'), obrigatoria: true, link: '/configuracoes?aba=automacoes', confirmavel: true },
    ...(ia ? [
      { id: 'assistente', titulo: 'Escolher o nome do assistente', descricao: 'Cada nome se apresenta com uma referência bíblica (padrão: Barnabé).', feito: confirmadas.has('assistente'), obrigatoria: false, link: '/configuracoes?aba=ia', confirmavel: true },
      { id: 'teste', titulo: 'Testar no seu WhatsApp', descricao: 'Do celular de um líder, envie "menu" para o número da igreja.', feito: Boolean(testeLider), obrigatoria: false },
    ] : []),
  ];
  const obrigatorias = etapas.filter((e) => e.obrigatoria);
  return {
    etapas,
    feitas: etapas.filter((e) => e.feito).length,
    total: etapas.length,
    pronto: obrigatorias.every((e) => e.feito),
    concluido: Boolean(tenant.onboarding?.concluido),
    dispensado: Boolean(tenant.onboarding?.dispensado),
    termosPendentes: tenant.termos?.versao !== TERMOS_VERSAO,
    termosVersao: TERMOS_VERSAO,
  };
};

const status = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId).lean();
  const r = await calcular(tenant);
  if (r.pronto && !tenant.onboarding?.concluido) {
    await Tenant.updateOne({ _id: tenant._id }, { $set: { 'onboarding.concluido': true, 'onboarding.concluidoEm': new Date() } });
    invalidateTenant(tenant._id);
    r.concluido = true;
  }
  return r;
};

const confirmar = async (tenantId, etapa) => {
  if (!CONFIRMAVEIS.includes(etapa)) throw Object.assign(new Error('Etapa não pode ser confirmada manualmente'), { status: 400 });
  await Tenant.updateOne({ _id: tenantId }, { $addToSet: { 'onboarding.etapasConfirmadas': etapa } });
  invalidateTenant(tenantId);
};

const dispensar = async (tenantId, valor = true) => {
  await Tenant.updateOne({ _id: tenantId }, { $set: { 'onboarding.dispensado': Boolean(valor) } });
  invalidateTenant(tenantId);
};

const aceitarTermos = async (tenantId, { nome, ip }) => {
  await Tenant.updateOne({ _id: tenantId }, { $set: { termos: { versao: TERMOS_VERSAO, aceitoEm: new Date(), aceitoPor: nome, ip: String(ip || '').slice(0, 64) } } });
  invalidateTenant(tenantId);
};

module.exports = { calcular, status, confirmar, dispensar, aceitarTermos };
