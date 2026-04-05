import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import api from '../services/api';

const CATEGORIA_BADGE = {
  contato_inicial: { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Contato Inicial' },
  visitacao: { bg: 'bg-violet-50 text-violet-700 border-violet-200', label: 'Visitação' },
  mensagem: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Mensagem' },
  integracao: { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Integração' },
  acolhimento: { bg: 'bg-pink-50 text-pink-700 border-pink-200', label: 'Acolhimento' },
  acompanhamento: { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'Acompanhamento' },
  outro: { bg: 'bg-slate-50 text-slate-600 border-slate-200', label: 'Outro' },
};

export default function GrupoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [grupo, setGrupo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAtividade, setNewAtividade] = useState({ titulo: '', descricao: '', categoria: 'outro' });
  const [sendingWpp, setSendingWpp] = useState(null); // membro_id sending
  const obsTimeout = useRef({});

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadGrupo = async () => {
    try {
      const { data } = await api.get(`/grupos/${id}`);
      setGrupo(data);
    } catch {
      showToast('Erro ao carregar grupo');
    }
    setLoading(false);
  };

  useEffect(() => { loadGrupo(); }, [id]);

  const initAtividades = async () => {
    try {
      const { data } = await api.post(`/grupos/${id}/atividades/init`);
      setGrupo(data);
      showToast('Atividades criadas com sucesso!');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Erro ao criar atividades');
    }
  };

  const toggleConcluida = async (atividade) => {
    setSaving(atividade._id);
    try {
      const { data } = await api.put(`/grupos/${id}/atividades/${atividade._id}`, {
        concluida: !atividade.concluida,
      });
      setGrupo(data);
    } catch {
      showToast('Erro ao atualizar atividade');
    }
    setSaving(null);
  };

  const assignResponsavel = async (atividade, membro) => {
    setSaving(atividade._id);
    try {
      const { data } = await api.put(`/grupos/${id}/atividades/${atividade._id}`, {
        responsavel_id: membro ? membro.membro_id : null,
        responsavel_nome: membro ? membro.nome : null,
      });
      setGrupo(data);
      showToast(membro ? `${membro.nome} designado(a)` : 'Responsável removido');
    } catch {
      showToast('Erro ao designar responsável');
    }
    setSaving(null);
  };

  const saveObservacao = (atividade, value) => {
    // Update local state immediately
    setGrupo((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        atividades: prev.atividades.map((a) =>
          a._id === atividade._id ? { ...a, observacao: value } : a
        ),
      };
    });
    // Debounce API call
    if (obsTimeout.current[atividade._id]) clearTimeout(obsTimeout.current[atividade._id]);
    obsTimeout.current[atividade._id] = setTimeout(async () => {
      try {
        await api.put(`/grupos/${id}/atividades/${atividade._id}`, { observacao: value });
      } catch {
        showToast('Erro ao salvar observação');
      }
    }, 800);
  };

  const handleAddAtividade = async () => {
    if (!newAtividade.titulo.trim()) return;
    try {
      const { data } = await api.post(`/grupos/${id}/atividades`, newAtividade);
      setGrupo(data);
      setNewAtividade({ titulo: '', descricao: '', categoria: 'outro' });
      setShowAddForm(false);
      showToast('Atividade adicionada!');
    } catch {
      showToast('Erro ao adicionar atividade');
    }
  };

  const removeAtividade = async (atividadeId) => {
    try {
      const { data } = await api.delete(`/grupos/${id}/atividades/${atividadeId}`);
      setGrupo(data);
      showToast('Atividade removida');
    } catch {
      showToast('Erro ao remover atividade');
    }
  };

  const sendWhatsApp = async (membro) => {
    setSendingWpp(membro.membro_id);
    try {
      const { data } = await api.post(`/grupos/${id}/atividades/send-whatsapp`, {
        membro_id: membro.membro_id,
      });
      showToast(data.message || 'Atividades enviadas!');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Erro ao enviar');
    }
    setSendingWpp(null);
  };

  const membros = grupo?.membros || [];
  const acompanhados = grupo?.acompanhados || [];
  const atividades = grupo?.atividades || [];
  const totalAtividades = atividades.length;
  const concluidas = atividades.filter((a) => a.concluida).length;
  const progresso = totalAtividades > 0 ? Math.round((concluidas / totalAtividades) * 100) : 0;

  // Count atividades per member
  const countByMembro = {};
  const pendingByMembro = {};
  atividades.forEach((a) => {
    if (a.responsavel_id) {
      const rid = String(a.responsavel_id);
      countByMembro[rid] = (countByMembro[rid] || 0) + 1;
      if (!a.concluida) pendingByMembro[rid] = (pendingByMembro[rid] || 0) + 1;
    }
  });

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

  if (!grupo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Grupo não encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        title={grupo.nome}
        subtitle={grupo.congregacao ? `${grupo.congregacao} — Acompanhamento de atividades` : 'Acompanhamento de atividades'}
        action={
          <button
            onClick={() => navigate('/grupos')}
            className="flex items-center gap-1.5 border border-slate-200 text-slate-600 text-sm font-medium px-4 h-[40px] rounded-lg hover:bg-slate-50 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Voltar
          </button>
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

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Progress + Members Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Progress Card */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Progresso</h3>
            <div className="flex items-end gap-3 mb-3">
              <span className="text-3xl font-bold text-slate-800">{progresso}%</span>
              <span className="text-sm text-slate-400 mb-1">{concluidas}/{totalAtividades} atividades</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div
                className="h-2.5 rounded-full transition-all duration-500"
                style={{
                  width: `${progresso}%`,
                  background: progresso === 100 ? '#10b981' : progresso > 50 ? '#3b82f6' : '#f59e0b',
                }}
              />
            </div>
          </div>

          {/* Members Card */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Equipe ({membros.length})
            </h3>
            {membros.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum membro na equipe</p>
            ) : (
              <div className="flex flex-col gap-2">
                {membros.map((m) => {
                  const mid = String(m.membro_id);
                  const total = countByMembro[mid] || 0;
                  const pending = pendingByMembro[mid] || 0;
                  const initials = m.nome?.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
                  const colors = ['bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-pink-100 text-pink-700'];
                  const color = colors[(m.nome?.charCodeAt(0) || 0) % colors.length];
                  const isSendingThis = sendingWpp === m.membro_id;
                  return (
                    <div key={m._id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${color}`}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{m.nome}</p>
                        <div className="flex items-center gap-2">
                          {m.celular && <span className="text-[10px] text-slate-400">{m.celular}</span>}
                        </div>
                      </div>
                      {total > 0 && (
                        <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full shrink-0">
                          {total} ativ.{pending > 0 ? ` (${pending} pend.)` : ''}
                        </span>
                      )}
                      {pending > 0 && m.celular && (
                        <button
                          onClick={() => sendWhatsApp(m)}
                          disabled={isSendingThis}
                          title={`Enviar ${pending} atividades pendentes via WhatsApp`}
                          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition disabled:opacity-50"
                        >
                          {isSendingThis ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.557 4.116 1.532 5.845L.057 23.571l5.882-1.541A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.66-.502-5.196-1.38l-.374-.22-3.89 1.02 1.04-3.796-.242-.39A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Acompanhados Card */}
        <AcompanhadosCard grupo={grupo} acompanhados={acompanhados} grupoId={id} setGrupo={setGrupo} showToast={showToast} />

        {/* Activities Section */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Atividades de Acompanhamento</h3>
            <div className="flex gap-2">
              {atividades.length > 0 && (
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Nova Atividade
                </button>
              )}
            </div>
          </div>

          {atividades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <svg className="w-12 h-12 text-slate-200 mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <p className="text-sm text-slate-500 mb-1">Nenhuma atividade cadastrada</p>
              <p className="text-xs text-slate-400 mb-4 max-w-xs">
                Crie as atividades sugeridas para acompanhamento de novos decididos ou adicione suas próprias atividades.
              </p>
              <button
                onClick={initAtividades}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition shadow-sm"
              >
                Criar atividades sugeridas
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {showAddForm && (
                <div className="px-5 py-4 bg-blue-50/50 border-b border-blue-100">
                  <div className="flex flex-col gap-3">
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                      placeholder="Título da atividade"
                      value={newAtividade.titulo}
                      onChange={(e) => setNewAtividade((f) => ({ ...f, titulo: e.target.value }))}
                    />
                    <textarea
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
                      rows={2}
                      placeholder="Descrição detalhada..."
                      value={newAtividade.descricao}
                      onChange={(e) => setNewAtividade((f) => ({ ...f, descricao: e.target.value }))}
                    />
                    <div className="flex items-center gap-2">
                      <select
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                        value={newAtividade.categoria}
                        onChange={(e) => setNewAtividade((f) => ({ ...f, categoria: e.target.value }))}
                      >
                        {Object.entries(CATEGORIA_BADGE).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                      <div className="flex-1" />
                      <button
                        onClick={() => setShowAddForm(false)}
                        className="text-sm text-slate-500 px-3 py-2 rounded-lg hover:bg-slate-100 transition"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleAddAtividade}
                        disabled={!newAtividade.titulo.trim()}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {atividades.map((atividade) => {
                const cat = CATEGORIA_BADGE[atividade.categoria] || CATEGORIA_BADGE.outro;
                const isSaving = saving === atividade._id;
                return (
                  <div
                    key={atividade._id}
                    className={`px-5 py-4 transition ${atividade.concluida ? 'bg-emerald-50/30' : 'hover:bg-slate-50/50'}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleConcluida(atividade)}
                        disabled={isSaving}
                        className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition ${
                          atividade.concluida
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-slate-300 hover:border-blue-400'
                        } ${isSaving ? 'opacity-50' : ''}`}
                      >
                        {atividade.concluida && (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className={`text-sm font-semibold ${atividade.concluida ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                            {atividade.titulo}
                          </h4>
                          <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cat.bg}`}>
                            {cat.label}
                          </span>
                        </div>

                        {atividade.descricao && (
                          <p className={`text-xs leading-relaxed mb-2 ${atividade.concluida ? 'text-slate-400' : 'text-slate-500'}`}>
                            {atividade.descricao}
                          </p>
                        )}

                        {/* Responsavel + Actions */}
                        <div className="flex items-center gap-3 flex-wrap mb-2">
                          <div className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <select
                              value={atividade.responsavel_id || ''}
                              onChange={(e) => {
                                const membro = membros.find((m) => String(m.membro_id) === e.target.value);
                                assignResponsavel(atividade, membro || null);
                              }}
                              disabled={isSaving}
                              className={`text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 min-w-[140px] ${
                                isSaving ? 'opacity-50' : ''
                              }`}
                            >
                              <option value="">Sem responsável</option>
                              {membros.map((m) => (
                                <option key={m._id} value={m.membro_id}>{m.nome}</option>
                              ))}
                            </select>
                          </div>

                          {atividade.concluida && atividade.concluida_em && (
                            <span className="text-[10px] text-emerald-600 font-medium">
                              Concluída em {new Date(atividade.concluida_em).toLocaleDateString('pt-BR')}
                            </span>
                          )}

                          <button
                            onClick={() => removeAtividade(atividade._id)}
                            className="ml-auto text-slate-300 hover:text-rose-500 transition p-1 rounded"
                            title="Remover atividade"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>

                        {/* Observação */}
                        <div className="mt-1">
                          <textarea
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none placeholder:text-slate-400 transition"
                            rows={2}
                            placeholder="Observações do responsável... (impressões, anotações, resultado do contato)"
                            value={atividade.observacao || ''}
                            onChange={(e) => saveObservacao(atividade, e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Acompanhados Card with search ───────────────────────────────────────────
function AcompanhadosCard({ grupo, acompanhados, grupoId, setGrupo, showToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchTimeout = useRef(null);

  const tipoLabel = grupo.tipo === 'visitantes' ? 'Visitantes' : 'Novos Decididos';
  const tipoFilter = grupo.tipo === 'visitantes' ? 'visitante' : 'novo decidido';
  const acompIds = new Set(acompanhados.map((a) => String(a.person_id)));

  const handleSearch = (term) => {
    setSearchTerm(term);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!term.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get('/persons', { params: { search: term, tipo: tipoFilter, limit: 10 } });
        setSearchResults((data.items || []).filter((p) => !acompIds.has(String(p._id))));
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 400);
  };

  const addAcompanhado = async (person) => {
    try {
      const { data } = await api.post(`/grupos/${grupoId}/acompanhados`, { person_id: person._id });
      setGrupo(data);
      setSearchTerm('');
      setSearchResults([]);
      showToast(`${person.nome} adicionado ao acompanhamento!`);
    } catch (err) {
      showToast(err?.response?.data?.message || 'Erro ao adicionar');
    }
  };

  const removeAcompanhado = async (acompanhadoId) => {
    try {
      const { data } = await api.delete(`/grupos/${grupoId}/acompanhados/${acompanhadoId}`);
      setGrupo(data);
      showToast('Removido do acompanhamento');
    } catch {
      showToast('Erro ao remover');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          {tipoLabel} em acompanhamento ({acompanhados.length})
        </h3>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Adicionar
        </button>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="mb-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input
              className="w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400"
              placeholder={`Buscar ${tipoFilter} para adicionar...`}
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
          </div>
          {searchTerm && (
            <div className="mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
              {searching ? (
                <p className="text-xs text-slate-400 text-center py-3">Buscando...</p>
              ) : searchResults.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">Nenhum resultado</p>
              ) : (
                searchResults.map((person) => (
                  <button
                    key={person._id}
                    onClick={() => addAcompanhado(person)}
                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center gap-2.5 transition border-b border-slate-50 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700 font-medium truncate">{person.nome}</p>
                      <p className="text-[10px] text-slate-400">{person.celular || ''} {person.congregacao || ''}</p>
                    </div>
                    <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {acompanhados.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">
          Nenhum {tipoFilter} vinculado. Clique em "Adicionar" para buscar.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {acompanhados.map((a) => {
            const initials = a.nome?.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
            const avatarColor = a.tipo === 'visitante'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700';
            return (
              <div key={a._id || a.person_id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 group">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor}`}>
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{a.nome}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${avatarColor}`}>
                      {a.tipo === 'visitante' ? 'Visitante' : 'Novo Decidido'}
                    </span>
                    {a.data && <span className="text-[10px] text-slate-400">{new Date(a.data).toLocaleDateString('pt-BR')}</span>}
                  </div>
                  {a.celular && (
                    <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {a.celular}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeAcompanhado(a._id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition opacity-0 group-hover:opacity-100"
                  title="Remover"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
