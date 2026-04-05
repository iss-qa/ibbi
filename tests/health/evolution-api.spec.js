// @ts-check
const { test, expect } = require('@playwright/test');

const ALERT_PHONE = process.env.ALERT_PHONE || '5571996838735';
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://evo2.wastezero.com.br';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'IBBI Oficial';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '79CAE865E6C1-436E-8558-C4DDB114C5E7';
const API_URL = process.env.TEST_API_URL || 'http://localhost:3001/api';

/**
 * Send alert via Evolution API directly (bypass app)
 */
async function sendAlertSMS(request, message) {
  try {
    const phone = ALERT_PHONE.startsWith('55') ? ALERT_PHONE : `55${ALERT_PHONE}`;
    await request.post(`${EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(EVOLUTION_INSTANCE)}`, {
      headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
      data: { number: phone, text: message },
    });
    console.log(`[ALERT] SMS sent to ${phone}`);
  } catch (err) {
    console.error(`[ALERT] Failed to send SMS: ${err.message}`);
  }
}

test.describe('Evolution API Health Check', () => {
  test('Evolution API should be reachable and connected', async ({ request }) => {
    let isHealthy = false;
    let errorMsg = '';

    try {
      const res = await request.get(
        `${EVOLUTION_API_URL}/instance/connectionState/${encodeURIComponent(EVOLUTION_INSTANCE)}`,
        { headers: { apikey: EVOLUTION_API_KEY }, timeout: 15000 }
      );

      if (res.ok()) {
        const body = await res.json();
        const state = body?.instance?.state || body?.state || 'unknown';
        isHealthy = state === 'open' || state === 'connected';
        if (!isHealthy) errorMsg = `Instance state: ${state}`;
      } else {
        errorMsg = `Evolution API returned status ${res.status()}`;
      }
    } catch (err) {
      errorMsg = `Evolution API unreachable: ${err.message}`;
    }

    if (!isHealthy) {
      const alertMsg =
        `🚨 *ALERTA IBBI — WhatsApp OFFLINE*\n\n` +
        `A Evolution API está fora do ar ou desconectada.\n\n` +
        `Erro: ${errorMsg}\n` +
        `Instância: ${EVOLUTION_INSTANCE}\n` +
        `URL: ${EVOLUTION_API_URL}\n\n` +
        `Verifique imediatamente!\n` +
        `_Teste automático — ${new Date().toLocaleString('pt-BR')}_`;

      await sendAlertSMS(request, alertMsg);
    }

    expect(isHealthy, errorMsg).toBe(true);
  });

  test('Backend API health check', async ({ request }) => {
    const res = await request.get(`${API_URL}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
