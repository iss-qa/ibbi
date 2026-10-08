// Logo da igreja: logoUrl do tenant, a imagem padrão (IBBI) para o tenant fundador,
// ou as iniciais do nome.
export default function TenantLogo({ tenant, fallback, className = 'w-12 h-12' }) {
  const base = `${className} rounded-full object-cover border-2 border-ibbiGold shrink-0`;
  if (tenant?.branding?.logoUrl) return <img src={tenant.branding.logoUrl} alt={tenant.nomeCurto || tenant.nome} className={base} />;
  // Sem `fallback` (telas com a marca do PastorIA), o tenant fundador também usa as iniciais.
  if (fallback && (!tenant || tenant.slug === (import.meta.env.VITE_DEFAULT_TENANT || 'ibbi'))) {
    return <img src={fallback} alt={tenant?.nomeCurto || 'Igreja'} className={base} />;
  }
  const initials = String(tenant.nomeCurto || tenant.nome || '?')
    .split(/\s+/).filter((w) => w.length > 2 || /^[A-Z]/.test(w)).slice(0, 3).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className={`${base} bg-ibbiNavy text-ibbiGold flex items-center justify-center font-display font-bold`}>
      {initials || '✝'}
    </div>
  );
}
