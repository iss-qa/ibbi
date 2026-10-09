import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/Header';
import api from '../../services/api';
import { Button, Field, inputClass } from '../../components/ui';
import { ATIVIDADES, atividadeLabel } from './shared';

const OBS = ['Trabalho', 'Viagem', 'Doente', 'Outros'];

export default function EncontroChamada() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [enc, setEnc] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { api.get(`/encontros/${id}`).then((r) => setEnc(r.data)); }, [id]);

  const stats = useMemo(() => {
    const total = enc?.presencas?.length || 0;
    const presentes = enc?.presencas?.filter((p) => p.presente).length || 0;
    return { total, presentes, ausentes: total - presentes, pct: total ? Math.round((presentes / total) * 100) : 0 };
  }, [enc]);

  if (!enc) return <p className="text-sm text-slate-500">Carregando...</p>;

  const setP = (idx, patch) => setEnc((e) => ({ ...e, presencas: e.presencas.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }));
  const all = (v) => setEnc((e) => ({ ...e, presencas: e.presencas.map((p) => ({ ...p, presente: v, justificativa: v ? '' : p.justificativa })) }));

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      await api.put(`/encontros/${id}`, { tema: enc.tema, descricao: enc.descricao, atividade: enc.atividade });
      await api.put(`/encontros/${id}/presencas`, { presencas: enc.presencas });
      setMsg('Chamada salva. Quem faltou entra no cuidado pastoral automaticamente.');
      setTimeout(() => navigate(`/encontros/grupos/${enc.grupoId}`), 900);
    } catch (err) {
      setMsg(err?.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Link to={`/encontros/grupos/${enc.grupoId}`} className="text-sm text-ibbiBlue">← {enc.grupoNome}</Link>
      <Header title={`${enc.grupoNome} — ${new Date(enc.data).toLocaleDateString('pt-BR')}`} subtitle={`${atividadeLabel(enc.atividade)}${enc.tema ? ` · ${enc.tema}` : ''}`} />

      <div className="bg-white rounded-2xl shadow-soft p-4 sm:p-6">
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <Field label="Atividade">
            <select className={inputClass} value={enc.atividade} onChange={(e) => setEnc({ ...enc, atividade: e.target.value })}>
              {ATIVIDADES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Tema"><input className={inputClass} value={enc.tema || ''} onChange={(e) => setEnc({ ...enc, tema: e.target.value })} /></Field>
          <Field label="Anotações"><input className={inputClass} value={enc.descricao || ''} onChange={(e) => setEnc({ ...enc, descricao: e.target.value })} /></Field>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
          <div className="bg-emerald-50 text-emerald-700 rounded-xl p-2.5 sm:p-3 min-w-0"><p className="text-xs truncate">Presentes</p><p className="text-xl sm:text-2xl font-semibold tabular-nums">{stats.presentes}</p></div>
          <div className="bg-rose-50 text-rose-700 rounded-xl p-2.5 sm:p-3 min-w-0"><p className="text-xs truncate">Ausentes</p><p className="text-xl sm:text-2xl font-semibold tabular-nums">{stats.ausentes}</p></div>
          <div className="bg-blue-50 text-blue-700 rounded-xl p-2.5 sm:p-3 min-w-0"><p className="text-xs truncate">Frequência</p><p className="text-xl sm:text-2xl font-semibold tabular-nums">{stats.pct}%</p></div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <Button variant="outline" onClick={() => all(true)}>Todos presentes</Button>
          <Button variant="outline" onClick={() => all(false)}>Todos ausentes</Button>
        </div>

        <ul className="divide-y divide-slate-100">
          {enc.presencas.map((p, idx) => (
            <li key={p.personId || idx} className="py-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="flex items-center gap-3 flex-1 cursor-pointer">
                <input type="checkbox" className="w-5 h-5 accent-emerald-600" checked={p.presente} onChange={(e) => setP(idx, { presente: e.target.checked, ...(e.target.checked ? { justificativa: '' } : {}) })} />
                <span className={p.presente ? 'text-slate-800' : 'text-slate-400 line-through'}>{p.nome}</span>
              </label>
              {!p.presente && (
                <select className={`${inputClass} sm:max-w-[180px]`} value={p.justificativa || ''} onChange={(e) => setP(idx, { justificativa: e.target.value })}>
                  <option value="">Sem justificativa</option>
                  {OBS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
            </li>
          ))}
        </ul>

        {msg && <p className="text-sm text-slate-700 mt-3">{msg}</p>}
        <div className="flex justify-end mt-4"><Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar chamada'}</Button></div>
      </div>
    </div>
  );
}
