const cron = require('node-cron');
const axios = require('axios');
const https = require('https');
const { sendEmail } = require('./email.service');

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Bahia';
const CHECK_INTERVAL = process.env.EVOLUTION_MONITOR_CRON || '*/5 * * * *'; // a cada 5 minutos
const ALERT_EMAIL = process.env.ALERT_EMAIL || '';

let wasOffline = false; // evita spam de alertas repetidos
let lastAlertAt = null;
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutos entre alertas

const checkConnectionState = async () => {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const instance = process.env.EVOLUTION_INSTANCE;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!baseUrl || !instance || !apiKey) {
    return { online: false, error: 'Configuração Evolution API incompleta' };
  }

  const allowSelfSigned = process.env.EVOLUTION_ALLOW_SELF_SIGNED === 'true';
  const httpsAgent = allowSelfSigned
    ? new https.Agent({ rejectUnauthorized: false })
    : undefined;

  try {
    const url = `${baseUrl}/instance/connectionState/${encodeURIComponent(instance)}`;
    const res = await axios.get(url, {
      headers: { apikey: apiKey },
      timeout: 15000,
      httpsAgent,
    });

    const state = res.data?.instance?.state || res.data?.state || 'unknown';
    const isConnected = state === 'open' || state === 'connected';

    return { online: isConnected, state };
  } catch (err) {
    const status = err?.response?.status;
    const msg = err?.response?.data?.message || err.message;
    return { online: false, error: `HTTP ${status || '?'} — ${msg}` };
  }
};

const sendAlertEmail = async (details) => {
  if (!ALERT_EMAIL) {
    console.warn('[MONITOR] ALERT_EMAIL não configurado — alerta não enviado.');
    return;
  }

  const now = new Date();
  const dataFormatada = now.toLocaleString('pt-BR', { timeZone: APP_TIMEZONE });

  const subject = '🚨 ALERTA IBBI — WhatsApp Evolution API OFFLINE';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">⚠️ Evolution API Desconectada</h2>
      </div>
      <div style="background: #fef2f2; padding: 20px; border: 1px solid #fecaca; border-radius: 0 0 8px 8px;">
        <p><strong>Data/Hora:</strong> ${dataFormatada}</p>
        <p><strong>Instância:</strong> ${process.env.EVOLUTION_INSTANCE}</p>
        <p><strong>URL:</strong> ${process.env.EVOLUTION_API_URL}</p>
        <p><strong>Estado:</strong> ${details.state || 'N/A'}</p>
        <p><strong>Erro:</strong> ${details.error || 'Conexão não está ativa'}</p>
        <hr style="border-color: #fecaca;" />
        <p style="color: #991b1b;">
          <strong>Ação necessária:</strong> Acesse o painel da Evolution API e reconecte a instância
          escaneando o QR Code pelo WhatsApp.
        </p>
        <p style="font-size: 12px; color: #6b7280;">
          Este alerta é enviado automaticamente pelo sistema IBBI.
          Próximo alerta só será enviado após 30 minutos.
        </p>
      </div>
    </div>
  `;

  const text =
    `🚨 ALERTA IBBI — WhatsApp OFFLINE\n\n` +
    `Data/Hora: ${dataFormatada}\n` +
    `Instância: ${process.env.EVOLUTION_INSTANCE}\n` +
    `URL: ${process.env.EVOLUTION_API_URL}\n` +
    `Estado: ${details.state || 'N/A'}\n` +
    `Erro: ${details.error || 'Conexão não está ativa'}\n\n` +
    `Ação: Reconecte a instância pelo painel da Evolution API.`;

  try {
    await sendEmail({ to: ALERT_EMAIL, subject, text, html });
    console.log(`[MONITOR] Alerta enviado para ${ALERT_EMAIL}`);
  } catch (err) {
    console.error(`[MONITOR] Falha ao enviar alerta por email:`, err.message);
  }
};

const sendRecoveryEmail = async () => {
  if (!ALERT_EMAIL) return;

  const now = new Date();
  const dataFormatada = now.toLocaleString('pt-BR', { timeZone: APP_TIMEZONE });

  const subject = '✅ IBBI — WhatsApp Evolution API RECONECTADA';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #16a34a; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">✅ Evolution API Reconectada</h2>
      </div>
      <div style="background: #f0fdf4; padding: 20px; border: 1px solid #bbf7d0; border-radius: 0 0 8px 8px;">
        <p><strong>Data/Hora:</strong> ${dataFormatada}</p>
        <p><strong>Instância:</strong> ${process.env.EVOLUTION_INSTANCE}</p>
        <p>A conexão com o WhatsApp foi restabelecida com sucesso.</p>
        <p style="font-size: 12px; color: #6b7280;">
          Alerta automático do sistema IBBI.
        </p>
      </div>
    </div>
  `;

  const text =
    `✅ IBBI — WhatsApp RECONECTADA\n\n` +
    `Data/Hora: ${dataFormatada}\n` +
    `Instância: ${process.env.EVOLUTION_INSTANCE}\n\n` +
    `A conexão foi restabelecida.`;

  try {
    await sendEmail({ to: ALERT_EMAIL, subject, text, html });
    console.log(`[MONITOR] Email de recuperação enviado para ${ALERT_EMAIL}`);
  } catch (err) {
    console.error(`[MONITOR] Falha ao enviar email de recuperação:`, err.message);
  }
};

const runCheck = async () => {
  const result = await checkConnectionState();
  const now = Date.now();

  if (result.online) {
    if (wasOffline) {
      console.log('[MONITOR] Evolution API reconectada!');
      await sendRecoveryEmail();
      wasOffline = false;
      lastAlertAt = null;
    }
    return;
  }

  // Offline
  console.warn(`[MONITOR] Evolution API OFFLINE — ${result.error || `state: ${result.state}`}`);

  const cooldownOk = !lastAlertAt || (now - lastAlertAt) >= ALERT_COOLDOWN_MS;

  if (!wasOffline || cooldownOk) {
    await sendAlertEmail(result);
    wasOffline = true;
    lastAlertAt = now;
  }
};

const startEvolutionMonitor = () => {
  if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY) {
    console.warn('[MONITOR] Evolution API não configurada — monitor desativado.');
    return;
  }

  // Verificar na inicialização (com delay de 10s para dar tempo do server subir)
  setTimeout(() => {
    runCheck().catch((err) => console.error('[MONITOR] Erro na verificação inicial:', err.message));
  }, 10_000);

  cron.schedule(CHECK_INTERVAL, () => {
    runCheck().catch((err) => console.error('[MONITOR] Erro na verificação:', err.message));
  }, { timezone: APP_TIMEZONE });

  console.log(`[MONITOR] Evolution API monitor ativo — verificando ${CHECK_INTERVAL}`);
};

module.exports = { startEvolutionMonitor, checkConnectionState };
