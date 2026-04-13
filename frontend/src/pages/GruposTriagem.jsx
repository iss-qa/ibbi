import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import CustomSelect from '../components/CustomSelect';
import useAuth from '../hooks/useAuth';
import api from '../services/api';
import { CONGREGACOES } from '../constants/congregacoes';

const ETAPA_OPTIONS = [
  { value: 'triagem', label: 'Triagem' },
  { value: 'acolhimento', label: 'Acolhimento' },
  { value: 'integracao', label: 'Integração' },
  { value: 'estudo_biblico', label: 'Estudo Bíblico' },
  { value: 'consolidacao', label: 'Consolidação' },
  { value: 'membro_pleno', label: 'Membro Pleno' },
];

const ETAPA_BADGE = {
  triagem: 'bg-blue-50 text-blue-700 border-blue-200',
  acolhimento: 'bg-orange-50 text-orange-700 border-orange-200',
  integracao: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  estudo_biblico: 'bg-violet-50 text-violet-700 border-violet-200',
  consolidacao: 'bg-rose-50 text-rose-700 border-rose-200',
  membro_pleno: 'bg-slate-100 text-slate-700 border-slate-300',
};

const ETAPA_LABEL = {
  triagem: 'Triagem',
  acolhimento: 'Acolhimento',
  integracao: 'Integração',
  estudo_biblico: 'Estudo Bíblico',
  consolidacao: 'Consolidação',
  membro_pleno: 'Membro Pleno',
};

const CONG_CARD_STYLE = {
  'Sede': 'border-l-4 border-l-emerald-500 bg-emerald-50/30',
  'São Cristóvão': 'border-l-4 border-l-blue-500 bg-blue-50/30',
  'Vida Nova': 'border-l-4 border-l-violet-500 bg-violet-50/30',
  'PQ São Paulo 1': 'border-l-4 border-l-amber-500 bg-amber-50/30',
  'PQ São Paulo 2': 'border-l-4 border-l-orange-500 bg-orange-50/30',
  'Capelão': 'border-l-4 border-l-rose-500 bg-rose-50/30',
  'Bairro da Paz': 'border-l-4 border-l-teal-500 bg-teal-50/30',
  'Dona Lindu': 'border-l-4 border-l-pink-500 bg-pink-50/30',
  'Portão': 'border-l-4 border-l-cyan-500 bg-cyan-50/30',
  'Olindina-BA': 'border-l-4 border-l-indigo-500 bg-indigo-50/30',
  'Crisópolis-BA': 'border-l-4 border-l-lime-600 bg-lime-50/30',
  'São Felipe-BA': 'border-l-4 border-l-yellow-500 bg-yellow-50/30',
  'São Sebastião do Passé - BA': 'border-l-4 border-l-fuchsia-500 bg-fuchsia-50/30',
};

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
  // Membros da equipe: qualquer pessoa da mesma congregação
  if (!grupo.congregacao) return true;
  return person.congregacao === grupo.congregacao;
};

