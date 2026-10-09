import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { Button, Modal, brl, fmtDate, fmtDateTime } from '../ui';

const POLL_MS = 5000;

// Pagamento da fatura por Pix: QR + copia e cola. Enquanto aberto, consulta a fatura até a
// Woovi confirmar o pagamento (webhook ou conferência direta) e avisa com `onPaid`.
export default function PixPaymentModal({ faturaId, onClose, onPaid }) {
  const [state, setState] = useState({ loading: true });
  const [copiado, setCopiado] = useState(false);
  const pagoRef = useRef(false);

  const confirmar = (dados) => {
    if (pagoRef.current) return;
    pagoRef.current = true;
    setState((s) => ({ ...s, loading: false, pago: true, fatura: dados.fatura || s.fatura }));
    onPaid?.(dados);
  };

  useEffect(() => {
    let ativo = true;
    api.post(`/tenant/billing/faturas/${faturaId}/pix`)
      .then(({ data }) => {
        if (!ativo) return;
        if (data.pago) confirmar(data);
        else setState({ loading: false, fatura: data.fatura, pix: data.pix });
      })
      .catch((err) => ativo && setState({ loading: false, erro: err?.response?.data?.message || 'Não foi possível gerar o Pix agora.' }));
    return () => { ativo = false; };
  }, [faturaId]);

  useEffect(() => {
    if (!state.pix || state.pago) return undefined;
    const id = setInterval(async () => {
      try {
        const { data } = await api.get(`/tenant/billing/faturas/${faturaId}`);
        if (data.fatura?.status === 'pago') confirmar(data);
      } catch { /* tenta de novo no próximo intervalo */ }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [state.pix, state.pago, faturaId]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(state.pix.brCode);
    } catch {
      // Navegador sem permissão de área de transferência: seleciona o texto para copiar à mão
      document.getElementById('pix-brcode')?.select();
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const { fatura, pix } = state;
  return (
    <Modal
      title={state.pago ? 'Pagamento confirmado' : 'Pagar com Pix'}
      onClose={onClose}
      footer={<Button variant={state.pago ? 'primary' : 'ghost'} onClick={onClose}>{state.pago ? 'Concluir' : 'Fechar'}</Button>}
    >
      {state.loading && (
        <div className="flex flex-col items-center gap-3 py-10" aria-busy="true">
          <div className="w-9 h-9 border-4 border-ibbiBlue/20 border-t-ibbiBlue rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Gerando o Pix…</p>
        </div>
      )}

      {state.erro && <p className="text-sm text-red-600 py-6 text-center">{state.erro}</p>}

      {state.pago && (
        <div className="flex flex-col items-center text-center gap-3 py-6">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="font-display text-xl text-ibbiNavy">Obrigado!</p>
          <p className="text-sm text-slate-600 max-w-xs">
            Recebemos o pagamento{fatura ? ` de ${brl(fatura.valorPago ?? fatura.valor)}` : ''}. O acesso da igreja está liberado.
          </p>
        </div>
      )}

      {pix && !state.pago && (
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <p className="text-sm text-slate-500 break-words">{fatura?.descricao}</p>
            <p className="font-display text-3xl text-ibbiNavy tabular-nums mt-1">{brl(fatura?.valor)}</p>
            <p className="text-xs text-slate-500 mt-1">
              Vencimento {fmtDate(fatura?.vencimento)}{pix.expiraEm ? ` · QR válido até ${fmtDateTime(pix.expiraEm)}` : ''}
            </p>
          </div>

          {pix.qrCode && (
            <img src={pix.qrCode} alt="QR Code do Pix" className="w-56 h-56 sm:w-64 sm:h-64 rounded-xl border border-slate-100" />
          )}

          <div className="w-full">
            <label htmlFor="pix-brcode" className="text-xs font-medium text-slate-600">Pix copia e cola</label>
            <div className="mt-1 flex gap-2">
              <input
                id="pix-brcode"
                readOnly
                value={pix.brCode || ''}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-700"
              />
              <Button onClick={copiar} className="shrink-0">{copiado ? 'Copiado!' : 'Copiar'}</Button>
            </div>
          </div>

          <div className="w-full flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900" role="status" aria-live="polite">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" aria-hidden="true" />
            Aguardando o pagamento… a confirmação aparece aqui sozinha.
          </div>

          {pix.invoiceUrl && (
            <a href={pix.invoiceUrl} target="_blank" rel="noreferrer" className="text-sm text-ibbiBlue font-medium hover:underline">
              Abrir a página de pagamento da Woovi
            </a>
          )}
        </div>
      )}
    </Modal>
  );
}
