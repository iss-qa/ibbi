// Email de boas-vindas ao PastorIA (cadastro público de uma nova igreja).
// Identidade da plataforma (azul marinho + dourado), não da igreja.

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const welcomeEmailSubject = (igreja) => `🐑 Bem-vindo ao PastorIA, ${igreja}!`;

const welcomeEmailHtml = ({ igreja, slug, responsavel, login, senhaTemporaria, loginUrl, trialDias }) => {
  const primeiroNome = String(responsavel || '').split(' ')[0] || 'Pastor';
  return `
  <div style="margin:0;padding:0;background:#f7f3ea;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
      <div style="background:linear-gradient(155deg,#0a1f44 0%,#112b5e 55%,#0e2450 100%);border-radius:20px;overflow:hidden;box-shadow:0 18px 40px rgba(8,22,49,0.18);">

        <div style="padding:28px 32px 8px;text-align:center;">
          <div style="display:inline-block;padding:8px 22px;border:1px solid rgba(201,162,39,0.5);border-radius:999px;color:#c9a227;font-size:13px;letter-spacing:0.22em;text-transform:uppercase;font-weight:bold;">
            PastorIA
          </div>
        </div>

        <div style="padding:20px 36px 8px;text-align:center;">
          <h1 style="margin:0 0 10px;color:#ffffff;font-size:30px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;">Quem falta, faz falta.</h1>
          <p style="margin:0 auto;max-width:440px;color:#cdd8ef;font-size:16px;line-height:1.7;">
            ${esc(primeiroNome)}, a <strong style="color:#fff;">${esc(igreja)}</strong> já está pronta no PastorIA.
            Você tem <strong style="color:#c9a227;">${trialDias} dias grátis</strong> para conhecer tudo.
          </p>
        </div>

        <div style="padding:18px 36px 8px;">
          <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:18px 22px;color:#fff;font-size:15px;line-height:1.9;">
            <div><span style="color:#9fb0d4;">Código da igreja:</span> <strong>${esc(slug)}</strong></div>
            <div><span style="color:#9fb0d4;">Login:</span> <strong>${esc(login)}</strong></div>
            <div><span style="color:#9fb0d4;">Senha temporária:</span> <strong style="font-family:Consolas,Menlo,monospace;letter-spacing:0.08em;">${esc(senhaTemporaria)}</strong></div>
          </div>
          <p style="margin:10px 0 0;color:#9fb0d4;font-size:12px;text-align:center;">No primeiro acesso você escolherá uma nova senha.</p>
        </div>

        <div style="padding:18px 36px 10px;text-align:center;">
          <a href="${esc(loginUrl)}" style="display:inline-block;background:#c9a227;color:#0a1f44;text-decoration:none;font-weight:bold;padding:14px 34px;border-radius:999px;font-size:15px;">Entrar agora</a>
        </div>

        <div style="padding:8px 36px 24px;color:#cdd8ef;font-size:14px;line-height:1.8;">
          <p style="margin:0 0 6px;color:#c9a227;font-weight:bold;">Próximos passos</p>
          <ol style="margin:0;padding-left:20px;">
            <li>Cadastre suas congregações e a liderança em <em>Configurações</em>.</li>
            <li>Conecte o WhatsApp da igreja (QR Code ou API Oficial).</li>
            <li>Importe ou cadastre as pessoas e ative as automações.</li>
          </ol>
        </div>

        <div style="padding:18px 24px 26px;text-align:center;border-top:1px solid rgba(255,255,255,0.08);">
          <p style="margin:0;color:#9fb0d4;font-size:13px;font-style:italic;">"Deixa as noventa e nove e vai após a perdida até que a encontre." — Lucas 15:4</p>
        </div>
      </div>

      <p style="text-align:center;color:#94a3b8;font-size:11px;margin:18px 0 0;">
        Você recebeu este email porque cadastrou uma igreja no PastorIA.
      </p>
    </div>
  </div>`;
};

const signupAlertHtml = ({ igreja, slug, responsavel, email, celular, cidade, uf, plano }) => `
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0a1f44;line-height:1.7;">
    <h2 style="margin:0 0 8px;">🐑 Nova igreja cadastrada pela landing page</h2>
    <ul style="margin:0;padding-left:18px;">
      <li><strong>Igreja:</strong> ${esc(igreja)} (<code>${esc(slug)}</code>)</li>
      <li><strong>Responsável:</strong> ${esc(responsavel)}</li>
      <li><strong>Email:</strong> ${esc(email)}</li>
      <li><strong>WhatsApp:</strong> ${esc(celular)}</li>
      <li><strong>Cidade:</strong> ${esc([cidade, uf].filter(Boolean).join(' / ') || '—')}</li>
      <li><strong>Plano (trial):</strong> ${esc(plano)}</li>
    </ul>
  </div>`;

module.exports = { welcomeEmailSubject, welcomeEmailHtml, signupAlertHtml };
