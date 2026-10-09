import { forwardRef, useEffect, useRef } from 'react';

// Peças visuais reutilizadas pelas telas de Cuidado Pastoral, Configurações, Assinatura e Plataforma.

export function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`bg-white rounded-2xl border border-stone-200/60 shadow-[0_1px_2px_rgba(10,31,68,0.04)] p-4 sm:p-6 min-w-0 ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 mb-4">
          <div className="min-w-0">
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
    <div className="bg-white rounded-2xl border border-stone-200/60 shadow-[0_1px_2px_rgba(10,31,68,0.04)] p-3 sm:p-4 min-w-0">
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

export const Button = forwardRef(function Button({ variant = 'primary', className = '', ...props }, ref) {
  const styles = {
    primary: 'bg-ibbiBlue text-white hover:bg-ibbiNavy',
    gold: 'bg-ibbiGold text-ibbiNavy hover:brightness-95',
    ghost: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border border-slate-200 text-slate-700 hover:bg-slate-50',
  };
  return (
    <button
      ref={ref}
      type="button"
      className={`px-3 py-2 rounded-xl text-sm font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${styles[variant]} ${className}`}
      {...props}
    />
  );
});

export function Modal({ title, onClose, children, footer, wide, role = 'dialog', layer = 'z-[60]' }) {
  return (
    // No celular abre como folha a partir de baixo; do sm em diante, centralizado.
    <div className={`fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center ${layer} sm:p-4`} onClick={onClose}>
      <div
        className={`bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} max-h-[92dvh] sm:max-h-[90vh] flex flex-col pb-[env(safe-area-inset-bottom)]`}
        onClick={(e) => e.stopPropagation()}
        role={role}
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-slate-100">
          <h3 className="font-display text-lg text-ibbiNavy min-w-0 truncate">{title}</h3>
          <button type="button" onClick={onClose} className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-xl leading-none shrink-0" aria-label="Fechar">×</button>
        </div>
        <div className="px-4 sm:px-5 py-4 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="px-4 sm:px-5 py-3 border-t border-slate-100 flex flex-wrap justify-end gap-2">{footer}</div>}
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

export const inputClass = 'w-full min-w-0 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-ibbiBlue/40 focus:border-ibbiBlue disabled:bg-slate-50';

// Abas em pílula: rolam na horizontal no celular, sem barra visível.
export function Tabs({ tabs, value, onChange, className = '' }) {
  const ref = useRef(null);
  // No celular a aba ativa pode estar fora da tela (ex.: aberta por ?aba=)
  useEffect(() => {
    ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [value]);
  return (
    <div ref={ref} className={`-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto scrollbar-none ${className}`}>
      <div className="inline-flex gap-1 p-1 rounded-2xl bg-white/70 border border-stone-200/60 shadow-[0_1px_2px_rgba(10,31,68,0.04)]" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={value === t.id}
            onClick={() => onChange(t.id)}
            className={`px-3.5 py-2 rounded-xl text-sm whitespace-nowrap transition flex items-center gap-1.5 ${
              value === t.id ? 'bg-ibbiNavy text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-ibbiNavy'
            }`}
          >
            {t.icon && <span aria-hidden="true">{t.icon}</span>}
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
