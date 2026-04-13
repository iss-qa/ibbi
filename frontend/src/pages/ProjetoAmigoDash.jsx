import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import api from '../services/api';
import useAuth from '../hooks/useAuth';
import { CONGREGACOES } from '../constants/congregacoes';

const ETAPAS_ROW1 = [
  {
    num: 1, key: 'triagem', label: 'Triagem',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    items: ['Cadastro do visitante/decidido', 'Ficha de contato inicial', 'Boas-vindas na igreja', 'Registro no sistema'],
    gradient: 'from-blue-600 to-blue-800',
    iconBg: 'bg-blue-500/30',
    numBg: 'bg-white/20',
    dotColor: 'bg-blue-400',
  },
  {
    num: 2, key: 'acolhimento', label: 'Acolhimento',
    icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    items: ['Amigo designado', '1a visita ou ligação', 'Apresentação na comunidade', 'Convite para culto/evento'],
    gradient: 'from-orange-500 to-orange-700',
    iconBg: 'bg-orange-400/30',
    numBg: 'bg-white/20',
    dotColor: 'bg-orange-400',
  },
  {
    num: 3, key: 'integracao', label: 'Integração',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    items: ['Participação na EBD', 'Frequência nos cultos', 'Grupo de célula/comunhão', 'Envolvimento em ministérios'],
    gradient: 'from-emerald-500 to-emerald-700',
    iconBg: 'bg-emerald-400/30',
    numBg: 'bg-white/20',
    dotColor: 'bg-emerald-400',
  },
];

const ETAPAS_ROW2 = [
  {
    num: 4, key: 'estudo', label: 'Estudo Bíblico',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    items: ['Curso de discipulado', 'Classe de novos decididos', 'Escola Bíblica Dominical', 'Estudos em grupo'],
    gradient: 'from-violet-600 to-violet-800',
    iconBg: 'bg-violet-400/30',
    numBg: 'bg-white/20',
    dotColor: 'bg-violet-400',
  },
  {
    num: 5, key: 'consolidacao', label: 'Consolidação',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    items: ['Acompanhamento de 1 a 2 anos', 'Preparação para batismo', 'Carta de transferência', 'Apoio pastoral contínuo'],
    gradient: 'from-rose-500 to-rose-700',
    iconBg: 'bg-rose-400/30',
    numBg: 'bg-white/20',
    dotColor: 'bg-rose-400',
  },
  {
    num: 6, key: 'membro', label: 'Membro Pleno',
    icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
    items: ['Membro ativo e fiel', 'Líder de grupo ou célula', 'Diácono / obreiro', 'Missionário / professor EBD'],
    gradient: 'from-ibbiNavy to-slate-800',
    iconBg: 'bg-white/15',
    numBg: 'bg-ibbiGold/30',
    dotColor: 'bg-ibbiGold',
  },
];

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const DASHBOARD_PAGE_LIMIT = 9999;

const isWithinMonth = (value, month, year) => {
  if (!value) return false;
  const date = new Date(value);
  return date.getMonth() === month && date.getFullYear() === year;
};

