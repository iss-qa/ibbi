import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import api from '../services/api';
import { CONGREGACOES } from '../constants/congregacoes';
import useAuth from '../hooks/useAuth';
import useStaleQuery from '../hooks/useStaleQuery';
import AniversarianteModal from './AniversarianteModal';

const ChartsSection = lazy(() => import('../components/dashboard/ChartsSection'));

const SkeletonCard = () => (
  <div className="bg-white rounded-xl border border-stone-100 p-4 animate-pulse">
    <div className="h-3 w-24 bg-stone-200 rounded mb-3" />
    <div className="h-8 w-16 bg-stone-200 rounded" />
  </div>
);

const SkeletonList = ({ rows = 3 }) => (
  <div className="space-y-3 animate-pulse">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 py-1">
        <div className="h-3 flex-1 bg-stone-200 rounded" />
        <div className="h-3 w-12 bg-stone-200 rounded" />
      </div>
    ))}
  </div>
);

const SkeletonChartGrid = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="bg-white rounded-xl border border-stone-100 p-4 sm:p-6">
        <div className="h-4 w-40 bg-stone-200 rounded mb-2 animate-pulse" />
        <div className="h-3 w-56 bg-stone-100 rounded mb-4 animate-pulse" />
        <div className="h-56 bg-stone-100 rounded-lg animate-pulse" />
      </div>
    ))}
  </div>
);

const today = () => {
  const d = new Date();
  return { day: d.getDate(), month: d.getMonth() + 1 };
};

const isToday = (person) => {
  const t = today();
  if (typeof person.bDay === 'number' && typeof person.bMonth === 'number') {
    return person.bDay === t.day && person.bMonth === t.month;
  }
  const d = new Date(person.data);
  return d.getUTCDate() === t.day && d.getUTCMonth() + 1 === t.month;
};

