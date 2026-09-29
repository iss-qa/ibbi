const { getTenant } = require('./context');

// Identidade da igreja do contexto atual, usada pelos templates de mensagem.
// Fallbacks preservam os textos originais da IBBI (tenant fundador).
const churchName = () => getTenant()?.nome || 'Igreja Batista Bíblica Israel';
const churchShort = () => getTenant()?.nomeCurto || getTenant()?.nome || 'IBBI';
const signature = () => getTenant()?.branding?.assinatura || churchName();
const portalUrl = () => {
  const url = getTenant()?.branding?.portalUrl || process.env.APP_URL || 'https://ibbi.issqa.com.br';
  return String(url).replace(/\/$/, '');
};
const timezone = () => getTenant()?.timezone || process.env.APP_TIMEZONE || 'America/Bahia';

module.exports = { churchName, churchShort, signature, portalUrl, timezone };