export default function ProjetoAmigoDash() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const lockedCongregacao = user?.role === 'admin' ? user?.congregacao : '';
  const [congregacao, setCongregacao] = useState('Todos');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const now = new Date();
  const mesLabel = `${MESES[now.getMonth()]} ${now.getFullYear()}`;

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const buildDashboardFallback = async () => {
    const params = congregacao === 'Todos' ? {} : { congregacao };
    const [{ data: pessoasData }, { data: gruposData }] = await Promise.all([
      api.get('/persons', { params: { limit: DASHBOARD_PAGE_LIMIT, status: 'ativo', ...params } }),
      api.get('/grupos', { params }),
    ]);

    const pessoas = pessoasData?.items || [];
    const grupos = Array.isArray(gruposData) ? gruposData : gruposData?.items || [];

    const visitantes = pessoas
      .filter((person) => person.tipo === 'visitante')
      .sort((a, b) => new Date(b.dataVisita || 0) - new Date(a.dataVisita || 0));

    const decididos = pessoas
      .filter((person) => person.tipo === 'novo decidido')
      .sort((a, b) => new Date(b.dataDecisao || 0) - new Date(a.dataDecisao || 0));

    const gruposResumo = grupos
      .filter((grupo) => grupo.ativo !== false)
      .map((grupo) => {
        const totalAtividades = grupo.atividades?.length || 0;
        const atividadesConcluidas = grupo.atividades?.filter((atividade) => atividade.concluida).length || 0;

        return {
          _id: grupo._id,
          nome: grupo.nome,
          tipo: grupo.tipo,
          congregacao: grupo.congregacao,
          totalMembros: grupo.membros?.length || 0,
          totalAcompanhados: grupo.acompanhados?.length || 0,
          totalAtividades,
          atividadesConcluidas,
          progresso: totalAtividades > 0 ? Math.round((atividadesConcluidas / totalAtividades) * 100) : 0,
        };
      });

    return {
      visitantesMes: visitantes.filter((person) => isWithinMonth(person.dataVisita, now.getMonth(), now.getFullYear())).length,
      decididosMes: decididos.filter((person) => isWithinMonth(person.dataDecisao, now.getMonth(), now.getFullYear())).length,
      emAcompanhamento: visitantes.length + decididos.length,
      semAmigo: [...visitantes, ...decididos].filter((person) => !person.acompanhadoPersonId).length,
      visitantes: visitantes.slice(0, 10),
      decididos: decididos.slice(0, 10),
      grupos: gruposResumo,
    };
  };

  const loadDashboard = async () => {
    try {
      const params = congregacao === 'Todos' ? {} : { congregacao };
      const { data: d } = await api.get('/projeto-amigo/dashboard', { params });
      setData(d);
    } catch (dashboardErr) {
      try {
        const fallbackData = await buildDashboardFallback();
        setData(fallbackData);
      } catch (fallbackErr) {
        console.error('[PROJETO AMIGO DASH ERROR]', {
          dashboard: dashboardErr?.response?.data || dashboardErr?.message,
          fallback: fallbackErr?.response?.data || fallbackErr?.message,
        });
        showToast('Erro ao carregar dashboard', 'error');
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user && lockedCongregacao) {
      setCongregacao(lockedCongregacao);
    }
  }, [lockedCongregacao, user]);

  useEffect(() => {
    if (user) loadDashboard();
  }, [congregacao, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center text-slate-400">
          <svg className="w-6 h-6 animate-spin mb-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
          Carregando...
        </div>
      </div>
    );
  }

  const { visitantesMes = 0, decididosMes = 0, emAcompanhamento = 0, semAmigo = 0, visitantes = [], decididos = [], grupos = [] } = data || {};

  return (
    <div className="min-h-screen">
      <Header
        title="Projeto Amigo"
        subtitle={`Acompanhamento de Novos Decididos e Visitantes — ${mesLabel}`}
        action={
          <div className="flex gap-2 items-center">
            {user?.role !== 'user' && (
              <select
                className="border rounded-lg px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                value={congregacao}
                onChange={(e) => setCongregacao(e.target.value)}
                disabled={Boolean(lockedCongregacao)}
              >
                {!lockedCongregacao && <option value="Todos">Todos</option>}
                {CONGREGACOES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => navigate('/grupos')}
              className="relative flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 h-[42px] rounded-xl transition shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full" />
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Grupos
            </button>
          </div>
        }
      />

      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in ${
          toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
        }`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            {toast.type === 'error' ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            )}
          </svg>
          {toast.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-3xl font-bold text-slate-800">{decididosMes}</p>
            <p className="text-xs text-slate-400 mt-1">Novos decididos (mês)</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-3xl font-bold text-slate-800">{visitantesMes}</p>
            <p className="text-xs text-slate-400 mt-1">Visitantes (mês)</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-3xl font-bold text-blue-600">{emAcompanhamento}</p>
            <p className="text-xs text-slate-400 mt-1">Em acompanhamento</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className={`text-3xl font-bold ${semAmigo > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{semAmigo}</p>
            <p className="text-xs text-slate-400 mt-1">Sem amigo atribuído</p>
            {semAmigo > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full mt-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Atenção
              </span>
            )}
          </div>
        </div>

        {/* Fluxo de Acompanhamento */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-7 overflow-hidden">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-5 bg-gradient-to-b from-blue-600 to-emerald-500 rounded-full" />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Fluxo de Acompanhamento</h3>
          </div>

          {/* Row 1: Etapas 1, 2, 3 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-0 relative">
            {ETAPAS_ROW1.map((etapa, i) => (
              <div key={etapa.key} className="flex items-center">
                <FluxoCard etapa={etapa} onClick={() => navigate(`/grupos?etapa=${etapa.key}`)} />
                {i < 2 && (
                  <div className={`hidden sm:flex items-center justify-center w-8 shrink-0 fluxo-arrow fluxo-arrow-${i + 1}`}>
                    <svg className="w-7 h-7 text-blue-400 drop-shadow-sm" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Curved Arrow: Etapa 3 → Etapa 4 (ondulada) */}
          <div className="hidden sm:block relative h-16 my-1 mx-4">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 64" fill="none" preserveAspectRatio="xMidYMid meet">
              {/* Descida direita */}
              <path d="M920 4 Q980 4, 980 32 Q980 56, 940 58" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" fill="none" className="fluxo-curve-path" opacity="0.55" />
              {/* Trecho ondulado central */}
              <path d="M940 58 Q880 42, 800 58 Q720 74, 640 50 Q560 26, 480 50 Q400 74, 320 50 Q240 26, 160 50 Q80 74, 60 58" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" fill="none" className="fluxo-curve-path" opacity="0.55" />
              {/* Descida esquerda */}
              <path d="M60 58 Q30 58, 20 42 L20 58" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" fill="none" className="fluxo-curve-path" opacity="0.55" />
              {/* Ponta da seta */}
              <polygon points="12,50 20,64 28,50" fill="#6366f1" opacity="0.55" />
            </svg>
          </div>
          <div className="flex sm:hidden justify-center py-3">
            <svg className="w-7 h-7 text-indigo-400 fluxo-arrow fluxo-arrow-2" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>

          {/* Row 2: Etapas 4, 5, 6 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-0 fluxo-row-2">
            {ETAPAS_ROW2.map((etapa, i) => (
              <div key={etapa.key} className="flex items-center">
                <FluxoCard etapa={etapa} onClick={() => navigate(`/grupos?etapa=${etapa.key}`)} />
                {i < 2 && (
                  <div className={`hidden sm:flex items-center justify-center w-8 shrink-0 fluxo-arrow fluxo-arrow-${i + 4}`}>
                    <svg className="w-7 h-7 text-violet-400 drop-shadow-sm" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Dual Track: Novos Decididos + Visitantes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Novos Decididos */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h3 className="text-sm font-semibold text-slate-800">Novos Decididos</h3>
                <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{decididos.length}</span>
              </div>
            </div>
            <div className="divide-y divide-slate-50">
              {decididos.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">Nenhum novo decidido recente</p>
              ) : (
                decididos.map((p) => (
                  <PersonRow key={p._id} person={p} tipo="novo decidido" dateField="dataDecisao" />
                ))
              )}
            </div>
          </div>

          {/* Visitantes */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-800">Visitantes</h3>
                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">{visitantes.length}</span>
              </div>
            </div>
            <div className="divide-y divide-slate-50">
              {visitantes.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">Nenhum visitante recente</p>
              ) : (
                visitantes.map((p) => (
                  <PersonRow key={p._id} person={p} tipo="visitante" dateField="dataVisita" />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Grupos em andamento */}
        {grupos.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">Grupos em andamento</h3>
              <button
                onClick={() => navigate('/grupos')}
                className="text-xs text-blue-600 font-medium hover:bg-blue-50 px-3 py-1.5 rounded-lg transition"
              >
                Ver todos
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
              {grupos.map((g) => (
                <div
                  key={g._id}
                  onClick={() => navigate(`/grupos/${g._id}`)}
                  className="bg-slate-50 rounded-xl border border-slate-100 p-4 cursor-pointer hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-slate-800 truncate">{g.nome}</h4>
                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{g.progresso}%</span>
                  </div>
                  {g.congregacao && <p className="text-[10px] text-slate-400 mb-2">{g.congregacao}</p>}
                  <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${g.progresso}%`,
                        background: g.progresso === 100 ? '#10b981' : g.progresso > 50 ? '#3b82f6' : '#f59e0b',
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span>{g.totalMembros} membros</span>
                    <span>{g.totalAcompanhados} acompanhados</span>
                    <span>{g.atividadesConcluidas}/{g.totalAtividades} ativ.</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

function FluxoCard({ etapa, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`fluxo-card relative flex-1 rounded-2xl bg-gradient-to-br ${etapa.gradient} p-[1px] overflow-hidden shadow-lg cursor-pointer hover:scale-[1.03] hover:shadow-xl transition-all duration-200`}
    >
      <div className="relative rounded-[15px] bg-gradient-to-br from-white/[0.08] to-transparent p-5 h-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl ${etapa.numBg} flex items-center justify-center shrink-0 backdrop-blur-sm`}>
            <span className="text-white text-lg font-black">{etapa.num}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-bold text-white tracking-tight">{etapa.label}</h4>
          </div>
          <div className={`w-9 h-9 rounded-lg ${etapa.iconBg} flex items-center justify-center shrink-0`}>
            <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={etapa.icon} />
            </svg>
          </div>
        </div>

        {/* Items */}
        <ul className="space-y-2">
          {etapa.items.map((item, j) => (
            <li key={j} className="flex items-start gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${etapa.dotColor} mt-[6px] shrink-0`} />
              <span className="text-xs text-white/85 leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Inline person row component
function PersonRow({ person, tipo, dateField }) {
  const initials = person.nome?.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  const avatarColor = tipo === 'visitante' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
  const dateValue = person[dateField] ? new Date(person[dateField]).toLocaleDateString('pt-BR') : '';

  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor}`}>
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-700 truncate">{person.nome}</p>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          {dateValue && <span>{dateValue}</span>}
          {person.congregacao && <span>{person.congregacao}</span>}
        </div>
      </div>
      {person.acompanhadoNome ? (
        <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
          Amigo: {person.acompanhadoNome.split(' ')[0]}
        </span>
      ) : (
        <span className="text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full shrink-0">
          Sem amigo
        </span>
      )}
    </div>
  );
}
