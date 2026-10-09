import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Field, Modal, inputClass } from '../ui.jsx';

// Substitui window.confirm / window.prompt / window.alert por diálogos no visual do app.
// Uso: const { confirm, prompt, alert } = useDialog();
//      if (!(await confirm({ title: 'Excluir', message: 'Excluir?', danger: true }))) return;
// Cada função aceita um objeto de opções ou só a mensagem (string) e devolve uma Promise.

const DialogContext = createContext(null);

const DEFAULT_TITLES = { confirm: 'Confirmar', alert: 'Aviso', prompt: 'Informe' };

const normalize = (opts) => (typeof opts === 'string' ? { message: opts } : { ...(opts || {}) });

export function DialogProvider({ children }) {
  // Fila: só o primeiro é exibido; os demais esperam a vez.
  const [queue, setQueue] = useState([]);
  const seq = useRef(0);

  const open = useCallback((kind, opts) => new Promise((resolve) => {
    seq.current += 1;
    setQueue((q) => [...q, { id: seq.current, kind, opts: normalize(opts), resolve }]);
  }), []);

  const close = useCallback((id, value) => {
    setQueue((q) => {
      const item = q.find((d) => d.id === id);
      if (item) item.resolve(value);
      return q.filter((d) => d.id !== id);
    });
  }, []);

  const api = useMemo(() => ({
    confirm: (opts) => open('confirm', opts),
    prompt: (opts) => open('prompt', opts),
    alert: (opts) => open('alert', opts),
  }), [open]);

  const current = queue[0];

  return (
    <DialogContext.Provider value={api}>
      {children}
      {current && <DialogView key={current.id} dialog={current} onClose={close} />}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog precisa estar dentro de <DialogProvider>.');
  return ctx;
}

function DialogView({ dialog, onClose }) {
  const { id, kind, opts } = dialog;
  const {
    title = DEFAULT_TITLES[kind],
    message,
    label,
    placeholder,
    options,
    multiline = false,
    required = false,
    danger = false,
  } = opts;
  const confirmLabel = opts.confirmLabel || (kind === 'confirm' ? 'Confirmar' : 'OK');
  const cancelLabel = opts.cancelLabel || 'Cancelar';

  const [value, setValue] = useState(() => {
    if (opts.defaultValue != null) return String(opts.defaultValue);
    if (options?.length) return String(options[0].value);
    return '';
  });
  const primaryRef = useRef(null);
  const inputRef = useRef(null);

  const cancelValue = kind === 'confirm' ? false : kind === 'prompt' ? null : undefined;
  const cancel = useCallback(() => onClose(id, cancelValue), [id, cancelValue, onClose]);
  const invalid = kind === 'prompt' && required && !value.trim();
  const submit = () => {
    if (kind === 'confirm') onClose(id, true);
    else if (kind === 'prompt') { if (!invalid) onClose(id, value); }
    else onClose(id, undefined);
  };

  // Foco inicial + devolve o foco ao elemento anterior ao fechar.
  useEffect(() => {
    const previous = document.activeElement;
    const target = kind === 'prompt' ? inputRef.current : primaryRef.current;
    target?.focus();
    if (target && typeof target.select === 'function' && kind === 'prompt' && !options) target.select();
    return () => { if (previous && typeof previous.focus === 'function') previous.focus(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc cancela (em captura, para não fechar também um modal que esteja por baixo).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [cancel]);

  const footer = (
    <>
      {kind !== 'alert' && <Button variant="ghost" onClick={cancel}>{cancelLabel}</Button>}
      <Button
        ref={primaryRef}
        type="submit"
        form={`dialog-form-${id}`}
        variant={danger ? 'danger' : 'primary'}
        disabled={invalid}
      >
        {confirmLabel}
      </Button>
    </>
  );

  return (
    <Modal
      title={title}
      onClose={cancel}
      footer={footer}
      role={kind === 'prompt' ? 'dialog' : 'alertdialog'}
      layer="z-[10000]"
    >
      <form
        id={`dialog-form-${id}`}
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="space-y-3"
      >
        {message && <p className="text-sm text-slate-700 whitespace-pre-line break-words">{message}</p>}
        {kind === 'prompt' && (
          <Field label={label}>
            {options?.length ? (
              <select ref={inputRef} className={inputClass} value={value} onChange={(e) => setValue(e.target.value)}>
                {options.map((o) => <option key={o.value} value={o.value}>{o.label ?? o.value}</option>)}
              </select>
            ) : multiline ? (
              <textarea
                ref={inputRef}
                rows={4}
                className={inputClass}
                value={value}
                placeholder={placeholder}
                onChange={(e) => setValue(e.target.value)}
                // Enter quebra linha; Ctrl/Cmd+Enter confirma.
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
              />
            ) : (
              <input
                ref={inputRef}
                className={inputClass}
                value={value}
                placeholder={placeholder}
                onChange={(e) => setValue(e.target.value)}
              />
            )}
          </Field>
        )}
      </form>
    </Modal>
  );
}
