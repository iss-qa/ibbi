import { useEffect, useState } from 'react';
import Header from '../../components/Header';
import CarteirinhaModal from '../../components/CarteirinhaModal';
import api from '../../services/api';
import { onlyDigits } from '../../utils/phoneMask';
import MemberForm from './MemberForm';
import useAuth from '../../hooks/useAuth';
import doveDefault from '../../assets/dove_ia.png';
import { CONGREGACOES } from '../../constants/congregacoes';
import CustomSelect from '../../components/CustomSelect';

const TIPO_STYLE = {
  membro: 'bg-blue-50 text-blue-700 border-blue-100',
  congregado: 'bg-violet-50 text-violet-700 border-violet-100',
  visitante: 'bg-amber-50 text-amber-700 border-amber-100',
  'novo decidido': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'criança': 'bg-pink-50 text-pink-700 border-pink-100',
};

const inputClass =
  'border border-slate-200 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-[13px] sm:text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition placeholder:text-slate-400 min-h-[38px] sm:min-h-[44px]';

function Avatar({ nome, fotoUrl, size = 'md' }) {
  const sz = size === 'lg' ? 'w-11 h-11 text-sm' : 'w-9 h-9 text-xs';
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-violet-100 text-violet-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-pink-100 text-pink-700',
    'bg-slate-200 text-slate-600',
  ];
  const color = colors[(nome?.charCodeAt(0) || 0) % colors.length];

  // Trata fotoUrl se for relativa
  let fullFotoUrl = fotoUrl;
  if (fotoUrl && fotoUrl.startsWith('/uploads')) {
    const baseUrl = api.defaults.baseURL.replace('/api', '');
    fullFotoUrl = `${baseUrl}${fotoUrl}`;
  }

  return (
    <div className={`${sz} rounded-full overflow-hidden flex items-center justify-center font-semibold shrink-0 ${color}`}>
      <img src={fullFotoUrl || doveDefault} alt={nome} className="w-full h-full object-cover" />
    </div>
  );
}

