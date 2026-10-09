import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/Header';
import api from '../../services/api';
import { Card, KpiCard } from '../../components/ui';

const SAUDE = { ativa: ['🟢', 'Ativa'], atencao: ['🟡', 'Sem encontro há 2+ semanas'], parada: ['🔴', 'Parada (4+ semanas)'] };

// Painel das células (grupos do tipo "célula" em Encontros): saúde, presença, visitantes e multiplicação.
export default function Celulas() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/celulas/painel').then((r) => setD(r.data)).catch(() => setD({ celulas: [], totais: {} })); }, []);
  if (!d) return <div><Header title="Células" /><p className="text-sm text-slate-500">Carregando…</p></div>;
  const t = d.totais;
  return (
    <div>
      <Header title="Células" subtitle="Saúde dos pequenos grupos nas últimas 8 semanas" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <KpiCard label="Células ativas" value={`${t.ativas || 0}/${t.celulas || 0}`} />
        <KpiCard label="Pessoas em células" value={t.membros || 0} />
        <KpiCard label="Visitantes no mês" value={t.visitantesMes || 0} />
        <KpiCard label="Decisões no mês" value={t.decisoesMes || 0} />
        <KpiCard label="Prontas para multiplicar" value={t.prontasMultiplicar || 0} hint="12+ membros e presença ≥ 70%" />
      </div>
      {!d.celulas.length && (
        <Card><p className="text-sm text-slate-600">Nenhuma célula ainda. Crie em <Link to="/encontros" className="text-ibbiBlue underline">Encontros</Link> com o tipo <strong>Célula</strong>. Depois de cada chamada pelo WhatsApp, o líder informa visitantes e decisões (ex.: "2 1").</p></Card>
      )}
      <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {d.celulas.map((c) => (
          <Link key={c.id} to={`/encontros/grupos/${c.id}`} className="bg-white rounded-2xl border border-stone-100 p-4 hover:shadow-soft transition">
            <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
              <div className="min-w-0">
                <p className="font-display text-lg text-ibbiNavy break-words">{c.nome}</p>
                <p className="text-xs text-slate-500">{c.congregacao}{c.lideres.length ? ` · ${c.lideres.join(', ')}` : ''}</p>
              </div>
              <span className="text-xs whitespace-nowrap">{SAUDE[c.saude][0]} {SAUDE[c.saude][1]}</span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1.5 sm:gap-2 text-center text-[11px] sm:text-xs">
              {[['Membros', c.membros], ['Presença', c.media != null ? `${c.media}%` : '—'], ['Visitantes', c.visitantesMes], ['Decisões', c.decisoesMes]].map(([l, v]) => (
                <div key={l} className="rounded-lg bg-slate-50 py-2"><p className="text-base font-semibold text-ibbiNavy tabular-nums">{v}</p><p className="text-slate-500 truncate px-0.5">{l}</p></div>
              ))}
            </div>
            {c.multiplicar && <p className="mt-3 text-xs font-semibold text-emerald-700">🌱 Pronta para multiplicar: hora de preparar um novo líder!</p>}
            <p className="mt-2 text-xs text-slate-400">{c.ultimo ? `Último encontro: ${new Date(c.ultimo).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}` : 'Sem encontros registrados'}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
