import { useEffect, useState } from 'react';
import api from '../services/api';

const TIPO_ACAO_OPTIONS = [
  { value: 'ligacao', label: 'Ligacao' },
  { value: 'visita', label: 'Visita' },
  { value: 'culto_agendado', label: 'Culto Agendado' },
  { value: 'acompanhamento', label: 'Acompanhamento' },
  { value: 'outros', label: 'Outros' },
];

const TIPO_ACAO_ICON = {
  ligacao: '\u{1F4DE}',
  visita: '\u{1F3E0}',
  culto_agendado: '\u26EA',
  acompanhamento: '\u{1F91D}',
  outros: '\u{1F4CB}',
};

const TIPO_ACAO_LABEL = {
  ligacao: 'Ligacao',
  visita: 'Visita',
  culto_agendado: 'Culto Agendado',
  acompanhamento: 'Acompanhamento',
  outros: 'Outros',
};

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'realizado', label: 'Realizado' },
  { value: 'cancelado', label: 'Cancelado' },
];

const STATUS_STYLE = {
  pendente: 'bg-amber-50 text-amber-700 border-amber-200',
  realizado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelado: 'bg-red-50 text-red-600 border-red-200',
};

const STATUS_DOT = {
  pendente: 'bg-amber-400',
  realizado: 'bg-emerald-500',
  cancelado: 'bg-red-500',
};

const inputClass =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-lg sm:text-base text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition placeholder:text-slate-400 min-h-[44px]';

const textareaClass =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition placeholder:text-slate-400 resize-none min-h-[44px]';

function normalizeReferenciaTipo(personTipo) {
  if (!personTipo) return '';
  const t = personTipo.toLowerCase().trim();
  if (t === 'novo decidido' || t === 'novo_decidido') return 'novo_decidido';
  if (t === 'visitante') return 'visitante';
  return t.replace(/\s+/g, '_');
}

