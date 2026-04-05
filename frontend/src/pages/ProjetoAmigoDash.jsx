import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import api from '../services/api';

const ETAPAS = [
  { key: 'triagem', label: 'Triagem', desc: 'Cadastro, ficha, contato inicial', bg: 'bg-blue-700', numBg: 'bg-blue-900/30' },
  { key: 'acolhimento', label: 'Acolhimento', desc: 'Amigo, 1a visita/ligação', bg: 'bg-orange-600', numBg: 'bg-orange-900/30' },
  { key: 'integracao', label: 'Integração', desc: 'EBD, culto, grupo de célula', bg: 'bg-emerald-600', numBg: 'bg-emerald-800/30' },
  { key: 'consolidacao', label: 'Consolidação', desc: 'Batismo, carta de transferência', bg: 'bg-violet-600', numBg: 'bg-violet-800/30' },
  { key: 'discipulado', label: 'Discipulado', desc: 'Membro pleno, ministério ativo', bg: 'bg-slate-700', numBg: 'bg-slate-900/30' },
];

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function ProjetoAmigoDash() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const now = new Date();
  const mesLabel = `${MESES[now.getMonth()]} ${now.getFullYear()}`;

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadDashboard = async () => {
    try {
      const { data: d } = await api.get('/projeto-amigo/dashboard');
      setData(d);
    } catch {
      showToast('Erro ao carregar dashboard');
    }
    setLoading(false);
  };

  useEffect(() => { loadDashboard(); }, []);

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
          <div className="flex gap-2">
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
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {toast}
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

        {/* Funil de etapas */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Fluxo de acompanhamento</h3>
          <div className="flex gap-0.5 overflow-x-auto">
            {ETAPAS.map((etapa, i) => (
              <div key={etapa.key} className="flex-1 min-w-[160px] relative">
                <div className={`flex items-center gap-3 px-5 py-4 h-[76px] ${etapa.bg} ${i === 0 ? 'rounded-l-2xl' : ''} ${i === ETAPAS.length - 1 ? 'rounded-r-2xl' : ''}`}>
                  <span className={`w-8 h-8 rounded-full ${etapa.numBg} flex items-center justify-center text-white text-sm font-bold shrink-0`}>{i + 1}</span>
                  <div>
                    <p className="text-base font-bold text-white drop-shadow-sm">{etapa.label}</p>
                    <p className="text-xs text-white/80 leading-snug">{etapa.desc}</p>
                  </div>
                </div>
                {i < ETAPAS.length - 1 && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                    <svg className="w-4 h-4 text-white/60 drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 5l7 7-7 7" />
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

