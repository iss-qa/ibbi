// Atalhos de login para desenvolvimento. Só renderiza em `vite dev` acessando por localhost;
// no build de produção `import.meta.env.DEV` é false e o bloco (com as credenciais) é removido.
const DEV_USERS = import.meta.env.DEV ? (() => {
  try {
    return JSON.parse(import.meta.env.VITE_DEV_USERS || '{}');
  } catch {
    return {};
  }
})() : {};

export const isLocalDev = () => import.meta.env.DEV
  && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

export const devUser = (key) => (isLocalDev() ? DEV_USERS[key] : null);

const OPTIONS = [
  { key: 'membro', label: 'Membro', desc: 'usuário comum' },
  { key: 'admin', label: 'Administrador', desc: 'liderança (admin)' },
  { key: 'gestor', label: 'Gestor', desc: 'dono da igreja (master)' },
  { key: 'plataforma', label: 'Plataforma', desc: 'gestão multi-tenant' },
];

export default function DevQuickLogin({ onPick }) {
  if (!isLocalDev()) return null;
  const available = OPTIONS.filter((o) => DEV_USERS[o.key]);
  return (
    <div className="mt-6 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 mb-2">Ambiente local · preencher login</p>
      {available.length === 0 ? (
        <p className="text-xs text-amber-800">Defina VITE_DEV_USERS em frontend/.env.development.local (veja .env.example).</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {available.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => onPick(o.key, DEV_USERS[o.key])}
              className="rounded-md bg-white border border-amber-200 px-2 py-1.5 text-left hover:bg-amber-100 transition"
            >
              <span className="block text-sm font-medium text-slate-800">{o.label}</span>
              <span className="block text-[10px] text-slate-500">{o.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
