import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import platformApi from '../../services/platformApi';
import { Card, KpiCard, brl } from '../../components/ui';

// Paleta categórica validada (dataviz): slot 1 azul, slot 2 laranja. Texto sempre em tons de tinta.
const SERIES = ['#2a78d6', '#eb6834'];
const INK = { primary: '#0f172a', secondary: '#475569', muted: '#94a3b8', grid: '#e2e8f0' };
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesLabel = (m) => `${MES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
const compactBrl = (v) => (v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `R$ ${v}`);

function ChartTooltip({ active, payload, label, money }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="font-medium mb-1" style={{ color: INK.primary }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2" style={{ color: INK.secondary }}>
          <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} aria-hidden="true" />
          {p.name}: <span className="tabular-nums" style={{ color: INK.primary }}>{money ? brl(p.value) : p.value.toLocaleString('pt-BR')}</span>
        </p>
      ))}
    </div>
  );
}

const axisProps = { tick: { fill: INK.secondary, fontSize: 11 }, axisLine: false, tickLine: false };

function SimpleBars({ data, dataKey, name, money, height = 200 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={INK.grid} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={money ? 64 : 40} tickFormatter={money ? compactBrl : undefined} allowDecimals={false} />
        <Tooltip content={<ChartTooltip money={money} />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
        <Bar dataKey={dataKey} name={name} fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function PlatformDashboard() {
  const [m, setM] = useState(null);
  const [error, setError] = useState('');
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    platformApi.get('/metrics').then((r) => setM(r.data)).catch((err) => setError(err?.response?.data?.message || 'Falha ao carregar métricas'));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!m) return <p className="text-sm text-slate-500">Carregando...</p>;
  const k = m.kpis;
  const serie = m.serie.map((s) => ({ ...s, label: mesLabel(s.mes) }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl md:text-3xl text-ibbiNavy">Dashboard da plataforma</h1>
        <p className="text-sm text-slate-500">Receita recorrente, igrejas parceiras e consumo</p>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="MRR" value={brl(k.mrr)} hint={`ARR ${brl(k.arr)}`} />
        <KpiCard label="Igrejas pagantes" value={k.igrejasPagantes} hint={`${k.igrejasTotal} no total · ARPA ${brl(k.arpa)}`} />
        <KpiCard label="Em trial" value={k.trials} hint={`${k.trialsExpirando7d} expiram em 7 dias`} />
        <KpiCard label="Recebido no mês" value={brl(k.recebidoMes)} hint={`${brl(k.emAberto)} a vencer`} />
        <KpiCard label="Vencido" value={brl(k.vencido)} hint={`${k.faturasVencidas} fatura(s)`} accent={k.vencido ? 'text-red-600' : undefined} />
        <KpiCard label="Inadimplentes" value={k.inadimplentes} accent={k.inadimplentes ? 'text-orange-600' : undefined} />
        <KpiCard label="Suspensas" value={k.suspensas} accent={k.suspensas ? 'text-red-600' : undefined} />
        <KpiCard label="Churn (30 dias)" value={`${k.churn30d}%`} />
      </section>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card
          className="lg:col-span-2"
          title="Faturado × recebido"
          subtitle="Por competência, últimos 12 meses"
          action={<button type="button" className="text-xs text-ibbiBlue" onClick={() => setShowTable((v) => !v)}>{showTable ? 'Ver gráfico' : 'Ver tabela'}</button>}
        >
          {showTable ? (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-500"><th className="py-1">Mês</th><th>Faturado</th><th>Recebido</th><th>Novas igrejas</th></tr></thead>
              <tbody className="tabular-nums">
                {serie.map((s) => <tr key={s.mes} className="border-t border-slate-100"><td className="py-1">{s.label}</td><td>{brl(s.faturado)}</td><td>{brl(s.recebido)}</td><td>{s.novasIgrejas}</td></tr>)}
              </tbody>
            </table>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke={INK.grid} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} width={64} tickFormatter={compactBrl} />
                <Tooltip content={<ChartTooltip money />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: INK.secondary }}>{v}</span>} />
                <Bar dataKey="faturado" name="Faturado" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="recebido" name="Recebido" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="MRR por plano">
          <ul className="space-y-3">
            {m.porPlano.map((p) => {
              const max = Math.max(...m.porPlano.map((x) => x.mrr), 1);
              return (
                <li key={p.id}>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700">{p.plano} <span className="text-slate-400">· {p.n} igreja(s)</span></span>
                    <span className="tabular-nums text-slate-800">{brl(p.mrr)}</span>
                  </div>
                  <div className="h-2 mt-1 rounded bg-slate-100 overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${(p.mrr / max) * 100}%`, background: SERIES[0] }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <h4 className="text-sm font-semibold text-slate-700 mt-6 mb-2">Igrejas por status</h4>
          <div className="flex flex-wrap gap-2">
            {m.porStatus.map((s) => (
              <Link key={s.status} to={`/platform/igrejas?status=${s.status}`} className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200">
                {s.status}: <strong className="tabular-nums">{s.n}</strong>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card title="Novas igrejas" subtitle="Por mês de cadastro">
          <SimpleBars data={serie} dataKey="novasIgrejas" name="Novas igrejas" />
        </Card>
        <Card title="Mensagens WhatsApp" subtitle={`${m.consumoMes.whatsapp.toLocaleString('pt-BR')} enviadas neste mês`}>
          <SimpleBars data={serie} dataKey="whatsapp" name="Enviadas" />
        </Card>
        <Card title="Interações de IA" subtitle={`${m.consumoMes.ia.toLocaleString('pt-BR')} neste mês · ${(m.consumoMes.tokensIn / 1e6).toFixed(2)}M tokens de entrada`}>
          <SimpleBars data={serie} dataKey="ia" name="Interações" />
        </Card>
        <Card title="Custo de IA" subtitle={`${(m.consumoMes.iaCustoBrl || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} neste mês (US$ ${m.consumoMes.iaCustoUsd || 0}) · MRR após IA: ${(m.consumoMes.margemBrl || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}>
          <SimpleBars data={serie} dataKey="iaCustoBrl" name="Custo IA (R$)" />
        </Card>
      </div>
    </div>
  );
}
