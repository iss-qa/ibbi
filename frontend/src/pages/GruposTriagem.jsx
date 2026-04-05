import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import CustomSelect from '../components/CustomSelect';
import useAuth from '../hooks/useAuth';
import api from '../services/api';

const TIPO_BADGE = {
  novos_decididos: 'bg-amber-50 text-amber-700 border-amber-200',
  visitantes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  personalizado: 'bg-blue-50 text-blue-700 border-blue-200',
};

const TIPO_LABEL = {
  novos_decididos: 'Novos Decididos',
  visitantes: 'Visitantes',
  personalizado: 'Personalizado',
};

const CONGREGACOES = [
  'Sede', 'São Cristóvão', 'Vida Nova', 'PQ São Paulo 1', 'PQ São Paulo 2',
  'Capelão', 'Bairro da Paz', 'Dona Lindu', 'Portão',
  'Olindina-BA', 'Crisópolis-BA', 'São Felipe-BA', 'São Sebastião do Passé - BA',
];

const inputClass =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-lg sm:text-base text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition placeholder:text-slate-400 min-h-[44px]';

const textareaClass =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition placeholder:text-slate-400 resize-none min-h-[44px]';

const normalizeTipo = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const matchesGroupFilters = (person, grupo) => {
  if (!grupo) return true;

  const sameCongregacao = !grupo.congregacao || person.congregacao === grupo.congregacao;
  if (!sameCongregacao) return false;

  const personTipo = normalizeTipo(person.tipo);

  if (grupo.tipo === 'visitantes') return personTipo === 'visitante';
  if (grupo.tipo === 'novos_decididos') return personTipo === 'novo decidido';

  return true;
};

const buildGrupoPayload = (form) => ({
  nome: String(form.nome || '').trim(),
  tipo: form.tipo,
  descricao: String(form.descricao || '').trim(),
  congregacao: String(form.congregacao || '').trim(),
  ativo: form.ativo !== false,
});

