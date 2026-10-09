const { getTenantBySlug } = require('../tenancy/tenant.service');
const { runWithTenant } = require('../tenancy/context');
const { portalUrl, churchShort } = require('../tenancy/brand');
const cultoSvc = require('../services/culto.service');

// Link do convite de check-in (/c/:slug/:codigo). A prévia do WhatsApp mostra o logo da igreja
// (Open Graph) e a página abre o wa.me com "CHEGUEI <código>" pronto.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const html = ({ titulo, descricao, imagem, url, destino, corpo }) => `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title>
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:image" content="${esc(imagem)}">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary">
${destino ? `<meta http-equiv="refresh" content="0;url=${esc(destino)}">` : ''}
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a1f44;color:#fff;font-family:Inter,system-ui,sans-serif;text-align:center;padding:24px}
img{width:96px;height:96px;border-radius:50%;border:3px solid #c9a227;object-fit:cover;background:#fff}
a{display:inline-block;margin-top:20px;background:#25d366;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px}
p{color:rgba(255,255,255,.75)}</style>
</head><body><main><img src="${esc(imagem)}" alt=""><h1>${esc(titulo)}</h1>${corpo}</main></body></html>`;

const CODIGO_RE = /^[a-z0-9]{4,8}$/i;

const page = async (req, res) => {
  const tenant = await getTenantBySlug(req.params.slug);
  if (!tenant || tenant.status === 'cancelada' || !CODIGO_RE.test(req.params.codigo)) return res.status(404).send('Link inválido');
  return runWithTenant(tenant, async () => {
    const base = portalUrl();
    const imagem = `${base}/api/public/tenants/${tenant.slug}/logo`;
    const url = `${base}/c/${tenant.slug}/${req.params.codigo}`;
    const culto = await cultoSvc.cultoPorCodigo(req.params.codigo);
    res.set('Cache-Control', 'no-store');
    if (!culto || !cultoSvc.numeroBot()) {
      return res.status(410).send(html({
        titulo: `Check-in · ${churchShort()}`, descricao: 'Este check-in já foi encerrado.', imagem, url,
        corpo: '<p>Este check-in já foi encerrado. Até o próximo culto! 🙏</p>',
      }));
    }
    const destino = cultoSvc.linkCheckin(culto);
    return res.send(html({
      titulo: `Check-in · ${culto.titulo} · ${churchShort()}`,
      descricao: 'Toque para registrar sua presença pelo WhatsApp. Leva 5 segundos 🙏',
      imagem, url, destino,
      corpo: `<p>Abrindo o WhatsApp…</p><a href="${esc(destino)}">Registrar presença no WhatsApp</a>`,
    }));
  });
};

// Logo da igreja para a prévia de links: imagem salva (data URL), link https ou a marca do PastorIA.
const logo = async (req, res) => {
  const tenant = await getTenantBySlug(req.params.slug);
  const v = tenant?.branding?.logoUrl || '';
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  const data = v.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (data) {
    res.set('Cache-Control', 'public, max-age=3600');
    return res.type(data[1]).send(Buffer.from(data[2], 'base64'));
  }
  if (/^https:\/\//i.test(v)) return res.redirect(302, v);
  return res.redirect(302, '/brand/pastoria-mark-512.png');
};

module.exports = { page, logo };
