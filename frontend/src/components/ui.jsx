// Peças visuais reutilizadas pelas telas de Cuidado Pastoral, Configurações, Assinatura e Plataforma.

export function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`bg-white rounded-xl border border-stone-100 p-4 sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            {title && <h3 className="font-display text-lg sm:text-xl text-ibbiNavy">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function KpiCard({ label, value, hint, accent }) {
  return (
    <div className="bg-white rounded-xl border border-stone-100 p-3 sm:p-4">
      <p className="text-[11px] sm:text-sm text-slate-500 leading-snug">{label}</p>
      <p className={`text-xl sm:text-2xl font-semibold mt-1 sm:mt-2 tabular-nums ${accent || 'text-ibbiNavy'}`}>{value}</p>
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

const BADGE = {
  gray: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-800',
  orange: 'bg-orange-50 text-orange-700',
  red: 'bg-red-50 text-red-700',
  navy: 'bg-ibbiNavy text-white',
};

export function Badge({ color = 'gray', icon, children }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${BADGE[color] || BADGE.gray}`}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}

export function Button({ variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-ibbiBlue text-white hover:bg-ibbiNavy',
    gold: 'bg-ibbiGold text-ibbiNavy hover:brightness-95',
    ghost: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border border-slate-200 text-slate-700 hover:bg-slate-50',
  };
  return (
    <button
      type="button"
      className={`px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-display text-lg text-ibbiNavy">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Fechar">×</button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="block text-[11px] text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

export const inputClass = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ibbiBlue disabled:bg-slate-50';

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-1">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 relative w-10 h-6 rounded-full transition shrink-0 ${checked ? 'bg-ibbiBlue' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-4' : ''}`} />
      </button>
      <span>
        <span className="text-sm text-slate-700">{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
    </label>
  );
}

export const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('pt-BR') : '—');
