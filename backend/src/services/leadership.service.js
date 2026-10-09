const { ASSISTENTE_PADRAO } = require('../config/assistentes');
const User = require('../models/User.model');
const Person = require('../models/Person.model');
const whatsapp = require('./whatsapp.service');
const { sendEmail } = require('./email.service');
const { registrarComunicacao } = require('./trigger.service');
const { getTenant } = require('../tenancy/context');
const { churchShort } = require('../tenancy/brand');

const FLAG = {
  aniversarios: 'recebeAniversarios',
  ausencias: 'recebeAlertasAusencia',
  relatorio: 'recebeRelatorioSemanal',
};

/**
 * Quem recebe notificações da liderança. Usa Tenant.lideranca; sem nada configurado,
 * cai para os usuários master com celular (para a automação nunca ficar muda).
 */
const leadershipRecipients = async ({ tipo, congregacao } = {}) => {
  const tenant = getTenant();
  const flag = FLAG[tipo];
  const configured = (tenant?.lideranca || []).filter((l) => (!flag || l[flag] !== false)
    && (!l.congregacao || !congregacao || l.congregacao === congregacao));
  if (configured.length) return configured.map((l) => ({ nome: l.nome, celular: l.celular, email: l.email }));

  const masters = await User.find({ role: 'master', ativo: true, personId: { $ne: null } }).select('nome personId').lean();
  const persons = await Person.find({ _id: { $in: masters.map((m) => m.personId) } }).select('nome celular email').lean();
  return persons.filter((p) => p.celular).map((p) => ({ nome: p.nome, celular: p.celular, email: p.email }));
};

// Líderes de EBD da classe/congregação (Tenant.ebdLideres).
const classLeaders = (classe, congregacao) => (getTenant()?.ebdLideres || [])
  .filter((l) => l.classe === classe && l.congregacao === congregacao && l.celular);

/**
 * Envia um texto para a liderança por WhatsApp (fila com delay anti-banimento) e,
 * opcionalmente, por email. Registra o envio na collection messages.
 */
