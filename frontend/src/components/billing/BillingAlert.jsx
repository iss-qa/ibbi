import { useState } from 'react';
import { useTenant } from '../../context/TenantContext';
import { Button } from '../ui';
import PixPaymentModal from './PixPaymentModal';
import { descreverFatura } from './BillingBell';

// Faixa no topo do Dashboard quando a fatura está vencida (o sino cobre a fatura em dia).
export default function BillingAlert() {
  const { tenant, refresh } = useTenant();
  const [pagando, setPagando] = useState(false);
  const f = tenant?.faturaAberta;
  const info = descreverFatura(f);
  if (!info?.grave) return null;
  return (
    <div className="mb-4 rounded-2xl bg-red-50 border border-red-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3" role="alert">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-red-800">{info.titulo}</p>
        <p className="text-sm text-red-900/80 break-words">{info.detalhe}</p>
      </div>
      <Button variant="danger" className="shrink-0" onClick={() => setPagando(true)}>Pagar com Pix</Button>
      {pagando && <PixPaymentModal faturaId={f._id} onClose={() => setPagando(false)} onPaid={() => refresh()} />}
    </div>
  );
}