export default function ProjetoAmigoTab({ personId, personTipo }) {
  const [acoes, setAcoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAcao, setEditingAcao] = useState(null);
  const [form, setForm] = useState({
    tipo_acao: 'ligacao',
    descricao: '',
    data_agendada: '',
    status: 'pendente',
    observacoes: '',
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  const referenciaTipo = normalizeReferenciaTipo(personTipo);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadAcoes = async () => {
    if (!personId || !referenciaTipo) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/projeto-amigo/${referenciaTipo}/${personId}`);
      setAcoes(Array.isArray(data) ? data : data.items || []);
    } catch {
      setAcoes([]);
    }
    setLoading(false);
  };

  useEffect(() => { loadAcoes(); }, [personId, referenciaTipo]);

  const openCreate = () => {
    setEditingAcao(null);
    setForm({
      tipo_acao: 'ligacao',
      descricao: '',
      data_agendada: '',
      status: 'pendente',
      observacoes: '',
    });
    setShowForm(true);
  };

  const openEdit = (acao) => {
    setEditingAcao(acao);
    setForm({
      tipo_acao: acao.tipo_acao || 'ligacao',
      descricao: acao.descricao || '',
      data_agendada: acao.data_agendada ? acao.data_agendada.slice(0, 10) : '',
      status: acao.status || 'pendente',
      observacoes: acao.observacoes || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingAcao) {
        await api.put(`/projeto-amigo/${editingAcao._id}`, form);
        showToast('Acao atualizada!');
      } else {
        await api.post('/projeto-amigo', {
          referencia_id: personId,
          referencia_tipo: referenciaTipo,
          ...form,
        });
        showToast('Acao registrada!');
      }
      setShowForm(false);
      setEditingAcao(null);
      await loadAcoes();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Erro ao salvar acao');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await api.delete(`/projeto-amigo/${pendingDelete._id}`);
      showToast('Acao removida!');
      setPendingDelete(null);
      await loadAcoes();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Erro ao excluir');
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('pt-BR');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[80] bg-emerald-600 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          Projeto Amigo {'\u{1F91D}'}
        </h3>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition min-h-[36px]"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Registrar Acao
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <svg className="w-5 h-5 animate-spin text-slate-300 mb-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
          Carregando...
        </div>
      ) : acoes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <svg className="w-10 h-10 mb-2 text-slate-200" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">Nenhuma acao registrada</p>
          <p className="text-xs mt-1">Clique em "Registrar Acao" para comecar</p>
        </div>
      ) : (
        /* Timeline */
        <div className="flex-1 overflow-y-auto">
          <div className="relative pl-6">
            {/* Vertical line */}
            <div className="absolute left-2.5 top-2 bottom-2 w-px bg-slate-200" />

            <div className="flex flex-col gap-3">
              {acoes.map((acao, idx) => (
                <div key={acao._id || idx} className="relative group">
                  {/* Dot */}
                  <div className={`absolute -left-[14px] top-3 w-3 h-3 rounded-full border-2 border-white shadow-sm ${STATUS_DOT[acao.status] || 'bg-slate-400'}`} />

                  {/* Card */}
                  <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 sm:p-4 hover:shadow-md transition">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{TIPO_ACAO_ICON[acao.tipo_acao] || '\u{1F4CB}'}</span>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">
                            {TIPO_ACAO_LABEL[acao.tipo_acao] || acao.tipo_acao}
                          </p>
                          {acao.data_agendada && (
                            <p className="text-[10px] text-slate-400">
                              Agendado: {formatDate(acao.data_agendada)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[acao.status] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[acao.status] || 'bg-slate-400'}`} />
                          {acao.status}
                        </span>
                      </div>
                    </div>

                    {acao.descricao && (
                      <p className="text-xs text-slate-600 mb-1">{acao.descricao}</p>
                    )}
                    {acao.observacoes && (
                      <p className="text-[10px] text-slate-400 italic">{acao.observacoes}</p>
                    )}

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                      <span className="text-[10px] text-slate-400">
                        {acao.criadoEm ? formatDate(acao.criadoEm) : acao.createdAt ? formatDate(acao.createdAt) : ''}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => openEdit(acao)}
                          className="text-[10px] text-blue-600 font-medium px-2 py-1 rounded hover:bg-blue-50 transition"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setPendingDelete(acao)}
                          className="text-[10px] text-rose-500 font-medium px-2 py-1 rounded hover:bg-rose-50 transition"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Action Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[70]" onClick={() => setShowForm(false)}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  {editingAcao ? 'Editar Acao' : 'Nova Acao'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingAcao ? 'Atualize os dados da acao' : 'Registre uma nova acao do Projeto Amigo'}
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-slate-400 hover:text-slate-600 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de acao *</label>
                <select
                  className={inputClass}
                  value={form.tipo_acao}
                  onChange={(e) => setForm((f) => ({ ...f, tipo_acao: e.target.value }))}
                >
                  {TIPO_ACAO_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
                <textarea
                  className={textareaClass}
                  rows={3}
                  placeholder="Descreva a acao..."
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data agendada</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.data_agendada}
                  onChange={(e) => setForm((f) => ({ ...f, data_agendada: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  className={inputClass}
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observacoes</label>
                <textarea
                  className={textareaClass}
                  rows={2}
                  placeholder="Observacoes adicionais..."
                  value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-3 sm:py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition min-h-[44px]"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-base sm:text-sm font-medium px-5 py-3 sm:py-2.5 rounded-lg transition flex items-center justify-center gap-2 min-h-[44px]"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {pendingDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[80]" onClick={() => setPendingDelete(null)}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col items-center text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Excluir acao</h3>
            <p className="text-sm text-slate-500 mb-6">Tem certeza que deseja excluir esta acao?</p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setPendingDelete(null)}
                className="flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium py-2.5 rounded-xl transition text-sm"
              >
                Nao
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-medium py-2.5 rounded-xl transition text-sm"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
