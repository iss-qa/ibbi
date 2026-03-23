import { useEffect, useState } from 'react';
import Header from '../../components/Header';
import api from '../../services/api';
import { onlyDigits } from '../../utils/phoneMask';
import MemberForm from './MemberForm';
import useAuth from '../../hooks/useAuth';

const TIPO_STYLE = {
  membro: 'bg-blue-50 text-blue-700 border-blue-100',
  congregado: 'bg-violet-50 text-violet-700 border-violet-100',
  visitante: 'bg-amber-50 text-amber-700 border-amber-100',
  'novo decidido': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'criança': 'bg-pink-50 text-pink-700 border-pink-100',
};

const inputClass =
  'border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition placeholder:text-slate-400 min-h-[44px]';

function Avatar({ nome, fotoUrl, size = 'md' }) {
  const sz = size === 'lg' ? 'w-11 h-11 text-sm' : 'w-9 h-9 text-xs';
  const initials = nome?.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
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
      {fotoUrl ? (
        <img src={fullFotoUrl} alt={nome} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}

export default function MemberList() {
  const { user } = useAuth();
  const lockedCongregacao = user?.role === 'admin' ? user?.congregacao : '';
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ search: '', tipo: '', grupo: '' });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get('/persons', { params: { ...filters, limit: 100 } });
    setItems(data.items || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters.search, filters.tipo, filters.grupo]);

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
        await api.post('/persons', data);
      }
      setShowForm(false);
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

  const ativos = items.filter((i) => i.status === 'ativo').length;
  const inativos = items.filter((i) => i.status === 'inativo').length;

  return (
    <div className="min-h-screen">
      <Header
        title="Membros"
        subtitle="Gestão completa da membresia"
        action={
          <div className="flex gap-2">
            <button
              onClick={handleInvite}
              className="flex items-center gap-1.5 border border-slate-200 bg-white text-slate-600 text-sm px-3 py-2 rounded-lg hover:bg-stone-50 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101" />
              </svg>
              Link externo
            </button>
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Novo membro
            </button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-5 overflow-x-hidden">

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Total', value: items.length, icon: '👥', bg: 'bg-white', text: 'text-slate-700' },
            { label: 'Ativos', value: ativos, icon: '✅', bg: 'bg-emerald-50', text: 'text-emerald-700' },
            { label: 'Inativos', value: inativos, icon: '⏸️', bg: 'bg-white', text: 'text-slate-500' },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-xl border border-slate-100 px-4 py-3 flex items-center gap-3`}>
              <span className="text-xl">{s.icon}</span>
              <div>
                <p className={`text-2xl font-semibold leading-none ${s.text}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
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
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="relative sm:col-span-2">
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
            <select
              className={`${inputClass} w-full`}
              value={filters.tipo}
              onChange={(e) => setFilters((p) => ({ ...p, tipo: e.target.value }))}
            >
              <option value="">Todos os tipos</option>
              <option value="membro">membro</option>
              <option value="congregado">congregado</option>
              <option value="visitante">visitante</option>
              <option value="novo decidido">novo decidido</option>
              <option value="criança">criança</option>
            </select>
            <select
              className={`${inputClass} w-full`}
              value={filters.grupo}
              onChange={(e) => setFilters((p) => ({ ...p, grupo: e.target.value }))}
            >
              <option value="">Todos os grupos</option>
              <option value="criança">criança</option>
              <option value="adolescente">adolescente</option>
              <option value="jovem">jovem</option>
              <option value="adulto 1">adulto 1</option>
              <option value="adulto 2">adulto 2</option>
              <option value="idoso">idoso</option>
              <option value="ancião">ancião</option>
            </select>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-medium text-slate-700">
              {loading ? 'Carregando...' : `${items.length} membros`}
            </span>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-stone-50 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exportar CSV
            </button>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 text-left">
                <th className="px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Membro</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide hidden md:table-cell">Tipo</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide hidden md:table-cell">Grupo</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wide text-right">Ações</th>
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar nome={row.nome} fotoUrl={row.fotoUrl} />
                        <div>
                          <button className="font-medium text-slate-800 text-sm leading-tight text-left" onClick={() => setViewing(row)}>
                            {row.nome}
                          </button>
                          {row.congregacao && (
                            <p className="text-xs text-slate-400 mt-0.5">{row.congregacao}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${TIPO_STYLE[row.tipo] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {row.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-slate-500 capitalize">{row.grupo || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-3 h-3 rounded-full md:hidden ${row.status === 'ativo' ? 'bg-emerald-500' : 'bg-red-500'}`} title={row.status} />
                      <span className={`hidden md:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${row.status === 'ativo'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-stone-100 text-slate-500 border border-stone-200'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${row.status === 'ativo' ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {/* Mobile Actions Dropdown */}
                      <div className="md:hidden flex justify-end relative group">
                        <button className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-full">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                        </button>
                        <div className="hidden group-hover:flex group-focus-within:flex flex-col gap-1 absolute right-0 top-10 bg-white border border-slate-200 shadow-lg rounded-xl p-2 z-10 w-32">
                          <button
                            onClick={() => {
                              setEditing({
                                ...row,
                                dataNascimento: toDateInput(row.dataNascimento),
                                dataBatismo: toDateInput(row.dataBatismo),
                                dataVisita: toDateInput(row.dataVisita),
                                dataDecisao: toDateInput(row.dataDecisao),
                              });
                              setShowForm(true);
                            }}
                            className="text-left px-3 py-2 text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(row)}
                            className="text-left px-3 py-2 text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-lg"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                      {/* Desktop Actions */}
                      <div className="hidden md:flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditing({
                              ...row,
                              dataNascimento: toDateInput(row.dataNascimento),
                              dataBatismo: toDateInput(row.dataBatismo),
                              dataVisita: toDateInput(row.dataVisita),
                              dataDecisao: toDateInput(row.dataDecisao),
                            });
                            setShowForm(true);
                          }}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(row)}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center sm:p-4 z-50"
          onClick={() => { setShowForm(false); setEditing(null); }}
        >
          <div
            className="bg-white sm:rounded-2xl shadow-xl w-full max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  {editing ? 'Editar membro' : 'Novo membro'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editing ? 'Atualize as informações do membro' : 'Preencha os dados para cadastrar'}
                </p>
              </div>
              <button
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-slate-400 hover:text-slate-600 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {error && (
              <div className="mx-6 mt-4 px-3 py-2.5 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              <MemberForm
                initialData={editing}
                onSubmit={handleSave}
                onCancel={() => { setShowForm(false); setEditing(null); }}
                lockedCongregacao={lockedCongregacao}
              />
            </div>
          </div>
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <Avatar nome={viewing.nome} fotoUrl={viewing.fotoUrl} size="lg" />
                <div>
                  <h2 className="text-base font-semibold text-slate-800">{viewing.nome}</h2>
                  <p className="text-xs text-slate-400">{viewing.congregacao || '-'}</p>
                </div>
              </div>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-slate-400 hover:text-slate-600 transition" onClick={() => setViewing(null)}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 grid md:grid-cols-2 gap-3 text-sm text-slate-600">
              <div><strong>Email:</strong> {viewing.email || '-'}</div>
              <div><strong>Celular:</strong> {viewing.celular || '-'}</div>
              <div><strong>Tipo:</strong> {viewing.tipo || '-'}</div>
              <div><strong>Grupo:</strong> {viewing.grupo || '-'}</div>
              <div><strong>Status:</strong> {viewing.status || '-'}</div>
              <div><strong>Estado civil:</strong> {viewing.estadoCivil || '-'}</div>
              <div><strong>Data da visita:</strong> {viewing.dataVisita ? new Date(viewing.dataVisita).toLocaleDateString('pt-BR') : '-'}</div>
              <div><strong>Data da decisão:</strong> {viewing.dataDecisao ? new Date(viewing.dataDecisao).toLocaleDateString('pt-BR') : '-'}</div>
              <div className="md:col-span-2"><strong>Endereço:</strong> {viewing.endereco || '-'}</div>
              <div className="md:col-span-2"><strong>Ministério:</strong> {viewing.ministerio || '-'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