const formatBirthdayDate = (person) => {
  const dia = person.diaMes || String(new Date(person.data).getUTCDate()).padStart(2, '0');
  const mes = String(person.bMonth || new Date(person.data).getUTCMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}`;
};

const shortName = (nome) => {
  if (!nome) return '';
  return nome.trim().split(/\s+/).slice(0, 2).join(' ');
};

function SentBadge({ enviadoEm }) {
  const tooltip = enviadoEm
    ? `Mensagem enviada em ${new Date(enviadoEm).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })}`
    : 'Mensagem de aniversário enviada';
  return (
    <span
      className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
      title={tooltip}
      aria-label={tooltip}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    </span>
  );
}

function BirthdayItem({ person, onClick, compact = false }) {
  const today = isToday(person);
  const enviada = Boolean(person.mensagemEnviada);
  const displayName = compact ? shortName(person.nome) : person.nome;
  return (
    <button
      type="button"
      onClick={() => onClick(person)}
      className={`w-full flex items-center gap-2 text-sm py-2 px-2 border-b border-slate-50 last:border-0 rounded-lg transition text-left ${
        today
          ? 'bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-200'
          : 'hover:bg-slate-50'
      }`}
    >
      {enviada ? (
        <SentBadge enviadoEm={person.mensagemEnviadaEm} />
      ) : today ? (
        <span className="text-base shrink-0" aria-hidden>🎂</span>
      ) : (
        <span className="shrink-0 w-5 h-5" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate">
        <span className="text-ibbiBlue font-medium hover:underline underline-offset-2">{displayName}</span>
        {person.congregacao && (
          <span className="text-slate-500 font-normal"> — {person.congregacao}</span>
        )}
      </span>
      <span
        className={`shrink-0 tabular-nums min-w-[3rem] text-right text-xs sm:text-sm font-semibold ${
          today ? 'text-amber-600' : 'text-ibbiGold'
        }`}
      >
        {today ? 'HOJE' : formatBirthdayDate(person)}
      </span>
    </button>
  );
}

function KpiCard({ label, value, accent }) {
  return (
    <div className="bg-white rounded-xl border border-stone-100 p-3 sm:p-4 transition-all duration-300 hover:shadow-sm">
      <p className="text-[11px] sm:text-sm text-slate-500 leading-snug">{label}</p>
      <p className={`text-xl sm:text-2xl font-semibold mt-1 sm:mt-2 ${accent || 'text-ibbiNavy'}`}>
        {value}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const lockedCongregacao = user?.role === 'admin' ? user?.congregacao : '';
  const [congregacao, setCongregacao] = useState(lockedCongregacao || 'Todos');
  const [selectedBirthdayPerson, setSelectedBirthdayPerson] = useState(null);

  const params = congregacao === 'Todos' ? '' : `?congregacao=${encodeURIComponent(congregacao)}`;
  const userKey = user?.id || user?._id || user?.email || 'anon';

  const statsQuery = useStaleQuery(
    user ? `dashboard:${userKey}:${congregacao}` : null,
    () => api.get(`/dashboard${params}`).then((r) => r.data),
    { enabled: Boolean(user) },
  );

  const growthQuery = useStaleQuery(
    user ? `growth:${userKey}:${congregacao}` : null,
    () => api.get(`/stats/growth${params}`).then((r) => r.data),
    { enabled: Boolean(user) },
  );

  const congregationQuery = useStaleQuery(
    user ? `byCongregation:${userKey}:${congregacao}` : null,
    () => api.get(`/stats/by-congregation${params}`).then((r) => r.data),
    { enabled: Boolean(user) },
  );

  const groupQuery = useStaleQuery(
    user ? `byGroup:${userKey}:${congregacao}` : null,
    () => api.get(`/stats/by-group${params}`).then((r) => r.data),
    { enabled: Boolean(user) },
  );

  const retentionQuery = useStaleQuery(
    user ? `retention:${userKey}:${congregacao}` : null,
    () => api.get(`/stats/retention${params}`).then((r) => r.data),
    { enabled: Boolean(user) },
  );

  const stats = statsQuery.data;
  const loadingStats = statsQuery.loading && !stats;

  const printBirthdayList = (titulo, list) => {
    if (!list?.length) return;

    const esc = (s) =>
      String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    const rows = list
      .map(
        (p) => `<tr>
          <td class="nome">${esc(p.nome)}${isToday(p) ? ' <span class="hoje">(hoje)</span>' : ''}</td>
          <td class="cong">${esc(p.congregacao || '—')}</td>
          <td class="data">${esc(formatBirthdayDate(p))}</td>
        </tr>`,
      )
      .join('');

    const filtro = congregacao && congregacao !== 'Todos' ? ` · ${esc(congregacao)}` : '';
    const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long' });
    const geradoEm = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
      <title>${esc(titulo)} — IBBI</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #1f2937; margin: 32px; }
        header { border-bottom: 2px solid #0a1f44; padding-bottom: 12px; margin-bottom: 22px; }
        h1 { margin: 0; font-size: 22px; color: #0a1f44; letter-spacing: -0.01em; }
        .count { font-size: 14px; color: #b8860b; font-weight: 700; margin-left: 8px; }
        .sub { margin: 5px 0 0; font-size: 13px; color: #334155; font-weight: 600; }
        .meta { margin: 2px 0 0; font-size: 12px; color: #64748b; text-transform: capitalize; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; border-bottom: 1.5px solid #cbd5e1; padding: 6px 8px; }
        td { padding: 6px 8px; border-bottom: 1px solid #eef2f7; vertical-align: top; }
        tr { page-break-inside: avoid; }
        td.nome { font-weight: 600; color: #0f172a; }
        td.cong { color: #475569; }
        th.data, td.data { text-align: right; white-space: nowrap; }
        td.data { font-weight: 700; color: #92400e; font-variant-numeric: tabular-nums; }
        .hoje { color: #d97706; font-weight: 700; font-size: 11px; }
        footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: center; }
        @page { margin: 14mm; }
        @media print { body { margin: 0; } }
      </style>
    </head><body>
      <header>
        <h1>${esc(titulo)}<span class="count">${list.length}</span></h1>
        <p class="sub">Igreja Batista Bíblica Israel${filtro}</p>
        <p class="meta">Mês de ${monthName} · Gerado em ${geradoEm}</p>
      </header>
      <table>
        <thead><tr><th>Nome</th><th>Congregação</th><th class="data">Data</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <footer>Sistema IBBI</footer>
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) {
      alert('Permita pop-ups neste site para imprimir a lista de aniversariantes.');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 350);
  };

  const printBtnClass =
    'inline-flex items-center justify-center gap-2 mt-3 w-full px-4 py-2.5 sm:py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-ibbiNavy text-sm font-medium transition shadow-sm min-h-[44px]';
  const PrinterIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V4h12v5M6 18h12v3H6v-3zM6 14h12a2 2 0 002-2v-1a2 2 0 00-2-2H6a2 2 0 00-2 2v1a2 2 0 002 2z" />
    </svg>
  );

  const cards = useMemo(() => ([
    { label: 'Pessoas ativas', value: stats?.ativos ?? 0 },
    { label: 'Pessoas inativas', value: stats?.inativos ?? 0 },
    { label: 'Total de pessoas', value: stats?.total ?? 0 },
    {
      label: stats?.aniversariantesHoje > 0 ? 'Aniversariantes hoje' : 'Aniversariantes da semana',
      value: stats?.aniversariantesHoje > 0
        ? stats.aniversariantesHoje
        : (stats?.aniversariantes?.length ?? 0),
      accent: stats?.aniversariantesHoje > 0 ? 'text-amber-600' : undefined,
    },
  ]), [stats]);

  if (loadingStats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
        <div className="w-10 h-10 border-4 border-ibbiBlue/20 border-t-ibbiBlue rounded-full animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-10">
      <Header
        title={
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span>Dashboard</span>
            {stats?.novosCadastros > 0 && (
              <button
                type="button"
                onClick={() => navigate('/pessoas')}
                className="bg-red-500 hover:bg-red-600 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full animate-bounce shadow-lg transition"
                title="Ver pessoas cadastradas nos últimos 7 dias"
              >
                {stats.novosCadastros} {stats.novosCadastros === 1 ? 'NOVO CADASTRO' : 'NOVOS CADASTROS'}
              </button>
            )}
          </div>
        }
        subtitle="Visão geral da igreja"
        action={
          <select
            className="border rounded-lg px-3 py-2 text-sm w-full sm:w-auto disabled:bg-slate-100 disabled:text-slate-500"
            value={congregacao}
            onChange={(e) => setCongregacao(e.target.value)}
            disabled={Boolean(lockedCongregacao)}
            aria-label="Filtrar por congregação"
            title={lockedCongregacao ? 'Você só visualiza sua congregação' : 'Filtrar por congregação'}
          >
            {!lockedCongregacao && <option value="Todos">Todos</option>}
            {CONGREGACOES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        }
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {loadingStats ? (
          <>
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </>
        ) : (
          cards.map((item) => (
            <KpiCard key={item.label} label={item.label} value={item.value} accent={item.accent} />
          ))
        )}
      </section>

      <section className="mt-6 sm:mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-xl border border-stone-100 p-4 sm:p-6">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="font-display text-lg sm:text-xl text-ibbiNavy">Aniversariantes da semana</h3>
            {stats?.aniversariantes?.length > 0 && (
              <span className="text-xs text-slate-400 tabular-nums">{stats.aniversariantes.length}</span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mb-3 flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-2 h-2">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </span>
            <span>= mensagem já enviada</span>
          </p>
          {loadingStats ? <SkeletonList rows={4} /> : (
            <div className="space-y-1">
              {stats?.aniversariantes?.length > 0 ? (
                stats.aniversariantes.map((person) => (
                  <BirthdayItem
                    key={person._id}
                    person={person}
                    onClick={setSelectedBirthdayPerson}
                    compact
                  />
                ))
              ) : (
                <p className="text-sm text-slate-500 py-4 text-center">
                  Sem aniversariantes esta semana.
                </p>
              )}
            </div>
          )}
          {!loadingStats && (stats?.aniversariantes?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => printBirthdayList('Aniversariantes da semana', stats.aniversariantes)}
              className={printBtnClass}
            >
              <PrinterIcon />
              Imprimir aniversariantes da semana
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-stone-100 p-4 sm:p-6">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="font-display text-lg sm:text-xl text-ibbiNavy">Aniversariantes do mês</h3>
            {stats?.aniversariantesMes?.length > 0 && (
              <span className="text-xs text-slate-400 tabular-nums">
                {stats.aniversariantesMes.filter((p) => p.mensagemEnviada).length}/{stats.aniversariantesMes.length}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mb-3">Total enviadas no mês</p>
          {loadingStats ? <SkeletonList rows={6} /> : (
            <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1 -mr-1">
              {stats?.aniversariantesMes?.length > 0 ? (
                stats.aniversariantesMes.map((person) => (
                  <BirthdayItem
                    key={person._id}
                    person={person}
                    onClick={setSelectedBirthdayPerson}
                  />
                ))
              ) : (
                <p className="text-sm text-slate-500 py-4 text-center">Sem aniversariantes neste mês.</p>
              )}
            </div>
          )}
          {!loadingStats && (stats?.aniversariantesMes?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => printBirthdayList('Aniversariantes do mês', stats.aniversariantesMes)}
              className={printBtnClass}
            >
              <PrinterIcon />
              Imprimir aniversariantes do mês
            </button>
          )}
        </div>
      </section>

      <section className="mt-6 sm:mt-8">
        <Suspense fallback={<SkeletonChartGrid />}>
          <ChartsSection
            growth={growthQuery.data || []}
            byCongregation={congregationQuery.data || []}
            byGroup={groupQuery.data || []}
            retention={retentionQuery.data || []}
            loading={{
              growth: growthQuery.loading && !growthQuery.data,
              congregation: congregationQuery.loading && !congregationQuery.data,
              group: groupQuery.loading && !groupQuery.data,
              retention: retentionQuery.loading && !retentionQuery.data,
            }}
          />
        </Suspense>
      </section>

      {selectedBirthdayPerson && (
        <AniversarianteModal
          person={selectedBirthdayPerson}
          onClose={() => setSelectedBirthdayPerson(null)}
        />
      )}
    </div>
  );
}