const buildGrupoPayload = (form) => ({
  nome: String(form.nome || '').trim(),
  tipo: form.tipo,
  etapa: form.etapa || 'triagem',
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const lockedCongregacao = user?.role === 'admin' ? user?.congregacao : '';
  const [filterCongregacao, setFilterCongregacao] = useState('Todos');
  const [filterEtapa, setFilterEtapa] = useState(searchParams.get('etapa') || '');
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
      const params = filterCongregacao === 'Todos' ? {} : { congregacao: filterCongregacao };
      if (filterEtapa) params.etapa = filterEtapa;
      const { data } = await api.get('/grupos', { params });
      setGrupos(Array.isArray(data) ? data : data.items || []);
    } catch {
      setGrupos([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user && lockedCongregacao) {
      setFilterCongregacao(lockedCongregacao);
    }
  }, [lockedCongregacao, user]);

  useEffect(() => {
    if (user) loadGrupos();
  }, [filterCongregacao, filterEtapa, user]);

  const openCreate = () => {
    setEditingGrupo(null);
    setForm({ nome: '', tipo: 'novos_decididos', etapa: filterEtapa || 'triagem', descricao: '', congregacao: user?.congregacao || '', ativo: true });
    setShowForm(true);
  };

  const openEdit = (grupo) => {
    setEditingGrupo(grupo);
    setForm({ nome: grupo.nome, tipo: grupo.tipo, etapa: grupo.etapa || 'triagem', descricao: grupo.descricao || '', congregacao: grupo.congregacao || '', ativo: grupo.ativo !== false });
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

  const reloadGruposAndSync = async (grupoId) => {
    const params = filterCongregacao === 'Todos' ? {} : { congregacao: filterCongregacao };
    if (filterEtapa) params.etapa = filterEtapa;
    const { data } = await api.get('/grupos', { params });
    const all = Array.isArray(data) ? data : data.items || [];
    if (grupoId) {
      const updated = all.find((g) => g._id === grupoId);
      if (updated) setManagingGrupo(updated);
    }
    setGrupos(all);
  };

  const addMembro = async (person) => {
    if (!managingGrupo) return;
    try {
      await api.post(`/grupos/${managingGrupo._id}/membros`, { membro_id: person._id });
      showToast(`${person.nome} adicionado ao grupo!`);
      await reloadGruposAndSync(managingGrupo._id);
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
      await reloadGruposAndSync(managingGrupo._id);
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
          <div className="flex gap-2 items-center flex-wrap">
            {user?.role !== 'user' && (
              <select
                className="border rounded-lg px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                value={filterCongregacao}
                onChange={(e) => setFilterCongregacao(e.target.value)}
                disabled={Boolean(lockedCongregacao)}
              >
                {!lockedCongregacao && <option value="Todos">Todos</option>}
                {CONGREGACOES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={filterEtapa}
              onChange={(e) => {
                setFilterEtapa(e.target.value);
                if (e.target.value) { searchParams.set('etapa', e.target.value); } else { searchParams.delete('etapa'); }
                setSearchParams(searchParams);
              }}
            >
              <option value="">Todas etapas</option>
              {ETAPA_OPTIONS.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
            <button
              onClick={() => navigate('/projeto-amigo')}
              className="flex items-center gap-1.5 border border-slate-200 text-slate-600 text-sm font-medium px-4 h-[40px] rounded-lg hover:bg-slate-50 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Dashboard
            </button>
            {user?.role !== 'user' && (
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 h-[40px] rounded-lg transition shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Novo Grupo
              </button>
            )}
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
            {grupos.map((grupo) => {
              const congStyle = CONG_CARD_STYLE[grupo.congregacao] || '';
              const membrosCount = (grupo.membros || []).length;
              const acompCount = (grupo.acompanhados || []).length;
              return (
              <SectionCard key={grupo._id} className={`flex flex-col cursor-pointer hover:shadow-md transition ${congStyle}`}>
                <div className="p-4 sm:p-5 flex-1" onClick={() => navigate(`/grupos/${grupo._id}`)}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-base font-semibold text-slate-800 leading-tight">{grupo.nome}</h3>
                    {grupo.isDefault && (
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wide">Guia</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {grupo.etapa && (
                      <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${ETAPA_BADGE[grupo.etapa] || ETAPA_BADGE.triagem}`}>
                        {ETAPA_LABEL[grupo.etapa] || grupo.etapa}
                      </span>
                    )}
                    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${TIPO_BADGE[grupo.tipo] || TIPO_BADGE.personalizado}`}>
                      {TIPO_LABEL[grupo.tipo] || grupo.tipo}
                    </span>
                    {grupo.congregacao && (
                      <span className="text-[10px] text-slate-500 font-medium">{grupo.congregacao}</span>
                    )}
                  </div>
                  {grupo.descricao && (
                    <p className="text-xs text-slate-400 mb-3 line-clamp-2">{grupo.descricao}</p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    <div className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {membrosCount} membro{membrosCount !== 1 ? 's' : ''}
                    </div>
                    {acompCount > 0 && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        grupo.tipo === 'visitantes' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {acompCount} acompanhado{acompCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      grupo.ativo !== false
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-stone-100 text-slate-500 border border-stone-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${grupo.ativo !== false ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                      {grupo.ativo !== false ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>

                {user?.role !== 'user' && (
                  <div className="border-t border-slate-100/80 px-4 py-2.5 flex items-center gap-1">
                    <button
                      onClick={() => openManage(grupo)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 py-2 rounded-lg transition min-h-[36px]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      Membros
                    </button>
                    <button
                      onClick={() => openEdit(grupo)}
                      className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 px-3 py-2 rounded-lg transition min-h-[36px]"
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
                )}
              </SectionCard>
              );
            })}
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Etapa do Fluxo</label>
                <CustomSelect
                  value={form.etapa}
                  onChange={(value) => setForm((f) => ({ ...f, etapa: value }))}
                  options={ETAPA_OPTIONS}
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
