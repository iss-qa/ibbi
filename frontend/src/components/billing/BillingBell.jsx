import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../context/TenantContext';
import { Button, brl, fmtDate } from '../ui';
import PixPaymentModal from './PixPaymentModal';

const diasAte = (data) => Math.ceil((new Date(data) - Date.now()) / 864e5);

// Texto da fatura em aberto: vence em X / vencida há N dias (e quando o acesso é suspenso).
export const descreverFatura = (f) => {
  if (!f) return null;
  if (f.diasAtraso > 0) {
    const faltam = diasAte(f.suspendeEm);
    return {
      grave: true,
      titulo: `Fatura vencida há ${f.diasAtraso} ${f.diasAtraso === 1 ? 'dia' : 'dias'}`,
      detalhe: faltam > 0
        ? `${brl(f.valor)} · o acesso será suspenso em ${faltam} ${faltam === 1 ? 'dia' : 'dias'} (${fmtDate(f.suspendeEm)})`
        : `${brl(f.valor)} · pague para liberar o acesso`,
    };
  }
  const dias = diasAte(f.vencimento);
  return {
    grave: false,
    titulo: 'Fatura em aberto',
    detalhe: `${brl(f.valor)} · vence ${dias <= 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${fmtDate(f.vencimento)}`}`,
  };
};

// Sino de notificações de cobrança (painel da liderança).
export default function BillingBell() {
  const { tenant, refresh } = useTenant();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [pagando, setPagando] = useState(null);
  const ref = useRef(null);
  const f = tenant?.faturaAberta;
  const info = descreverFatura(f);

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (!ref.current?.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [aberto]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="relative w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-ibbiNavy hover:bg-slate-50 transition"
        aria-label={f ? `Notificações: ${info.titulo}` : 'Notificações'}
        aria-expanded={aberto}
        aria-haspopup="dialog"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
        </svg>
        {f && (
          <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-white ${info.grave ? 'bg-red-600' : 'bg-amber-500'}`}>
            {f.abertas || 1}
          </span>
        )}
      </button>

      {aberto && (
        <div role="dialog" aria-label="Notificações" className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-30 text-left">
          {!f ? (
            <p className="text-sm text-slate-500">Nenhuma fatura em aberto. Tudo em dia! 🙌</p>
          ) : (
            <>
              <p className={`text-sm font-semibold ${info.grave ? 'text-red-700' : 'text-amber-700'}`}>{info.titulo}</p>
              <p className="text-sm text-slate-600 mt-1 break-words">{f.descricao}</p>
              <p className="text-sm text-slate-600 mt-0.5">{info.detalhe}</p>
              {f.abertas > 1 && <p className="text-xs text-slate-500 mt-1">{f.abertas} faturas em aberto</p>}
              <div className="mt-3 flex gap-2">
                <Button className="flex-1" onClick={() => { setAberto(false); setPagando(f._id); }}>Pagar com Pix</Button>
                <Button variant="ghost" onClick={() => { setAberto(false); navigate('/assinatura'); }}>Assinatura</Button>
              </div>
            </>
          )}
        </div>
      )}

      {pagando && <PixPaymentModal faturaId={pagando} onClose={() => setPagando(null)} onPaid={() => refresh()} />}
    </div>
  );
}
