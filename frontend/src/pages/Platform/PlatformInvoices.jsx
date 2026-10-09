import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import platformApi from '../../services/platformApi';
import { Badge, Button, Card, brl, fmtDate, inputClass } from '../../components/ui';
import { INVOICE_STATUS } from './constants';
import { useDialog } from '../../components/dialog/DialogProvider.jsx';

export default function PlatformInvoices() {
  const { confirm } = useDialog();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => platformApi.get('/invoices', { params: { status: status || undefined } }).then((r) => setRows(r.data)).catch(() => {});
  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn, okMsg) => {
    try {
      await fn();
      setMsg(okMsg);
      load();
    } catch (err) {
      setMsg(err?.response?.data?.message || 'Falha na operação');
    }
  };

  const total = (st) => rows.filter((r) => r.status === st).reduce((s, r) => s + r.valor, 0);

  return (
    <div className="space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-ibbiNavy">Faturas</h1>
          <p className="text-sm text-slate-500">Em aberto {brl(total('pendente'))} · vencidas {brl(total('vencido'))} · pagas {brl(total('pago'))}</p>
        </div>
        <div className="flex gap-2">
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar status">
            <option value="">Todas</option>
            {Object.entries(INVOICE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <Button variant="outline" onClick={() => act(() => platformApi.post('/billing/run'), 'Ciclo de cobrança executado.')}>Rodar ciclo</Button>
        </div>
      </header>
      {msg && <p className="text-sm text-slate-600">{msg}</p>}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500 border-b border-slate-100"><th className="py-2 pr-3">Igreja</th><th className="pr-3">Competência</th><th className="pr-3">Vencimento</th><th className="pr-3 text-right">Valor</th><th className="pr-3">Status</th><th /></tr></thead>
            <tbody>
              {rows.map((f) => {
                const s = INVOICE_STATUS[f.status];
                return (
                  <tr key={f._id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 pr-3"><Link to={`/platform/igrejas/${f.tenantId?._id}`} className="text-ibbiBlue hover:underline">{f.tenantId?.nome}</Link></td>
                    <td className="pr-3">{f.competencia} · {f.ciclo}</td>
                    <td className="pr-3">{fmtDate(f.vencimento)}</td>
                    <td className="pr-3 text-right tabular-nums">{brl(f.valor)}</td>
                    <td className="pr-3"><Badge color={s.color}>{s.label}</Badge></td>
                    <td className="py-1 text-right whitespace-nowrap">
                      {['pendente', 'vencido'].includes(f.status) && (
                        <>
                          {f.gateway?.status !== 'ACTIVE' && <Button variant="ghost" className="text-xs mr-1" onClick={() => act(() => platformApi.post(`/invoices/${f._id}/charge`), 'Pix gerado na Woovi.')}>Gerar Pix (Woovi)</Button>}
                          {f.gateway?.provider === 'woovi' && f.gateway?.id && <Button variant="ghost" className="text-xs mr-1" onClick={() => act(() => platformApi.post(`/invoices/${f._id}/sync`), 'Pix conferido na Woovi.')}>Conferir Pix</Button>}
                          {f.gateway?.invoiceUrl && <a href={f.gateway.invoiceUrl} target="_blank" rel="noreferrer" className="text-xs text-ibbiBlue mr-2">link</a>}
                          <Button variant="ghost" className="text-xs mr-1" onClick={() => act(() => platformApi.put(`/invoices/${f._id}/pay`, { metodo: 'pix' }), 'Baixa registrada.')}>Dar baixa</Button>
                          <Button variant="ghost" className="text-xs" onClick={async () => { if (await confirm({ title: 'Cancelar fatura', message: 'Cancelar fatura?', confirmLabel: 'Cancelar fatura', cancelLabel: 'Voltar', danger: true })) act(() => platformApi.put(`/invoices/${f._id}/cancel`, {}), 'Fatura cancelada.'); }}>Cancelar</Button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={6} className="text-slate-400 py-4 text-center">Nenhuma fatura.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
