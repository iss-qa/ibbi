import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import Header from '../components/Header';
import api from '../services/api';
import { CONGREGACOES } from '../constants/congregacoes';
import useAuth from '../hooks/useAuth';
import AniversarianteModal from './AniversarianteModal';

const COLORS = ['#0b4dbf', '#c9a227', '#0a1f44', '#6b21a8', '#0f766e', '#b91c1c', '#6d28d9'];

const SkeletonCard = () => (
  <div className="bg-white rounded-xl border border-stone-100 p-4 animate-pulse">
    <div className="h-3 w-24 bg-stone-200 rounded mb-3" />
    <div className="h-8 w-16 bg-stone-200 rounded" />
  </div>
);

const SkeletonChart = ({ height = 'h-56' }) => (
  <div className={`${height} w-full animate-pulse bg-stone-100 rounded-xl flex items-center justify-center`}>
    <svg className="w-8 h-8 text-stone-200" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
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

export default function Dashboard() {
  const { user } = useAuth();
  const lockedCongregacao = user?.role === 'admin' ? user?.congregacao : '';
  const [congregacao, setCongregacao] = useState('Todos');
  const [stats, setStats] = useState(null);

  const [growth, setGrowth] = useState([]);
  const [byCongregation, setByCongregation] = useState([]);
  const [byGroup, setByGroup] = useState([]);
  const [retention, setRetention] = useState([]);

  const [loadingStats, setLoadingStats] = useState(true);
  const [loading, setLoading] = useState({ growth: true, congregation: true, group: true, retention: true });

  const [selectedBirthdayPerson, setSelectedBirthdayPerson] = useState(null);

  const load = async () => {
    setLoadingStats(true);
    const params = congregacao === 'Todos' ? {} : { congregacao };
    const { data } = await api.get('/dashboard', { params });
    setStats(data);
    setLoadingStats(false);
  };

  const loadCharts = async () => {
    setLoading({ growth: true, congregation: true, group: true, retention: true });
    const params = congregacao === 'Todos' ? {} : { congregacao };
    const [g, c, gr, r] = await Promise.all([
      api.get('/stats/growth', { params }),
      api.get('/stats/by-congregation', { params }),
      api.get('/stats/by-group', { params }),
      api.get('/stats/retention', { params }),
    ]);
    setGrowth(g.data);
    setByCongregation(c.data);
    setByGroup(gr.data);
    setRetention(r.data);
    setLoading({ growth: false, congregation: false, group: false, retention: false });
  };

  useEffect(() => {
    if (user) {
      load();
      loadCharts();
    }
  }, [congregacao, user]);

  useEffect(() => {
    if (user && lockedCongregacao) {
      setCongregacao(lockedCongregacao);
    }
  }, [lockedCongregacao, user]);

  const cards = [
    { label: 'Membros ativos', value: stats?.ativos ?? 0 },
    { label: 'Membros inativos', value: stats?.inativos ?? 0 },
    { label: 'Total de membros', value: stats?.total ?? 0 },
    { label: 'Aniversariantes da semana', value: stats?.aniversariantes?.length ?? 0 },
  ];

  return (
    <div className="animate-fade-in pb-10">
      <Header
        title={
          <div className="flex items-center gap-3">
            <span>Dashboard</span>
            {stats?.novosCadastros > 0 && (
              <span className="bg-red-500 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full animate-bounce shadow-lg">
                {stats.novosCadastros} {stats.novosCadastros === 1 ? 'NOVO CADASTRO' : 'NOVOS CADASTROS'}
              </span>
            )}
          </div>
        }
        subtitle="Visão geral da igreja"
        action={
          <select className="border rounded-lg px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500" value={congregacao} onChange={(e) => setCongregacao(e.target.value)} disabled={Boolean(lockedCongregacao)}>
            {!lockedCongregacao && <option value="Todos">Todos</option>}
            {CONGREGACOES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        }
      />

      {/* Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loadingStats ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          cards.map((item) => (
            <div key={item.label} className="bg-white rounded-xl border border-stone-100 p-4 transition-all duration-300">
              <p className="text-sm text-slate-500">{item.label}</p>
              <p className="text-2xl font-semibold text-ibbiNavy mt-2">{item.value}</p>
            </div>
          ))
        )}
      </section>

      {/* Aniversariantes */}
      <section className="mt-8 grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-stone-100 p-6">
          <h3 className="font-display text-xl text-ibbiNavy mb-4">Aniversariantes da semana</h3>
          {loadingStats ? <SkeletonList rows={4} /> : (
            <div className="space-y-3">
              {stats?.aniversariantes?.map((person) => (
                <div
                  key={person._id}
                  className="flex items-center gap-3 text-sm py-1 border-b border-slate-50 last:border-0 hover:bg-slate-50 px-2 rounded -mx-2 transition cursor-pointer"
                  onClick={() => setSelectedBirthdayPerson(person)}
                >
                  <span className="min-w-0 flex-1 truncate text-ibbiBlue hover:underline underline-offset-2 font-medium">
                    {person.nome}
                  </span>
                  <span className="text-ibbiGold font-semibold">
                    {person.diaMes}/{new Date(person.data).toLocaleDateString('pt-BR', { month: '2-digit', timeZone: 'UTC' })}
                  </span>
                </div>
              ))}
              {stats?.aniversariantes?.length === 0 && (
                <p className="text-sm text-slate-500">Sem aniversariantes entre domingo e sábado desta semana.</p>
              )}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-stone-100 p-6">
          <h3 className="font-display text-xl text-ibbiNavy mb-4">Aniversariantes do mês</h3>
          {loadingStats ? <SkeletonList rows={6} /> : (
            <div className="space-y-3 max-h-[280px] overflow-y-auto overflow-x-hidden pr-2">
              {stats?.aniversariantesMes?.map((person) => (
                <div
                  key={person._id}
                  className="flex items-center gap-3 text-sm py-1 border-b border-slate-50 last:border-0 hover:bg-slate-50 px-2 rounded -mx-2 transition cursor-pointer"
                  onClick={() => setSelectedBirthdayPerson(person)}
                >
                  <span className="min-w-0 flex-1 truncate text-ibbiBlue hover:underline underline-offset-2 font-medium">
                    {person.nome}
                  </span>
                  <span className="text-ibbiGold font-semibold">
                    {person.diaMes}/{new Date(person.data).toLocaleDateString('pt-BR', { month: '2-digit', timeZone: 'UTC' })}
                  </span>
                </div>
              ))}
              {stats?.aniversariantesMes?.length === 0 && (
                <p className="text-sm text-slate-500">Sem aniversariantes neste mês.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Charts */}
      <section className="mt-8 grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-stone-100 p-6">
          <h3 className="font-display text-lg text-ibbiNavy">Crescimento de membros</h3>
          <p className="text-xs text-slate-400 mb-4">Novos cadastros nos últimos 6 meses</p>
          {loading.growth ? <SkeletonChart /> : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growth}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#0b4dbf" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-stone-100 p-6">
          <h3 className="font-display text-lg text-ibbiNavy">Membros por congregação</h3>
          <p className="text-xs text-slate-400 mb-4">Total por congregação</p>
          {loading.congregation ? <SkeletonChart height="h-[350px]" /> : (
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCongregation} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                  <XAxis type="number" />
                  <YAxis dataKey="congregacao" type="category" width={110} interval={0} tick={{ fontSize: 12, fill: '#475569' }} />
                  <Tooltip />
                  <Bar
                    dataKey="total"
                    fill="#c9a227"
                    radius={[0, 6, 6, 0]}
                    label={{ position: 'right', fill: '#0a1f44', fontSize: 13, fontWeight: 'bold' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-stone-100 p-6">
          <h3 className="font-display text-lg text-ibbiNavy">Distribuição por grupo</h3>
          <p className="text-xs text-slate-400 mb-4">Proporção por grupo</p>
          {loading.group ? <SkeletonChart height="h-[350px]" /> : (
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <Pie
                    data={byGroup}
                    dataKey="total"
                    nameKey="grupo"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    labelLine={true}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {byGroup.map((entry, index) => (
                      <Cell key={`cell-${entry.grupo}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-stone-100 p-6">
          <h3 className="font-display text-lg text-ibbiNavy">Taxa de retenção</h3>
          <p className="text-xs text-slate-400 mb-4">Entradas vs saídas por mês</p>
          {loading.retention ? <SkeletonChart /> : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={retention}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="entradas" stackId="1" stroke="#0b4dbf" fill="#0b4dbf" fillOpacity={0.2} />
                  <Area type="monotone" dataKey="saidas" stackId="1" stroke="#c2410c" fill="#c2410c" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
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
