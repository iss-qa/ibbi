const cron = require('node-cron');
const { sendEmail } = require('./email.service');
const whatsapp = require('./whatsapp.service');
const { getTenant, runWithTenant } = require('../tenancy/context');
const { listActiveTenants } = require('../tenancy/tenant.service');

const CHECK_INTERVAL = process.env.EVOLUTION_MONITOR_CRON || '*/5 * * * *'; // a cada 5 minutos
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutos entre alertas

// Destinatários: ALERT_EMAIL (operação da plataforma) + email da igreja + liderança com email.
const DEFAULT_ALERT_EMAILS = ['isaiasilva.info@gmail.com', 'ibbisede@gmail.com'];
const platformRecipients = () => {
  const list = (process.env.ALERT_EMAIL || '').split(/[,;]/).map((e) => e.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_ALERT_EMAILS;
};

const recipientsFor = (tenant) => {
  const set = new Set();
  if (!tenant || tenant.whatsapp?.useEnvFallback) platformRecipients().forEach((e) => set.add(e));
  if (tenant?.email) set.add(tenant.email);
  return [...set].join(', ');
};

const state = new Map(); // tenantId -> { wasOffline, lastAlertAt }

const checkConnectionState = async () => {
  try {
    return await whatsapp.connectionState();
  } catch (err) {
    return { online: false, error: err.message };
  }
};

const alertHtml = (tenant, details, ok) => {
  const cor = ok ? '#16a34a' : '#dc2626';
  const titulo = ok ? '✅ WhatsApp reconectado' : '⚠️ WhatsApp desconectado';
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${cor}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">${titulo}</h2>
      </div>
      <div style="padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
        <p><strong>Igreja:</strong> ${tenant?.nome || 'Ambiente'}</p>
        <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR', { timeZone: tenant?.timezone || 'America/Bahia' })}</p>
        ${ok ? '<p>A conexão com o WhatsApp foi restabelecida.</p>' : `
        <p><strong>Estado:</strong> ${details.state || 'N/A'}</p>
        <p><strong>Erro:</strong> ${details.error || 'Conexão não está ativa'}</p>
        <p style="color: #991b1b;"><strong>Ação necessária:</strong> reconecte o número (QR Code na Evolution ou verifique o token da API Oficial).</p>`}
        <p style="font-size: 12px; color: #6b7280;">Alerta automático. Próximo alerta só após 30 minutos.</p>
      </div>
    </div>`;
};

// Verifica o tenant do contexto atual.
const runCheck = async () => {
  const tenant = getTenant();
  const id = tenant ? String(tenant._id) : 'env';
  const s = state.get(id) || { wasOffline: false, lastAlertAt: null };
  const result = await checkConnectionState();
  const to = recipientsFor(tenant);

  if (result.online) {
    if (s.wasOffline && to) {
      await sendEmail({ to, subject: `✅ ${tenant?.nomeCurto || 'Sistema'} — WhatsApp reconectado`, html: alertHtml(tenant, result, true), text: 'WhatsApp reconectado.' })
        .catch((err) => console.error('[MONITOR] Falha no email de recuperação:', err.message));
    }
    state.set(id, { wasOffline: false, lastAlertAt: null });
    return result;
  }

  console.warn(`[MONITOR] WhatsApp OFFLINE (${tenant?.slug || 'env'}) — ${result.error || `state: ${result.state}`}`);
  const cooldownOk = !s.lastAlertAt || Date.now() - s.lastAlertAt >= ALERT_COOLDOWN_MS;
  if ((!s.wasOffline || cooldownOk) && to) {
    await sendEmail({
      to,
      subject: `🚨 ${tenant?.nomeCurto || 'Sistema'} — WhatsApp OFFLINE`,
      html: alertHtml(tenant, result, false),
      text: `WhatsApp OFFLINE: ${result.error || result.state}`,
    }).catch((err) => console.error('[MONITOR] Falha ao enviar alerta por email:', err.message));
    state.set(id, { wasOffline: true, lastAlertAt: Date.now() });
  } else {
    state.set(id, { ...s, wasOffline: true });
  }
  return result;
};

const runAllChecks = async () => {
  const tenants = await listActiveTenants();
  for (const tenant of tenants) {
    if (!whatsapp.isConfigured(tenant)) continue;
    await runWithTenant(tenant, runCheck).catch((err) => console.error('[MONITOR] Erro:', err.message));
  }
};

const startEvolutionMonitor = () => {
  setTimeout(() => runAllChecks().catch((err) => console.error('[MONITOR] Erro inicial:', err.message)), 10_000);
  cron.schedule(CHECK_INTERVAL, () => {
    runAllChecks().catch((err) => console.error('[MONITOR] Erro na verificação:', err.message));
  });
  console.log(`[MONITOR] Monitor de WhatsApp ativo — verificando ${CHECK_INTERVAL}`);
};

module.exports = { startEvolutionMonitor, checkConnectionState, runCheck };
