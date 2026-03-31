import { useState, useRef, useEffect } from 'react';

/**
 * CustomSelect — dropdown nativo melhorado para mobile e desktop.
 *
 * Props:
 *  - value: string
 *  - onChange: (value: string) => void
 *  - options: Array<{ value: string; label: string }> | Array<{ group: string; options: Array<{ value: string; label: string }> }>
 *  - placeholder: string (texto quando nenhum valor está selecionado)
 *  - disabled: boolean
 *  - className: string (classes extras para o botão trigger)
 */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = '—',
  disabled = false,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  // Fecha com ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Scroll into view quando abre
  useEffect(() => {
    if (open && ref.current) {
      setTimeout(() => {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }, [open]);

  // Resolve o label selecionado (suporta grupos)
  const getSelectedLabel = () => {
    for (const opt of options) {
      if (opt.group) {
        const found = opt.options.find((o) => o.value === value);
        if (found) return found.label;
      } else if (opt.value === value) {
        return opt.label;
      }
    }
    return placeholder;
  };

  const selectedLabel = getSelectedLabel();
  const hasValue = value !== '' && value !== undefined && value !== null;

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
  };

  const baseBtn =
    'w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2.5 text-[16px] sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition min-h-[44px] sm:min-h-[36px] select-none';

  const disabledBtn = 'opacity-60 cursor-not-allowed bg-slate-50';

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`${baseBtn} ${disabled ? disabledBtn : 'cursor-pointer hover:border-slate-300 bg-slate-50'} ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={hasValue ? 'text-slate-800 truncate' : 'text-slate-400'}>
          {selectedLabel}
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && !disabled && (
        <div
          className="absolute z-[200] mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
          style={{ maxHeight: '280px', overflowY: 'auto' }}
          role="listbox"
        >
          {options.map((opt, idx) => {
            // Grupo de opções
            if (opt.group) {
              return (
                <div key={opt.group}>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100">
                    {opt.group}
                  </div>
                  {opt.options.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      role="option"
                      aria-selected={value === o.value}
                      onClick={() => handleSelect(o.value)}
                      className={`w-full text-left px-4 py-3 text-[15px] sm:text-sm transition flex items-center justify-between gap-2 ${
                        value === o.value
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100'
                      }`}
                    >
                      <span>{o.label}</span>
                      {value === o.value && (
                        <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              );
            }

            // Opção simples
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={value === opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`w-full text-left px-4 py-3 text-[15px] sm:text-sm transition flex items-center justify-between gap-2 ${
                  idx !== 0 ? 'border-t border-slate-50' : ''
                } ${
                  value === opt.value
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100'
                }`}
              >
                <span>{opt.label}</span>
                {value === opt.value && (
                  <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
