import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

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
  const [dropdownDirection, setDropdownDirection] = useState('down');
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState(280);
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const ref = useRef(null);
  const dropdownRef = useRef(null);

  // Fecha ao clicar fora (checks both trigger and portal dropdown)
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const inTrigger = ref.current && ref.current.contains(e.target);
      const inDropdown = dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!inTrigger && !inDropdown) setOpen(false);
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

  // Calcula direção e altura do dropdown conforme o espaço disponível
  useEffect(() => {
    if (!open || !ref.current) return;

    const updateDropdownLayout = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
      const margin = 16;
      const gap = 8;
      const spaceBelow = viewportHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;

      const shouldOpenUp = spaceBelow < 220 && spaceAbove > spaceBelow;
      const availableSpace = shouldOpenUp ? spaceAbove - gap : spaceBelow - gap;

      setDropdownDirection(shouldOpenUp ? 'up' : 'down');
      setDropdownMaxHeight(Math.max(180, Math.min(320, availableSpace)));
      setDropdownStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        top: shouldOpenUp ? 'auto' : rect.bottom + gap,
        bottom: shouldOpenUp ? viewportHeight - rect.top + gap : 'auto',
        maxHeight: `${Math.max(180, Math.min(320, availableSpace))}px`,
      });
    };

    updateDropdownLayout();

    window.addEventListener('resize', updateDropdownLayout);
    window.addEventListener('scroll', updateDropdownLayout, true);

    return () => {
      window.removeEventListener('resize', updateDropdownLayout);
      window.removeEventListener('scroll', updateDropdownLayout, true);
    };
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
    'w-full flex items-center justify-between rounded-2xl px-4 py-3 text-[15px] sm:text-sm text-slate-800 bg-white/90 border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-4 focus:ring-blue-100/70 focus:border-blue-300 transition-all min-h-[48px] sm:min-h-[48px] select-none';

  const disabledBtn = 'opacity-60 cursor-not-allowed bg-slate-100 text-slate-400';

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`${baseBtn} ${disabled ? disabledBtn : 'cursor-pointer hover:border-slate-300 hover:bg-white hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]'} ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={hasValue ? 'text-slate-800 truncate font-medium' : 'text-slate-400 truncate'}>
          {selectedLabel}
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${open ? 'rotate-180 text-blue-500' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && !disabled && dropdownStyle && createPortal(
        <div
          ref={dropdownRef}
          className="z-[300] bg-white border border-slate-200/90 rounded-2xl shadow-[0_18px_50px_rgba(15,23,42,0.14)] overflow-hidden"
          style={{
            ...dropdownStyle,
            overflowY: 'auto',
          }}
          role="listbox"
        >
          {options.map((opt, idx) => {
            if (opt.group) {
              return (
                <div key={opt.group}>
                  <div className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.18em] bg-slate-50 border-b border-slate-100">
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
                          ? 'bg-blue-50 text-blue-700 font-semibold'
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
                    ? 'bg-blue-50 text-blue-700 font-semibold'
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
        </div>,
        document.body
      )}
    </div>
  );
}
