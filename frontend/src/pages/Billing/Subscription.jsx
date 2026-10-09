import { useEffect, useState } from 'react';
import Header from '../../components/Header';
import api from '../../services/api';
import { useTenant } from '../../context/TenantContext';
import useAuth from '../../hooks/useAuth';
import PlanCards from '../../components/PlanCards';
import IndiqueGanhe from '../../components/IndiqueGanhe';
import PixPaymentModal from '../../components/billing/PixPaymentModal';
import { Badge, Button, Card, KpiCard, brl, fmtDate } from '../../components/ui';

const STATUS_FATURA = {
  pendente: { color: 'amber', label: 'Em aberto' },
  pago: { color: 'green', label: 'Paga' },
  vencido: { color: 'red', label: 'Vencida' },
  cancelado: { color: 'gray', label: 'Cancelada' },
};
const STATUS_IGREJA = {
  trial: { color: 'blue', label: 'Período de teste' },
  ativa: { color: 'green', label: 'Ativa' },
  inadimplente: { color: 'orange', label: 'Pagamento pendente' },
  suspensa: { color: 'red', label: 'Suspensa' },
  cancelada: { color: 'gray', label: 'Cancelada' },
};

const pct = (v, max) => (max ? Math.min(100, Math.round((v / max) * 100)) : 0);

