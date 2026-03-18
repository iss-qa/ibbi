import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../../components/Header';
import api from '../../services/api';

const classeToGrupo = {
  'Crianças': 'criança',
  'Adolescentes': 'adolescente',
  'Jovens': 'jovem',
  'Adultos 1': 'adulto 1',
  'Adultos 2': 'adulto 2',
  'Idosos': 'idoso',
  'Anciãos': 'ancião',
};

const OBS_OPTIONS = ['Trabalho', 'Viagem', 'Doente', 'Outros'];

export default function EbdChamada() {
  const { id } = useParams();
  const [aula, setAula] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    const { data } = await api.get(`/ebd/${id}`);
    setAula(data);

    const grupo = classeToGrupo[data.classe] || data.classe;
    const members = await api.get('/persons', { params: { grupo, status: 'ativo', congregacao: data.congregacao, limit: 500 } });
    const existing = new Map((data.presencas || []).map((p) => [String(p.personId), p]));
    const presencas = (members.data.items || []).map((p) => {
      const prev = existing.get(String(p._id));
      return {
        personId: p._id,
        nome: p.nome,
        congregacao: p.congregacao,
        presente: prev ? prev.presente : true,
        justificativa: prev ? prev.justificativa || '' : '',
      };
    });
    setAula((prev) => ({ ...prev, presencas }));
  };

  useEffect(() => {
    load();
  }, [id]);

  const stats = useMemo(() => {
    if (!aula) return { presentes: 0, ausentes: 0, total: 0, percentual: 0 };
    const total = aula.presencas?.length || 0;
    const presentes = aula.presencas?.filter((p) => p.presente).length || 0;
    const ausentes = total - presentes;
    const percentual = total ? Math.round((presentes / total) * 100) : 0;
    return { presentes, ausentes, total, percentual };
  }, [aula]);

  const togglePresenca = (idx, presente) => {
    setAula((prev) => {
      const updated = { ...prev };
      updated.presencas = [...(updated.presencas || [])];
      updated.presencas[idx] = { ...updated.presencas[idx], presente };
      if (presente) updated.presencas[idx].justificativa = '';
      return updated;
    });
  };

  const updateObs = (idx, value) => {
    setAula((prev) => {
      const updated = { ...prev };
      updated.presencas = [...(updated.presencas || [])];
      updated.presencas[idx] = { ...updated.presencas[idx], justificativa: value };
      return updated;
    });
  };

  const markAll = (value) => {
    setAula((prev) => ({
      ...prev,
      presencas: (prev.presencas || []).map((p) => ({ ...p, presente: value, justificativa: value ? '' : p.justificativa })),
    }));
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const payload = (aula.presencas || []).map((p) => ({
        personId: p.personId,
        presente: p.presente,
        justificativa: p.justificativa || '',
        nome: p.nome,
      }));
      await api.put(`/ebd/${id}/presencas`, { presencas: payload });
      setMessage('Chamada salva com sucesso.');
      setTimeout(() => {
        window.location.href = '/ebd';
      }, 600);
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Erro ao salvar chamada.');
    } finally {
      setSaving(false);
    }
  };

  if (!aula) return null;

  return (
    <div>
      <Header title={`EBD — ${aula.classe} — ${new Date(aula.data).toLocaleDateString('pt-BR')}`} subtitle={aula.tema || 'Chamada de presença'} />

      <div className="bg-white rounded-xl shadow-soft p-6">
        <div className="sticky top-0 bg-white z-10 pb-4">
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div className="bg-emerald-50 text-emerald-700 rounded-xl p-4">
              <p className="text-xs">Presentes</p>
              <p className="text-2xl font-semibold">{stats.presentes}</p>
            </div>
            <div className="bg-rose-50 text-rose-700 rounded-xl p-4">
              <p className="text-xs">Ausentes</p>
              <p className="text-2xl font-semibold">{stats.ausentes}</p>
            </div>
            <div className="bg-blue-50 text-blue-700 rounded-xl p-4">
              <p className="text-xs">Percentual</p>
              <p className="text-2xl font-semibold">{stats.percentual}%</p>
            </div>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-2 bg-emerald-400" style={{ width: `${stats.percentual}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-2">{stats.presentes} de {stats.total} presentes</p>

          <div className="flex flex-wrap gap-3 mt-4">
            <button className="border rounded-lg px-3 py-2" onClick={() => markAll(true)}>Marcar todos presentes</button>
            <button className="border rounded-lg px-3 py-2" onClick={() => markAll(false)}>Marcar todos ausentes</button>
          </div>
        </div>

        <div className="mt-6">
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-3">Presença</th>
                  <th className="px-4 py-3">Aluno</th>
                  <th className="px-4 py-3">Congregação</th>
                  <th className="px-4 py-3">Observação</th>
                </tr>
              </thead>
              <tbody>
                {(aula.presencas || []).map((p, idx) => (
                  <tr key={p.personId} className="border-b hover:bg-stone-50 transition">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="w-4 h-4 cursor-pointer" checked={p.presente} onChange={(e) => togglePresenca(idx, e.target.checked)} />
                    </td>
                    <td className="px-4 py-3">{p.nome}</td>
                    <td className="px-4 py-3">{p.congregacao || '-'}</td>
                    <td className="px-4 py-3">
                      {!p.presente ? (
                        <select className="border rounded-lg px-2 py-2 text-lg sm:text-sm" value={p.justificativa || ''} onChange={(e) => updateObs(idx, e.target.value)}>
                          <option value="">Selecione</option>
                          {OBS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt.toLowerCase()}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden flex flex-col gap-3">
            {(aula.presencas || []).map((p, idx) => (
              <div key={p.personId} className={`border rounded-xl p-4 flex flex-col gap-3 transition ${p.presente ? 'bg-emerald-50/30 border-emerald-100' : 'bg-white border-slate-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm font-semibold text-slate-800 line-clamp-2">{p.nome}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{p.congregacao || '-'}</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200 shrink-0 shadow-sm active:scale-95 transition-transform">
                    <input type="checkbox" className="w-5 h-5 accent-blue-600 rounded" checked={p.presente} onChange={(e) => togglePresenca(idx, e.target.checked)} />
                    <span className="text-sm font-medium text-slate-700 select-none hidden xs:inline">{p.presente ? 'Presente' : 'Marcar'}</span>
                  </label>
                </div>
                {!p.presente && (
                  <div className="mt-2 pt-3 border-t border-slate-100 flex flex-col gap-2">
                    <label className="text-xs text-slate-500 font-medium">Observação / Justificativa:</label>
                    <select className="w-full border rounded-lg px-3 py-2.5 text-lg sm:text-base bg-slate-50 min-h-[44px]" value={p.justificativa || ''} onChange={(e) => updateObs(idx, e.target.value)}>
                      <option value="">Nenhuma</option>
                      {OBS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt.toLowerCase()}>{opt}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
          <button className="bg-ibbiBlue text-white px-4 py-3 sm:py-2 rounded-lg font-semibold min-h-[44px] w-full sm:w-auto shadow-sm" onClick={save} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar presença'}
          </button>
          {message && <p className={`text-sm text-center sm:text-left ${message.includes('sucesso') ? 'text-green-600' : 'text-red-600'}`}>{message}</p>}
        </div>
      </div>
    </div>
  );
}