function SectionCard({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-100 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export default function GruposTriagem() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState(null);
  const [form, setForm] = useState({ nome: '', tipo: 'novos_decididos', descricao: '', congregacao: '', ativo: true });
  const [saving, setSaving] = useState(false);
  const [managingGrupo, setManagingGrupo] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [allMembers, setAllMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const comboRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadGrupos = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/grupos');
      setGrupos(Array.isArray(data) ? data : data.items || []);
    } catch {
      setGrupos([]);
    }
    setLoading(false);
  };

  useEffect(() => { loadGrupos(); }, []);

  const openCreate = () => {
    setEditingGrupo(null);
    setForm({ nome: '', tipo: 'novos_decididos', descricao: '', congregacao: user?.congregacao || '', ativo: true });
    setShowForm(true);
  };

  const openEdit = (grupo) => {
    setEditingGrupo(grupo);
    setForm({ nome: grupo.nome, tipo: grupo.tipo, descricao: grupo.descricao || '', congregacao: grupo.congregacao || '', ativo: grupo.ativo !== false });
    setShowForm(true);
  };

  const handleSave = async () => {
    const payload = buildGrupoPayload(form);

    if (!payload.nome) {
      showToast('Informe o nome do grupo.');
      return;
    }

    if (!payload.tipo) {
      showToast('Selecione o tipo do grupo.');
      return;
    }

    if (!payload.congregacao) {
      showToast('Selecione a congregação do grupo.');
      return;
    }

    setSaving(true);
    try {
      if (editingGrupo) {
        await api.put(`/grupos/${editingGrupo._id}`, payload);
        showToast('Grupo atualizado com sucesso!');
      } else {
        await api.post('/grupos', payload);
        showToast('Grupo criado com sucesso!');
      }
      setShowForm(false);
      setEditingGrupo(null);
      await loadGrupos();
    } catch (err) {
      console.error('[TRIAGEM SAVE ERROR]', err?.response?.data || err);
      showToast(err?.response?.data?.message || 'Erro ao salvar grupo');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await api.delete(`/grupos/${pendingDelete._id}`);
      showToast('Grupo excluido com sucesso!');
      setPendingDelete(null);
      await loadGrupos();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Erro ao excluir grupo');
    }
  };

  const openManage = async (grupo) => {
    setManagingGrupo(grupo);
    setSearchTerm('');
    setComboOpen(false);
    if (allMembers.length === 0) {
      setLoadingMembers(true);
      try {
        const { data } = await api.get('/persons', { params: { limit: 9999, status: 'ativo' } });
        setAllMembers(data.items || []);
      } catch {
        setAllMembers([]);
      }
      setLoadingMembers(false);
    }
  };

  // Click outside to close combobox
  useEffect(() => {
    const handler = (e) => {
      if (comboRef.current && !comboRef.current.contains(e.target)) setComboOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const membrosDoGrupo = managingGrupo?.membros || [];
  const membrosIds = new Set(membrosDoGrupo.map((m) => m._id || m.membroId || m));

  // Filter members for combobox: exclude already added, filter by search term
  const filteredMembers = allMembers
    .filter((p) => !membrosIds.has(p._id))
    .filter((p) => matchesGroupFilters(p, managingGrupo))
    .filter((p) => !searchTerm || p.nome.toLowerCase().includes(searchTerm.toLowerCase()));

  // Group by congregacao for master, flat list for admin
  const isMaster = user?.role === 'master';
  const groupedMembers = isMaster
    ? filteredMembers.reduce((acc, p) => {
        const cong = p.congregacao || 'Não atribuído';
        if (!acc[cong]) acc[cong] = [];
        acc[cong].push(p);
        return acc;
      }, {})
    : null;

  const addMembro = async (person) => {
    if (!managingGrupo) return;
    try {
      await api.post(`/grupos/${managingGrupo._id}/membros`, { membro_id: person._id });
      showToast(`${person.nome} adicionado ao grupo!`);
      const { data } = await api.get('/grupos');
      const all = Array.isArray(data) ? data : data.items || [];
      const updated = all.find((g) => g._id === managingGrupo._id);
      if (updated) setManagingGrupo(updated);
      setGrupos(all);
      setSearchTerm('');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Erro ao adicionar membro');
    }
  };

  const removeMembro = async (membroId) => {
    if (!managingGrupo) return;
    try {
      await api.delete(`/grupos/${managingGrupo._id}/membros/${membroId}`);
      showToast('Membro removido do grupo!');
      const { data } = await api.get('/grupos');
      const all = Array.isArray(data) ? data : data.items || [];
      const updated = all.find((g) => g._id === managingGrupo._id);
      if (updated) setManagingGrupo(updated);
      setGrupos(all);
    } catch (err) {
      showToast(err?.response?.data?.message || 'Erro ao remover membro');
    }
  };

  const getInitials = (nome) => {
    if (!nome) return '?';
    return nome.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  };

  const avatarColors = [
    'bg-blue-100 text-blue-700',
    'bg-violet-100 text-violet-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-pink-100 text-pink-700',
    'bg-slate-200 text-slate-600',
  ];

  const getAvatarColor = (nome) => avatarColors[(nome?.charCodeAt(0) || 0) % avatarColors.length];

  return (
    <div className="min-h-screen">
      <Header
        title="Projeto Amigo — Grupos"
        subtitle="Gerenciamento dos grupos de acolhimento"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/projeto-amigo')}
              className="flex items-center gap-1.5 border border-slate-200 text-slate-600 text-sm font-medium px-4 h-[40px] rounded-lg hover:bg-slate-50 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Dashboard
            </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 h-[40px] rounded-lg transition shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Novo Grupo
          </button>
          </div>
        }
      />

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {toast}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <svg className="w-6 h-6 animate-spin text-slate-300 mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
            Carregando grupos...
          </div>
        ) : grupos.length === 0 ? (
          <SectionCard className="flex flex-col items-center justify-center py-16">
            <svg className="w-12 h-12 text-slate-200 mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm text-slate-400 mb-4">Nenhum grupo de triagem criado</p>
            <button
              onClick={openCreate}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition"
            >
              Criar primeiro grupo
            </button>
          </SectionCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {grupos.map((grupo) => (
              <SectionCard key={grupo._id} className="flex flex-col cursor-pointer hover:shadow-md transition">
                <div className="p-4 sm:p-5 flex-1" onClick={() => navigate(`/grupos/${grupo._id}`)}>
                  <div className="mb-3">
                    <h3 className="text-base font-semibold text-slate-800 truncate">{grupo.nome}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {grupo.congregacao && (
                        <p className="text-[10px] text-blue-600 font-medium">{grupo.congregacao}</p>
                      )}
                      <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${TIPO_BADGE[grupo.tipo] || TIPO_BADGE.personalizado}`}>
                        {TIPO_LABEL[grupo.tipo] || grupo.tipo}
                      </span>
                    </div>
                    {grupo.descricao && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{grupo.descricao}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {(grupo.membros || []).length} membro{(grupo.membros || []).length !== 1 ? 's' : ''}
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      grupo.ativo !== false
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-stone-100 text-slate-500 border border-stone-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${grupo.ativo !== false ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                      {grupo.ativo !== false ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  {(grupo.acompanhados || []).length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        grupo.tipo === 'visitantes'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {grupo.tipo === 'visitantes' ? '🌟' : '🕊️'}
                        {' '}{(grupo.acompanhados || []).length} {grupo.tipo === 'visitantes' ? 'visitante' : 'novo decidido'}{(grupo.acompanhados || []).length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 px-4 py-3 flex items-center gap-2">
                  <button
                    onClick={() => openManage(grupo)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 py-2 rounded-lg transition min-h-[36px]"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Membros
                  </button>
                  <button
                    onClick={() => openEdit(grupo)}
                    className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 px-3 py-2 rounded-lg transition min-h-[36px]"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Editar
                  </button>
                  <button
                    onClick={() => setPendingDelete(grupo)}
                    className="flex items-center justify-center text-xs font-medium text-rose-500 hover:bg-rose-50 px-2 py-2 rounded-lg transition min-h-[36px]"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </SectionCard>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Group Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowForm(false)}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  {editingGrupo ? 'Editar Grupo' : 'Novo Grupo'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingGrupo ? 'Atualize as informações do grupo' : 'Preencha os dados do novo grupo'}
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
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                <input
                  className={inputClass}
                  placeholder="Nome do grupo"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                <CustomSelect
                  value={form.tipo}
                  onChange={(value) => setForm((f) => ({ ...f, tipo: value }))}
                  options={[
                    { value: 'novos_decididos', label: 'Novos Decididos' },
                    { value: 'visitantes', label: 'Visitantes' },
                    { value: 'personalizado', label: 'Personalizado' },
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Congregação *</label>
                {isMaster ? (
                  <CustomSelect
                    value={form.congregacao}
                    onChange={(value) => setForm((f) => ({ ...f, congregacao: value }))}
                    placeholder="Selecione..."
                    options={CONGREGACOES.map((c) => ({ value: c, label: c }))}
                  />
                ) : (
                  <input
                    className={`${inputClass} bg-slate-50`}
                    value={form.congregacao || user?.congregacao || ''}
                    readOnly
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
                <textarea
                  className={textareaClass}
                  rows={3}
                  placeholder="Descricao do grupo (opcional)"
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                />
              </div>
              {editingGrupo && (
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Status</label>
                    <p className="text-xs text-slate-400 mt-0.5">Grupos inativos não recebem notificações</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, ativo: !f.ativo }))}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${form.ativo ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${form.ativo ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              )}
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
                disabled={saving || !form.nome.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-base sm:text-sm font-medium px-5 py-3 sm:py-2.5 rounded-lg transition flex items-center justify-center gap-2 min-h-[44px]"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Members Modal */}
      {managingGrupo && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center sm:p-4 z-50" onClick={() => setManagingGrupo(null)}>
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-lg h-[85dvh] sm:h-auto sm:max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-800">{managingGrupo.nome}</h2>
                <p className="text-xs text-slate-400 mt-0.5">Gerenciar membros do grupo</p>
              </div>
              <button
                onClick={() => setManagingGrupo(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-slate-400 hover:text-slate-600 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Alert banner */}
            <div className="mx-4 mt-4 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-lg flex items-center gap-2 shrink-0">
              <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-amber-700">Esses membros receberao notificacoes por WhatsApp</p>
            </div>

            {/* Combobox to add members */}
            <div className="px-4 pt-4 shrink-0" ref={comboRef}>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  className={`${inputClass} pl-10 pr-8`}
                  placeholder="Buscar membro para adicionar..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setComboOpen(true); }}
                  onFocus={() => setComboOpen(true)}
                />
                {searchTerm && (
                  <button
                    onClick={() => { setSearchTerm(''); setComboOpen(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {comboOpen && (
                <div className="mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {loadingMembers ? (
                    <p className="text-xs text-slate-400 text-center py-3">Carregando membros...</p>
                  ) : filteredMembers.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-3">Nenhum membro encontrado</p>
                  ) : isMaster ? (
                    Object.entries(groupedMembers).sort(([a], [b]) => a.localeCompare(b)).map(([cong, members]) => (
                      <div key={cong}>
                        <div className="sticky top-0 bg-slate-50 px-3 py-1.5 border-b border-slate-100">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{cong}</p>
                        </div>
                        {members.map((person) => (
                          <button
                            key={person._id}
                            onClick={() => { addMembro(person); setComboOpen(false); setSearchTerm(''); }}
                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center gap-2.5 transition border-b border-slate-50 last:border-0 min-h-[44px]"
                          >
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold ${getAvatarColor(person.nome)}`}>
                              {getInitials(person.nome)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-slate-700 font-medium truncate">{person.nome}</p>
                              <p className="text-[10px] text-slate-400">{person.celular || person.cargo || ''}</p>
                            </div>
                            <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        ))}
                      </div>
                    ))
                  ) : (
                    filteredMembers.map((person) => (
                      <button
                        key={person._id}
                        onClick={() => { addMembro(person); setComboOpen(false); setSearchTerm(''); }}
                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center gap-2.5 transition border-b border-slate-50 last:border-0 min-h-[44px]"
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold ${getAvatarColor(person.nome)}`}>
                          {getInitials(person.nome)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-700 font-medium truncate">{person.nome}</p>
                          <p className="text-[10px] text-slate-400">{person.celular || person.cargo || ''}</p>
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

            {/* Current members list */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {membrosDoGrupo.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <svg className="w-10 h-10 mb-2 text-slate-200" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-sm">Nenhum membro no grupo</p>
                  <p className="text-xs mt-1">Use a busca acima para adicionar</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    {membrosDoGrupo.length} membro{membrosDoGrupo.length !== 1 ? 's' : ''}
                  </p>
                  {membrosDoGrupo.map((membro) => {
                    const id = membro._id || membro.membroId || membro;
                    const nome = membro.nome || 'Membro';
                    const cargo = membro.cargo || '';
                    const celular = membro.celular || '';
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition group"
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${getAvatarColor(nome)}`}>
                          {getInitials(nome)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-700 truncate">{nome}</p>
                          <div className="flex items-center gap-2">
                            {cargo && <span className="text-[10px] text-slate-400">{cargo}</span>}
                            {celular && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                {celular}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => removeMembro(id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition opacity-0 group-hover:opacity-100"
                          title="Remover do grupo"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 px-6 py-3 shrink-0">
              <button
                onClick={() => setManagingGrupo(null)}
                className="w-full px-4 py-3 sm:py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition min-h-[44px]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {pendingDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]" onClick={() => setPendingDelete(null)}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col items-center text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Excluir grupo</h3>
            <p className="text-sm text-slate-500 mb-6">
              Tem certeza que deseja excluir <span className="font-semibold text-slate-700">{pendingDelete.nome}</span>?
            </p>
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
