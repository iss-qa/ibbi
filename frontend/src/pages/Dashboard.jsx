import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const Skeleton = () => <div className="h-56 w-full animate-pulse bg-stone-100 rounded-xl" />;

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const lockedCongregacao = user?.role === 'admin' ? user?.congregacao : '';
  const [congregacao, setCongregacao] = useState('Todos');
  const [stats, setStats] = useState({ total: 0, ativos: 0, inativos: 0, aniversariantes: [], novosCadastros: 0 });

  const [growth, setGrowth] = useState([]);
  const [byCongregation, setByCongregation] = useState([]);
  const [byGroup, setByGroup] = useState([]);
  const [retention, setRetention] = useState([]);

  const [loading, setLoading] = useState({ growth: true, congregation: true, group: true, retention: true });
  
  const [selectedBirthdayPerson, setSelectedBirthdayPerson] = useState(null);

  const load = async () => {
    const params = congregacao === 'Todos' ? {} : { congregacao };
    const { data } = await api.get('/dashboard', { params });
    setStats(data);
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
    { label: 'Membros ativos', value: stats.ativos },
    { label: 'Membros inativos', value: stats.inativos },
    { label: 'Total de membros', value: stats.total },
    { label: 'Aniversariantes (7 dias)', value: stats.aniversariantes.length },
  ];

  return (
    <div className="animate-fade-in pb-10">
      <Header
        title={
          <div className="flex items-center gap-3">
            <span>Dashboard</span>
            {stats.novosCadastros > 0 && (
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

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((item) => (
          <div key={item.label} className="bg-white rounded-xl border border-stone-100 p-4">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="text-2xl font-semibold text-ibbiNavy mt-2">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-stone-100 p-6">
          <h3 className="font-display text-xl text-ibbiNavy mb-4">Aniversariantes da semana</h3>
          <div className="space-y-3">
            {stats.aniversariantes.map((person) => (
              <div key={person._id} className="flex justify-between items-center text-sm py-1 border-b border-slate-50 last:border-0 hover:bg-slate-50 px-2 rounded -mx-2 transition cursor-pointer" onClick={() => setSelectedBirthdayPerson(person)}>
                <span className="text-ibbiBlue hover:underline underline-offset-2 font-medium">{person.nome}</span>
                <span className="text-ibbiGold font-semibold">
                  {new Date(person.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </span>
              </div>
            ))}
            {stats.aniversariantes.length === 0 && (
              <p className="text-sm text-slate-500">Sem aniversariantes nos próximos 7 dias.</p>
            )}
          </div>
        </div>
        <div className="bg-gradient-to-br from-ibbiBlue via-ibbiNavy to-ibbiNavy text-white rounded-xl p-6">
          <h3 className="font-display text-xl mb-3">Comunicação rápida</h3>
          <p className="text-sm text-white/80 mb-6">
            Envie avisos para grupos ou congregações diretamente do painel.
          </p>
          <button 
            className="bg-ibbiGold hover:bg-yellow-400 transition text-ibbiNavy px-4 py-3 sm:py-2 min-h-[44px] rounded-lg font-semibold w-full sm:w-auto mt-2"
            onClick={() => navigate('/communication')}
          >
            Ir para comunicação
          </button>
        </div>
      </section>

      <section className="mt-8 grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-stone-100 p-6">
          <h3 className="font-display text-lg text-ibbiNavy">Crescimento de membros</h3>
          <p className="text-xs text-slate-400 mb-4">Novos cadastros nos últimos 6 meses</p>
          {loading.growth ? (
            <Skeleton />
          ) : (
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
          {loading.congregation ? (
            <div className="h-[350px] w-full animate-pulse bg-stone-100 rounded-xl" />
          ) : (
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
          {loading.group ? (
            <div className="h-[350px] w-full animate-pulse bg-stone-100 rounded-xl" />
          ) : (
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
          {loading.retention ? (
            <Skeleton />
          ) : (
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