export default function MemberList() {
  const { user } = useAuth();
  const lockedCongregacao = user?.role === 'admin' ? user?.congregacao : '';
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ search: '', tipo: '', grupo: '', congregacao: '' });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [viewingForm, setViewingForm] = useState(false);
  const [newCredentials, setNewCredentials] = useState(null);
  const [carteirinhaPerson, setCarteirinhaPerson] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [ativos, setAtivos] = useState(0);
  const [inativos, setInativos] = useState(0);
  const totalPages = Math.ceil(total / limit);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get('/persons', { params: { ...filters, page, limit } });
    setItems(data.items || []);
    setTotal(data.total || 0);
    setAtivos(data.ativos || 0);
    setInativos(data.inativos || 0);
    setLoading(false);
  };

  useEffect(() => { setPage(1); }, [filters.search, filters.tipo, filters.grupo, filters.congregacao]);
  useEffect(() => { load(); }, [filters.search, filters.tipo, filters.grupo, filters.congregacao, page, limit]);

  const handleSave = async (payload) => {
    const normalizeDate = (value) => {
      if (!value) return '';
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
        const [d, m, y] = value.split('/');
        return `${y}-${m}-${d}`;
      }
      return value;
    };
    const data = {
      ...payload,
      congregacao: lockedCongregacao || payload.congregacao,
      celular: onlyDigits(payload.celular),
      dataNascimento: normalizeDate(payload.dataNascimento),
      dataBatismo: normalizeDate(payload.dataBatismo),
      dataVisita: normalizeDate(payload.dataVisita),
      dataDecisao: normalizeDate(payload.dataDecisao),
    };
    if (data.status !== 'inativo') delete data.motivoInativacao;
    if (data.tipo === 'visitante' || data.tipo === 'novo decidido') {
      delete data.email;
      delete data.grupo;
      delete data.estadoCivil;
      delete data.endereco;
      delete data.ministerio;
      delete data.batizado;
      delete data.dataBatismo;
      delete data.status;
      delete data.motivoInativacao;
    }
    if (data.tipo === 'visitante') {
      delete data.dataDecisao;
    }
    if (data.tipo === 'novo decidido') {
      delete data.dataVisita;
    }
    if (data.tipo === 'membro' || data.tipo === 'congregado' || data.tipo === 'criança') {
      delete data.dataVisita;
      delete data.dataDecisao;
    }
    try {
      if (editing) {
        await api.put(`/persons/${editing._id}`, data);
      } else {
        const response = await api.post('/persons', data);
        if (response.data?.generatedUser) {
          setNewCredentials(response.data.generatedUser);
        }
      }
      setShowForm(false);
      setViewingForm(false);
      setEditing(null);
      setError('');
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Erro ao salvar');
    }
  };

  const handleDelete = async (person) => {
    if (!confirm(`Excluir ${person.nome}?`)) return;
    await api.delete(`/persons/${person._id}`);
    await load();
  };

  const handleOpenForm = async (row, isReadOnly = false) => {
    try {
      const { data } = await api.get(`/persons/${row._id}`);
      setEditing({
        ...data,
        dataNascimento: toDateInput(data.dataNascimento),
        dataBatismo: toDateInput(data.dataBatismo),
        dataVisita: toDateInput(data.dataVisita),
        dataDecisao: toDateInput(data.dataDecisao),
      });
      setViewingForm(isReadOnly);
      setShowForm(true);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar os detalhes do membro.');
    }
  };

  const toDateInput = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };

  const handleInvite = async () => {
    const { data } = await api.post('/invitations');
    setInviteLink(data.link);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async () => {
    const response = await api.get('/export/persons', { params: filters, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'membros.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Membros"
        subtitle="Gestão completa da membresia"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditing(null); setViewingForm(false); setShowForm(true); }}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 h-[40px] rounded-lg transition shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Novo membro
            </button>
            <button
              onClick={handleInvite}
              className="group relative flex items-center justify-center border border-emerald-200 bg-emerald-50 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 h-[40px] w-[40px] rounded-lg transition shrink-0 shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101" />
              </svg>
              {/* Tooltip */}
              <div className="absolute top-full right-0 mt-2 whitespace-nowrap bg-stone-800 text-white text-xs font-semibold px-2.5 py-1.5 rounded flex items-center gap-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-lg">
                <span className="relative z-10">Link externo</span>
                <div className="absolute -top-1 right-3.5 w-2 h-2 bg-stone-800 transform rotate-45 rounded-sm"></div>
              </div>
            </button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-0 sm:px-4 py-2 sm:py-6 flex flex-col gap-3 sm:gap-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mx-4 sm:mx-0">
          {[
            { label: 'Total', value: total, icon: '👥', bg: 'bg-white', text: 'text-slate-700' },
            { label: 'Ativos', value: ativos, icon: '✅', bg: 'bg-emerald-50', text: 'text-emerald-700' },
            { label: 'Inativos', value: inativos, icon: '⏸️', bg: 'bg-white', text: 'text-slate-500' },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-xl border border-slate-100 p-2 sm:px-4 sm:py-3 flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-3 text-center sm:text-left`}>
              <span className="text-[1.1rem] sm:text-xl">{s.icon}</span>
              <div>
                <p className={`text-base sm:text-2xl font-semibold leading-none ${s.text}`}>{s.value}</p>
                <p className="text-[10px] sm:text-xs text-slate-400 sm:mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Link de convite */}
        {inviteLink && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3">
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
            </svg>
            <input
              className="flex-1 text-sm text-slate-600 bg-transparent border-none outline-none truncate"
              value={inviteLink}
              readOnly
            />
            <button
              onClick={handleCopy}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${copied
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
            >
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-2 sm:px-4 sm:py-3 mx-4 sm:mx-0">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
            <div className="relative col-span-2">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
              </svg>
              <input
                className={`${inputClass} pl-9 w-full`}
                placeholder="Buscar por nome..."
                value={filters.search}
                onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
              />
            </div>
            <div className="col-span-1 border border-slate-200 rounded-lg">
              <CustomSelect
                value={filters.tipo}
                onChange={(val) => setFilters((p) => ({ ...p, tipo: val }))}
                options={[
                  { value: '', label: 'Tipos' },
                  { value: 'membro', label: 'membro' },
                  { value: 'congregado', label: 'congregado' },
                  { value: 'visitante', label: 'visitante' },
                  { value: 'novo decidido', label: 'novo decidido' },
                  { value: 'criança', label: 'criança' },
                ]}
              />
            </div>
            <div className="col-span-1 border border-slate-200 rounded-lg">
              <CustomSelect
                value={filters.grupo}
                onChange={(val) => setFilters((p) => ({ ...p, grupo: val }))}
                options={[
                  { value: '', label: 'Grupos' },
                  { value: 'criança', label: 'criança' },
                  { value: 'adolescente', label: 'adolescente' },
                  { value: 'jovem', label: 'jovem' },
                  { value: 'adulto 1', label: 'adulto 1' },
                  { value: 'adulto 2', label: 'adulto 2' },
                  { value: 'idoso', label: 'idoso' },
                  { value: 'ancião', label: 'ancião' },
                ]}
              />
            </div>
            <div className="col-span-2 lg:col-span-1 border border-slate-200 rounded-lg">
              <CustomSelect
                value={lockedCongregacao || filters.congregacao}
                onChange={(val) => setFilters((p) => ({ ...p, congregacao: val }))}
                disabled={Boolean(lockedCongregacao)}
                options={[
                  ...(!lockedCongregacao ? [{ value: '', label: 'Todas as congregações' }] : []),
                  ...CONGREGACOES.map((c) => ({ value: c, label: c }))
                ]}
              />
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
                {loading ? 'Carregando...' : <><span className="font-bold">{total}</span><span className="hidden sm:inline"> membros</span></>}
              </span>
              <select
                className="border border-slate-200 rounded-lg px-1 sm:px-2 py-1 text-xs text-slate-600 bg-white focus:outline-none"
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              >
                <option value={10}>10 / pág</option>
                <option value={15}>15 / pág</option>
                <option value={20}>20 / pág</option>
                <option value={50}>50 / pág</option>
              </select>
            </div>
            <button
              onClick={handleExport}
              title="Exportar base CSV"
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-2 py-1.5 sm:px-3 sm:py-1.5 rounded-lg hover:bg-stone-50 transition"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 text-left">
                <th className="px-3 py-2.5 sm:px-4 sm:py-2.5 text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wide max-w-0 sm:max-w-none">Membro</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-2.5 text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Tipo</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-2.5 text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Grupo</th>
                <th className="px-3 py-2.5 sm:px-4 sm:py-2.5 text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Status</th>
                <th className="px-2 py-2.5 sm:px-4 sm:py-2.5 text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wide text-right whitespace-nowrap w-[52px] sm:w-auto">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-5 h-5 animate-spin text-slate-300" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                      </svg>
                      Carregando...
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                    <svg className="w-10 h-10 mx-auto mb-2 text-slate-200" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Nenhum membro encontrado
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row._id} className="hover:bg-stone-50/60 transition group">
                    <td className="px-3 py-2 sm:px-4 sm:py-3">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="relative shrink-0">
                          <Avatar nome={row.nome} fotoUrl={row.fotoUrl} />
                          <span className={`md:hidden absolute -bottom-0.5 -right-0.5 border-2 border-white w-3 h-3 rounded-full ${row.status === 'ativo' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        </div>
                        <div className="min-w-0 flex-1" style={{ maxWidth: '200px' }}>
                          <button
                            className="font-medium text-slate-800 text-sm leading-tight text-left truncate w-full"
                            onClick={() => handleOpenForm(row, true)}
                            title={row.nome}
                          >
                            {row.nome}
                          </button>
                          {row.congregacao && (
                            <p className="text-[10px] sm:text-xs text-slate-400 mt-[1px] truncate w-full">{row.congregacao}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 sm:px-4 sm:py-3 hidden md:table-cell">
                      <span className={`inline-block text-[11px] sm:text-xs font-medium px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border capitalize ${TIPO_STYLE[row.tipo] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {row.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-2 sm:px-4 sm:py-3 hidden md:table-cell">
                      <span className="text-xs sm:text-sm text-slate-500 capitalize">{row.grupo || '—'}</span>
                    </td>
                    <td className="px-3 py-2 sm:px-4 sm:py-3 hidden md:table-cell">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${row.status === 'ativo'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-stone-100 text-slate-500 border border-stone-200'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${row.status === 'ativo' ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                        {row.status}
                      </span>
                    </td>
                    <td className="px-1 py-2 sm:px-4 sm:py-3 w-[52px] sm:w-auto">
                      {/* Mobile Actions Dropdown */}
                      <div className="md:hidden flex justify-end relative group">
                        <button className="w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-full">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                        </button>
                        <div className="hidden group-hover:flex group-focus-within:flex flex-col gap-1 absolute right-0 top-10 bg-white border border-slate-200 shadow-lg rounded-xl p-2 z-10 w-36">
                          <button
                            onClick={() => handleOpenForm(row, false)}
                            className="text-left px-3 py-2 text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            Editar
                          </button>
                          <button
                            onClick={() => setCarteirinhaPerson(row)}
                            className="text-left px-3 py-2 text-sm text-slate-600 hover:bg-amber-50 hover:text-amber-700 rounded-lg flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path strokeLinecap="round" d="M3 10h18" /><circle cx="8" cy="14.5" r="1.5" /></svg>
                            Carteirinha
                          </button>
                          <button
                            onClick={() => handleDelete(row)}
                            className="text-left px-3 py-2 text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-lg flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Excluir
                          </button>
                        </div>
                      </div>
                      {/* Desktop Actions — Icon only with tooltips */}
                      <div className="hidden md:flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => handleOpenForm(row, false)}
                          title="Editar"
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setCarteirinhaPerson(row)}
                          title="Gerar Carteirinha"
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <rect x="3" y="5" width="18" height="14" rx="2" />
                            <path strokeLinecap="round" d="M3 10h18" />
                            <circle cx="8" cy="14.5" r="1.5" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(row)}
                          title="Excluir"
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-stone-50">
              <p className="text-xs text-slate-500">
                Página {page} de {totalPages} &mdash; {total} registro{total !== 1 ? 's' : ''}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition"
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  return start + i;
                }).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition ${
                      p === page
                        ? 'bg-ibbiNavy text-white'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center sm:p-4 z-50"
          onClick={() => { setShowForm(false); setViewingForm(false); setEditing(null); }}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-5xl h-[92dvh] sm:h-auto sm:max-h-[90vh] flex flex-col relative overflow-hidden max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  {editing && viewingForm ? 'Visualizar membro' : editing ? 'Editar membro' : 'Novo membro'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editing && viewingForm ? 'Dados preenchidos do membro' : editing ? 'Atualize as informações do membro' : 'Preencha os dados para cadastrar'}
                </p>
              </div>
              <button
                onClick={() => { setShowForm(false); setViewingForm(false); setEditing(null); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-slate-400 hover:text-slate-600 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {error && (
              <div className="mx-6 mt-4 px-3 py-2.5 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 shrink-0">
                {error}
              </div>
            )}
            <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth w-full p-0">
              <MemberForm
                initialData={editing}
                onSubmit={handleSave}
                onCancel={() => { setShowForm(false); setViewingForm(false); setEditing(null); }}
                lockedCongregacao={lockedCongregacao}
                readOnly={viewingForm}
              />
            </div>
          </div>
        </div>
      )}

      {/* Carteirinha Modal */}
      {carteirinhaPerson && (
        <CarteirinhaModal
          person={carteirinhaPerson}
          onClose={() => setCarteirinhaPerson(null)}
        />
      )}

      {newCredentials && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]" onClick={() => setNewCredentials(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col items-center text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Cadastro realizado!</h3>
            <p className="text-sm text-slate-500 mb-6">O membro foi criado e os acessos gerados (uma mensagem via WhatsApp também foi agendada).</p>
            
            <div className="bg-slate-50 w-full p-4 rounded-xl border border-slate-100 flex flex-col gap-2 mb-6">
               <div className="flex justify-between items-center text-sm">
                 <span className="text-slate-500 font-medium">Usuário:</span>
                 <span className="text-slate-800 font-bold">{newCredentials.login}</span>
               </div>
               <div className="flex justify-between items-center text-sm">
                 <span className="text-slate-500 font-medium">Senha padrão:</span>
                 <span className="text-slate-800 font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200">{newCredentials.senha}</span>
               </div>
            </div>

            <button
               onClick={() => setNewCredentials(null)}
               className="w-full bg-ibbiBlue hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition"
            >
               Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