const notifyLeadership = async ({ texto, tipo, congregacao, extra = [], emailSubject, emailHtml }) => {
  const base = await leadershipRecipients({ tipo, congregacao });
  const seen = new Set();
  const recipients = [...base, ...extra].filter((r) => {
    const key = r.celular || r.email;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Grupo da liderança (Evolution): modo "grupo" substitui os envios individuais da liderança;
  // "ambos" manda nos dois. Líderes específicos (extra: classe/união) continuam individuais.
  const tenant = getTenant();
  const grupo = tenant?.whatsapp?.grupoLideranca;
  const modo = tenant?.whatsapp?.liderancaEnvio || 'individual';
  const usaGrupo = grupo?.jid && modo !== 'individual' && whatsapp.supportsGroups();
  if (usaGrupo && modo === 'grupo') {
    const extras = new Set(extra.map((e) => e.celular).filter(Boolean));
    for (let i = recipients.length - 1; i >= 0; i -= 1) {
      if (recipients[i].celular && !extras.has(recipients[i].celular)) recipients[i] = { ...recipients[i], celular: null };
    }
  }
  const zap = [
    ...(usaGrupo ? [{ nome: grupo.nome || 'Grupo da liderança', celular: grupo.jid }] : []),
    ...recipients.filter((r) => r.celular),
  ];
  if (zap.length && whatsapp.isConfigured()) {
    whatsapp.enqueue(zap.map((r) => ({
      send: () => whatsapp.sendText(r.celular, texto),
      onSuccess: () => registrarComunicacao({
        tipo: 'lideranca', destinatarios: [{ nome: r.nome, celular: r.celular, status: 'concluido' }], conteudo: texto, status: 'concluido',
      }),
      onError: (err) => registrarComunicacao({
        tipo: 'lideranca', destinatarios: [{ nome: r.nome, celular: r.celular, status: 'erro' }], conteudo: texto, status: 'erro',
        erros: [{ celular: r.celular, motivo: err.message }],
      }),
    })));
  }

  const emails = recipients.map((r) => r.email).filter(Boolean);
  if (emails.length && emailSubject) {
    await sendEmail({
      to: emails.join(', '),
      subject: `${churchShort()} — ${emailSubject}`,
      text: texto.replace(/[*_]/g, ''),
      html: emailHtml || `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${texto.replace(/[*_]/g, '')}</div>`,
    }).catch((err) => console.error('[LIDERANCA] Falha no email:', err.message));
  }

  return { whatsapp: zap.length, email: emails.length };
};

/**
 * "Salve nosso contato": apresenta o número da igreja a toda a liderança (contatos da
 * liderança, líderes de EBD e de grupos, admins e masters). Texto + cartão de contato,
 * no ritmo anti-ban. Contato salvo reduz muito o risco de bloqueio.
 */
const apresentarNumero = async ({ forcar = false } = {}) => {
  const Tenant = require('../models/Tenant.model');
  const GrupoEncontro = require('../models/GrupoEncontro.model');
  const { invalidateTenant } = require('../tenancy/tenant.service');
  const templates = require('../templates/messages.templates');
  const tenant = getTenant();
  if (whatsapp.desativado()) throw new Error('WhatsApp desligado nas configurações. Ligue para apresentar o número.');
  if (!whatsapp.isConfigured()) throw new Error('WhatsApp da igreja ainda não configurado.');
  const numero = tenant?.whatsapp?.numeroInstancia || (tenant?.whatsapp?.useEnvFallback ? process.env.WHATSAPP_NUMERO_INSTANCIA : '');
  if (!forcar && tenant?.whatsapp?.apresentacaoEnviadaEm && tenant.whatsapp.apresentacaoNumero === numero) {
    return { enviados: 0, jaEnviada: tenant.whatsapp.apresentacaoEnviadaEm };
  }

  const lista = [
    ...(tenant?.lideranca || []).filter((l) => l.celular && !whatsapp.isGroupJid(l.celular)),
    ...(tenant?.ebdLideres || []),
    ...(await GrupoEncontro.find({ ativo: true }).select('lideres').lean()).flatMap((g) => g.lideres || []),
  ];
  const gestores = await User.find({ role: { $in: ['master', 'admin'] }, ativo: true, personId: { $ne: null } }).select('personId').lean();
  (await Person.find({ _id: { $in: gestores.map((u) => u.personId) }, celular: { $nin: [null, ''] } }).select('nome celular').lean())
    .forEach((p) => lista.push(p));

  const vistos = new Set();
  const destinatarios = lista.filter((d) => {
    const k = d.celular && whatsapp.sanitizeNumber(d.celular);
    if (!k || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  const assistente = tenant?.ia?.nomeAssistente || ASSISTENTE_PADRAO;
  const numeroFmt = numero ? `+${numero.replace(/\D/g, '')}` : '';
  whatsapp.enqueue(destinatarios.map((d) => ({
    send: async () => {
      await whatsapp.sendText(d.celular, templates.apresentacaoNumero(d.nome, assistente, numeroFmt));
      if (numero) {
        await whatsapp.sendContact(d.celular, { fullName: `${tenant.nomeCurto || tenant.nome} — PastorIA`, phoneNumber: numero, organization: tenant.nome }).catch(() => {});
      }
    },
    onSuccess: () => registrarComunicacao({
      tipo: 'lideranca', destinatarios: [{ nome: d.nome, celular: d.celular, status: 'concluido' }],
      conteudo: templates.apresentacaoNumero(d.nome, assistente, numeroFmt), status: 'concluido',
    }),
    onError: (err) => registrarComunicacao({
      tipo: 'lideranca', destinatarios: [{ nome: d.nome, celular: d.celular, status: 'erro' }],
      conteudo: 'Apresentação do número da igreja', status: 'erro', erros: [{ celular: d.celular, motivo: err.message }],
    }),
  })));
  await Tenant.updateOne({ _id: tenant._id }, { $set: { 'whatsapp.apresentacaoEnviadaEm': new Date(), 'whatsapp.apresentacaoNumero': numero } });
  invalidateTenant(tenant._id);
  return { enviados: destinatarios.length, destinatarios: destinatarios.map((d) => d.nome) };
};

module.exports = { leadershipRecipients, classLeaders, notifyLeadership, apresentarNumero };