function UsageBar({ label, value, max }) {
  const p = pct(value, max);
  return (
    <div>
      <div className="flex justify-between gap-2 text-sm mb-1">
        <span className="text-slate-600 min-w-0">{label}</span>
        <span className="tabular-nums text-slate-700 whitespace-nowrap">{value.toLocaleString('pt-BR')}{max ? ` / ${max.toLocaleString('pt-BR')}` : ' · ilimitado'}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full rounded-full ${p >= 90 ? 'bg-red-500' : p >= 70 ? 'bg-amber-500' : 'bg-ibbiBlue'}`} style={{ width: `${max ? p : 0}%` }} />
      </div>
    </div>
  );
}

export default function Subscription() {
  const { tenant, refresh } = useTenant();
  const { user } = useAuth();
  const isMaster = user?.role === 'master';
  const [data, setData] = useState(null);
  const [ciclo, setCiclo] = useState('mensal');
  const [msg, setMsg] = useState(null);
  const [pagando, setPagando] = useState(null);

  const load = () => api.get('/tenant/billing').then((r) => { setData(r.data); setCiclo(r.data.billing?.ciclo || 'mensal'); }).catch(() => {});
  useEffect(() => { load(); }, []);

  const changePlan = async (plan) => {
    if (plan.sobConsulta) {
      setMsg({ ok: true, text: 'Nossa equipe vai entrar em contato para montar o plano Rede.' });
      return;
    }
    if (!window.confirm(`Mudar para o plano ${plan.nome} (${ciclo})? Se houver fatura em aberto neste mês, ela será reajustada para o novo valor.`)) return;
    try {
      const { data: r } = await api.put('/tenant/billing/plan', { plano: plan.id, ciclo });
      await refresh();
      await load();
      const reaj = r.faturasReajustadas?.[0];
      setMsg({ ok: true, text: `Plano alterado para ${plan.nome}.${reaj ? ` A fatura do mês foi reajustada para ${brl(reaj.valor)} — pague com o novo Pix.` : ''}` });
    } catch (err) {
      setMsg({ ok: false, text: err?.response?.data?.message || 'Falha ao trocar de plano' });
    }
  };

  const onPaid = () => {
    refresh();
    load();
    setMsg({ ok: true, text: 'Pagamento confirmado. Obrigado!' });
  };

  if (!data || !tenant) return <p className="text-sm text-slate-500">Carregando...</p>;
  const st = STATUS_IGREJA[data.status] || STATUS_IGREJA.ativa;
  const lim = tenant.planoInfo?.limites || {};
  const uso = tenant.consumo || {};
  const abertas = data.faturas.filter((f) => ['pendente', 'vencido'].includes(f.status));

  return (
    <div>
      <Header title="Assinatura" subtitle={tenant.nome} action={<Badge color={st.color}>{st.label}</Badge>} />
      {data.status === 'suspensa' && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-900" role="alert">
          <p className="font-semibold">Acesso suspenso por fatura em atraso.</p>
          <p className="mt-0.5">O sistema e as automações voltam assim que o Pix for pago — a liberação é automática.</p>
        </div>
      )}
      {data.status === 'inadimplente' && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900" role="alert">
          Há fatura vencida. Com {data.politica?.suspendAfterDays || 7} dias de atraso o acesso e as automações são suspensos até o pagamento.
        </div>
      )}
      {msg && <p className={`text-sm mb-4 ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}

      {abertas.length > 0 && (
        <Card title={abertas.length === 1 ? 'Fatura em aberto' : `${abertas.length} faturas em aberto`} subtitle="Pagamento por Pix, confirmação automática" className="mb-6">
          <ul className="divide-y divide-slate-100">
            {[...abertas].sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento)).map((f) => (
              <li key={f._id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-slate-800 break-words">{f.descricao}</p>
                  <p className="text-xs text-slate-500">Vencimento {fmtDate(f.vencimento)}{f.observacao ? ` · ${f.observacao}` : ''}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-display text-xl text-ibbiNavy tabular-nums">{brl(f.valor)}</span>
                  <Badge color={STATUS_FATURA[f.status].color}>{STATUS_FATURA[f.status].label}</Badge>
                  <Button onClick={() => setPagando(f._id)}>Pagar com Pix</Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isMaster && <IndiqueGanhe />}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <KpiCard label="Plano" value={tenant.planoInfo?.nome || data.plano} hint={data.billing?.isento ? 'Cliente fundador · isento' : `Ciclo ${data.billing?.ciclo}`} />
        <KpiCard label="Período de teste até" value={data.status === 'trial' ? fmtDate(data.trialEndsAt) : '—'} />
        <KpiCard label="Em aberto" value={brl(abertas.reduce((s, f) => s + f.valor, 0))} accent={abertas.length ? 'text-red-600' : undefined} />
        <KpiCard label="Pessoas ativas" value={`${tenant.pessoasAtivas ?? '—'}${lim.pessoas ? ` / ${lim.pessoas}` : ''}`} />
      </section>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card title="Consumo do mês" subtitle={uso.periodo}>
          <div className="space-y-4">
            <UsageBar label="Pessoas ativas" value={tenant.pessoasAtivas || 0} max={lim.pessoas} />
            <UsageBar label="Mensagens WhatsApp enviadas" value={uso.whatsappEnviadas || 0} max={lim.whatsappMensagensMes} />
            <UsageBar label="Interações com o assistente de IA" value={uso.iaInteracoes || 0} max={lim.iaInteracoesMes} />
          </div>
        </Card>
        <Card title="Faturas">
          {data.faturas.length === 0 && <p className="text-sm text-slate-400">Nenhuma fatura ainda.</p>}
          <ul className="divide-y divide-slate-100">
            {data.faturas.map((f) => {
              const s = STATUS_FATURA[f.status];
              return (
                <li key={f._id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-slate-800">{f.descricao}</p>
                    <p className="text-xs text-slate-500">Vencimento {fmtDate(f.vencimento)}{f.pagoEm ? ` · pago em ${fmtDate(f.pagoEm)}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="tabular-nums font-medium">{brl(f.valor)}</span>
                    <Badge color={s.color}>{s.label}</Badge>
                    {['pendente', 'vencido'].includes(f.status) && (
                      <button type="button" onClick={() => setPagando(f._id)} className="text-ibbiBlue font-medium hover:underline">Pagar</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {isMaster && (
      <Card
        title="Planos"
        subtitle="Uma assinatura por igreja — todas as congregações incluídas"
        action={(
          <div className="flex bg-slate-100 rounded-lg p-0.5 text-sm" role="tablist" aria-label="Ciclo de cobrança">
            {['mensal', 'anual'].map((c) => (
              <button key={c} type="button" role="tab" aria-selected={ciclo === c} onClick={() => setCiclo(c)} className={`px-3 py-1 rounded-md ${ciclo === c ? 'bg-white shadow text-ibbiNavy font-medium' : 'text-slate-500'}`}>
                {c === 'mensal' ? 'Mensal' : 'Anual (-17%)'}
              </button>
            ))}
          </div>
        )}
      >
        <PlanCards plans={data.planos} ciclo={ciclo} current={data.billing?.ciclo === ciclo ? data.plano : null} onSelect={changePlan} selectLabel="Mudar para este plano" />
      </Card>
      )}
      {pagando && <PixPaymentModal faturaId={pagando} onClose={() => setPagando(null)} onPaid={onPaid} />}
    </div>
  );
}
