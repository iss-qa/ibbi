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

function BirthdayItem({ person, onClick }) {
  const today = isToday(person);
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
      {today && <span className="text-base shrink-0" aria-hidden>🎂</span>}
      <span className="min-w-0 flex-1 truncate">
        <span className="text-ibbiBlue font-medium hover:underline underline-offset-2">{person.nome}</span>
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
          <div className="flex items-baseline justify-between mb-3 sm:mb-4">
            <h3 className="font-display text-lg sm:text-xl text-ibbiNavy">Aniversariantes da semana</h3>
            {stats?.aniversariantes?.length > 0 && (
              <span className="text-xs text-slate-400 tabular-nums">{stats.aniversariantes.length}</span>
            )}
          </div>
          {loadingStats ? <SkeletonList rows={4} /> : (
            <div className="space-y-1">
              {stats?.aniversariantes?.length > 0 ? (
                stats.aniversariantes.map((person) => (
                  <BirthdayItem
                    key={person._id}
                    person={person}
                    onClick={setSelectedBirthdayPerson}
                  />
                ))
              ) : (
                <p className="text-sm text-slate-500 py-4 text-center">
                  Sem aniversariantes esta semana.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-stone-100 p-4 sm:p-6">
          <div className="flex items-baseline justify-between mb-3 sm:mb-4">
            <h3 className="font-display text-lg sm:text-xl text-ibbiNavy">Aniversariantes do mês</h3>
            {stats?.aniversariantesMes?.length > 0 && (
              <span className="text-xs text-slate-400 tabular-nums">{stats.aniversariantesMes.length}</span>
            )}
          </div>
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
