import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import api from '../../services/api';
import { CONGREGACOES } from '../../constants/congregacoes';

const classes = ['Crianças', 'Adolescentes', 'Jovens', 'Adultos 1', 'Adultos 2', 'Idosos', 'Anciãos'];

export default function EbdList() {
  const [aulas, setAulas] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ data: '', classe: 'Jovens', congregacao: 'Sede', tema: '', descricao: '' });
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', month: '', year: '', congregacao: '' });
  const navigate = useNavigate();

  const load = async () => {
    const params = {};
    if (filters.search) params.search = filters.search;
    if (filters.month && filters.year) {
      params.month = filters.month;
      params.year = filters.year;
    }
    if (filters.congregacao) params.congregacao = filters.congregacao;
    const { data } = await api.get('/ebd', { params });
    setAulas(data);
  };

  useEffect(() => {
    load();
  }, [filters.search, filters.month, filters.year, filters.congregacao]);

  const resetForm = () => {
    setEditing(null);
    setForm({ data: '', classe: 'Jovens', congregacao: 'Sede', tema: '', descricao: '' });
    setError('');
  };

  const saveAula = async () => {
    try {
      if (editing) {
        await api.put(`/ebd/${editing._id}`, form);
      } else {
        await api.post('/ebd', form);
      }
      setShowForm(false);
      resetForm();
      load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Erro ao salvar');
    }
  };

  const removeAula = async (aula) => {
    if (!confirm('Excluir esta aula?')) return;
    await api.delete(`/ebd/${aula._id}`);
    load();
  };

  return (
    <div>
      <Header
        title="EBD"
        subtitle="Lista de domingos e aulas"
        action={
          <button className="bg-ibbiBlue text-white px-4 py-3 sm:py-2 rounded-lg font-medium min-h-[44px]" onClick={() => setShowForm(true)}>
            + Nova Aula
          </button>
        }
      />

      <div className="bg-white rounded-xl shadow-soft p-4 mb-4">
        <div className="grid md:grid-cols-4 gap-3">
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Buscar por tema"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
          <select className="border rounded-lg px-3 py-2" value={filters.month} onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value }))}>
            <option value="">Mês</option>
            {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select className="border rounded-lg px-3 py-2" value={filters.year} onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}>
            <option value="">Ano</option>
            {['2025', '2026', '2027'].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select className="border rounded-lg px-3 py-2" value={filters.congregacao} onChange={(e) => setFilters((f) => ({ ...f, congregacao: e.target.value }))}>
            <option value="">Todas as congregações</option>
            {CONGREGACOES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4">
        {aulas.map((aula) => (
          <div key={aula._id} className="bg-white rounded-xl shadow-soft p-4 flex items-center justify-between">
            <button className="text-left" onClick={() => navigate(`/ebd/${aula._id}`)}>
              <h3 className="font-display text-lg text-ibbiNavy">
                EBD - {aula.classe} - {new Date(aula.data).toLocaleDateString('pt-BR')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Tema: {aula.tema || '-'}</p>
              <p className="text-xs text-slate-400 mt-1">Congregação: {aula.congregacao || '-'}</p>
            </button>
            <div className="flex items-center gap-2">
              <button
                className="text-blue-600 text-sm"
                onClick={() => {
                  setEditing(aula);
                  setForm({
                    data: new Date(aula.data).toISOString().slice(0, 10),
                    classe: aula.classe,
                    congregacao: aula.congregacao || 'Sede',
                    tema: aula.tema || '',
                    descricao: aula.descricao || '',
                  });
                  setShowForm(true);
                }}
              >
                Editar
              </button>
              <button className="text-red-600 text-sm" onClick={() => removeAula(aula)}>
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center sm:p-6 z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-soft w-full max-w-lg h-[90dvh] sm:h-auto flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10 sm:rounded-t-xl shrink-0">
              <h2 className="font-display text-xl text-ibbiNavy">{editing ? 'Editar Aula' : 'Nova Aula'}</h2>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Data da aula</label>
                <input type="date" className="w-full border rounded-lg px-3 py-2.5 sm:py-2 text-lg sm:text-base min-h-[44px] appearance-none" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Classe</label>
                <select className="w-full border rounded-lg px-3 py-2.5 sm:py-2 text-lg sm:text-base min-h-[44px] appearance-none" value={form.classe} onChange={(e) => setForm({ ...form, classe: e.target.value })}>
                  {classes.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Congregação</label>
                <select className="w-full border rounded-lg px-3 py-2.5 sm:py-2 text-lg sm:text-base min-h-[44px] appearance-none" value={form.congregacao} onChange={(e) => setForm({ ...form, congregacao: e.target.value })}>
                  {CONGREGACOES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Tema (Opcional)</label>
                <input className="w-full border rounded-lg px-3 py-2.5 sm:py-2 text-base sm:text-sm min-h-[44px] appearance-none" placeholder="Tema" value={form.tema} onChange={(e) => setForm({ ...form, tema: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Descrição (Opcional)</label>
                <textarea className="w-full border rounded-lg px-3 py-2.5 sm:py-2 text-base sm:text-sm min-h-[44px] resize-none" placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3 sticky bottom-0 bg-white z-10 w-full shrink-0 items-center">
              <button className="border rounded-lg px-4 py-3 sm:py-2 min-h-[44px] w-full sm:w-auto font-medium text-slate-600 hover:bg-slate-50 text-base sm:text-sm" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</button>
              <button className="bg-ibbiBlue hover:bg-ibbiNavy transition text-white rounded-lg px-4 py-3 sm:py-2 min-h-[44px] w-full sm:w-auto font-medium text-base sm:text-sm" onClick={saveAula}>Salvar aula</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
