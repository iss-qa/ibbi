// Email da fatura da assinatura (identidade do PastorIA, não da igreja): valor, vencimento,
// QR do Pix (anexo inline cid:pix-qr), Pix copia e cola, boleto (quando houver) e botão para a
// página de pagamento do PastorIA (/pagar/:token) — a página da Woovi mostra a marca da conta.

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const data = (d) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

const TITULO = {
  nova: 'Sua fatura do PastorIA chegou',
  reajustada: 'Fatura reajustada pela troca de plano',
  vencida: 'Fatura em atraso',
  lembrete: 'Lembrete: fatura em aberto',
};

const invoiceEmailSubject = ({ tipo = 'nova', fatura }) => {
  if (tipo === 'vencida') return `⚠️ Fatura em atraso — ${fatura.descricao}`;
  if (tipo === 'reajustada') return `Fatura reajustada — ${fatura.descricao}`;
  return `Fatura PastorIA — ${brl(fatura.valor)} · vence ${data(fatura.vencimento)}`;
};

const invoiceEmailHtml = ({ tipo = 'nova', igreja, fatura, pagarUrl, brCode, temQr, boleto, suspendeAposDias, logoUrl }) => {
  const aviso = tipo === 'vencida'
    ? `<p style="margin:0 0 14px;padding:12px 16px;border-radius:12px;background:#fdecec;color:#8a1c1c;font-size:14px;line-height:1.6;">
        Esta fatura venceu em <strong>${esc(data(fatura.vencimento))}</strong>. Com ${esc(suspendeAposDias)} dias de atraso o acesso e as
        automações são suspensos até o pagamento — a liberação é automática assim que o Pix cair.</p>`
    : '';
  const reajuste = tipo === 'reajustada' && fatura.observacao
    ? `<p style="margin:0 0 14px;color:#475569;font-size:14px;">${esc(fatura.observacao)}.</p>` : '';
  return `
  <div style="margin:0;padding:0;background:#f7f3ea;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
      <div style="text-align:center;padding:4px 0 18px;">
        ${logoUrl
    ? `<img src="${esc(logoUrl)}" alt="PastorIA" width="180" height="44" style="display:inline-block;width:180px;max-width:180px;height:44px;border:0;">`
    : '<span style="color:#0a1f44;font-size:22px;font-family:Georgia,serif;">PastorIA</span>'}
      </div>
      <div style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(10,31,68,0.10);">
        <div style="background:#0a1f44;padding:22px 28px;">
          <p style="margin:0;color:#c9a227;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;font-weight:bold;">Assinatura</p>
          <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;">${esc(TITULO[tipo] || TITULO.nova)}</h1>
        </div>
        <div style="padding:24px 28px 8px;color:#0a1f44;">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Olá! Segue a fatura da <strong>${esc(igreja)}</strong>.</p>
          ${aviso}${reajuste}
          <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;margin:0 0 18px;">
            <tr><td style="padding:6px 0;color:#64748b;">Descrição</td><td style="padding:6px 0;text-align:right;">${esc(fatura.descricao)}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;">Vencimento</td><td style="padding:6px 0;text-align:right;">${esc(data(fatura.vencimento))}</td></tr>
            <tr><td style="padding:10px 0 6px;color:#64748b;border-top:1px solid #eef2f7;">Valor</td>
                <td style="padding:10px 0 6px;text-align:right;border-top:1px solid #eef2f7;font-size:24px;font-family:Georgia,serif;">${esc(brl(fatura.valor))}</td></tr>
          </table>
        </div>

        <div style="padding:0 28px 8px;text-align:center;">
          <a href="${esc(pagarUrl)}" style="display:inline-block;background:#c9a227;color:#0a1f44;text-decoration:none;font-weight:bold;padding:14px 34px;border-radius:999px;font-size:15px;">Pagar fatura</a>
        </div>

        ${brCode ? `
        <div style="padding:22px 28px 6px;text-align:center;">
          <p style="margin:0 0 10px;font-weight:bold;font-size:15px;">Pague com Pix</p>
          ${temQr ? '<img src="cid:pix-qr" alt="QR Code do Pix" width="220" height="220" style="display:inline-block;width:220px;height:220px;border:1px solid #eef2f7;border-radius:12px;">' : ''}
          <p style="margin:12px 0 6px;color:#64748b;font-size:13px;">Ou copie o código Pix (copia e cola):</p>
          <div style="margin:0 auto;max-width:520px;padding:12px;border-radius:10px;background:#f1f5f9;font-family:Consolas,Menlo,monospace;font-size:12px;color:#334155;word-break:break-all;text-align:left;">${esc(brCode)}</div>
        </div>` : ''}

        ${boleto?.digitable ? `
        <div style="padding:22px 28px 6px;">
          <p style="margin:0 0 8px;font-weight:bold;font-size:15px;text-align:center;">Ou pague com boleto</p>
          <p style="margin:0 0 6px;color:#64748b;font-size:13px;text-align:center;">Linha digitável:</p>
          <div style="padding:12px;border-radius:10px;background:#f1f5f9;font-family:Consolas,Menlo,monospace;font-size:13px;color:#334155;text-align:center;word-break:break-all;">${esc(boleto.digitable)}</div>
          ${boleto.imagem ? `<div style="text-align:center;margin-top:10px;"><img src="${esc(boleto.imagem)}" alt="Código de barras do boleto" style="max-width:100%;height:auto;"></div>` : ''}
          <p style="margin:8px 0 0;color:#94a3b8;font-size:12px;text-align:center;">O boleto leva até 3 dias úteis para compensar; o Pix confirma na hora.</p>
        </div>` : ''}

        <div style="padding:22px 28px 26px;color:#64748b;font-size:13px;line-height:1.7;">
          A confirmação é automática — não precisa enviar comprovante. Você também encontra esta fatura
          no PastorIA, em <strong>Administração → Assinatura</strong>.
        </div>
      </div>
      <p style="text-align:center;color:#94a3b8;font-size:11px;margin:18px 0 0;">
        PastorIA · Quem falta, faz falta. · Você recebeu este email por ser o contato de cobrança da ${esc(igreja)}.
      </p>
    </div>
  </div>`;
};

const invoiceEmailText = ({ tipo = 'nova', igreja, fatura, pagarUrl, brCode, boleto, suspendeAposDias }) => [
  `${TITULO[tipo] || TITULO.nova} — ${igreja}`,
  '',
  `${fatura.descricao}`,
  `Valor: ${brl(fatura.valor)} · Vencimento: ${data(fatura.vencimento)}`,
  tipo === 'vencida' ? `Com ${suspendeAposDias} dias de atraso o acesso é suspenso até o pagamento (liberação automática).` : '',
  '',
  `Pagar: ${pagarUrl}`,
  brCode ? `\nPix copia e cola:\n${brCode}` : '',
  boleto?.digitable ? `\nBoleto (linha digitável):\n${boleto.digitable}` : '',
  '',
  'A confirmação é automática.',
].filter((l) => l !== null).join('\n');

module.exports = { invoiceEmailSubject, invoiceEmailHtml, invoiceEmailText };
