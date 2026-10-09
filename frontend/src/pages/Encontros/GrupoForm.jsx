import { useState } from 'react';
import { Button, Field, Toggle, inputClass } from '../../components/ui';
import useCongregacaoScope from '../../hooks/useCongregacaoScope';
import PersonPicker from './PersonPicker';
import { DIAS, EBD_CLASSES, TIPOS } from './shared';

// Formulário de grupo: usado na criação (modal) e na aba Configurar.
export default function GrupoForm({ initial, onSubmit, submitLabel = 'Salvar' }) {
  const { options: congregacoes } = useCongregacaoScope();
  const [f, setF] = useState(() => ({
    nome: '', tipo: 'uniao_feminina', congregacao: congregacoes[0] || '', diaSemana: 3, horario: '19:30', local: '',
    criterios: TIPOS[0].criterios, ebdClasses: [], lideres: [], convocarChamada: true, horaChamada: '21:30', descricao: '',
    ...(initial || {}),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setCrit = (k, v) => setF((x) => ({ ...x, criterios: { ...(x.criterios || {}), [k]: v === '' ? undefined : v } }));

  const escolherTipo = (id) => {
    const t = TIPOS.find((x) => x.id === id);
    setF((x) => ({ ...x, tipo: id, criterios: { ...t.criterios }, ebdClasses: t.ebdClasses || [], nome: !x.nome || TIPOS.some((tt) => tt.label === x.nome) ? t.label : x.nome }));
  };

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await onSubmit({ ...f, criterios: { sexo: f.criterios?.sexo || null, idadeMin: f.criterios?.idadeMin ? Number(f.criterios.idadeMin) : undefined, idadeMax: f.criterios?.idadeMax ? Number(f.criterios.idadeMax) : undefined, tipos: f.criterios?.tipos || [] } });
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {!initial && (
        <div className="flex flex-wrap gap-1.5">
          {TIPOS.map((t) => (
            <button key={t.id} type="button" onClick={() => escolherTipo(t.id)}
              className={`px-3 py-1.5 rounded-full text-xs border ${f.tipo === t.id ? 'bg-ibbiNavy text-white border-ibbiNavy' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Nome do grupo"><input className={inputClass} value={f.nome} onChange={(e) => set('nome', e.target.value)} placeholder="União Feminina" /></Field>
        <Field label="Congregação">
          <select className={inputClass} value={f.congregacao} onChange={(e) => set('congregacao', e.target.value)}>
            {congregacoes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Dia do encontro">
          <select className={inputClass} value={f.diaSemana} onChange={(e) => set('diaSemana', Number(e.target.value))}>
            {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </Field>
        <Field label="Horário"><input type="time" className={inputClass} value={f.horario} onChange={(e) => set('horario', e.target.value)} /></Field>
        <Field label="Local"><input className={inputClass} value={f.local || ''} onChange={(e) => set('local', e.target.value)} placeholder="Templo sede, salão…" /></Field>
        <Field label="Descrição"><input className={inputClass} value={f.descricao || ''} onChange={(e) => set('descricao', e.target.value)} /></Field>
      </div>

      <div className="border border-slate-100 rounded-lg p-3">
        <p className="text-sm font-medium text-slate-700">Quem faz parte</p>
        <p className="text-xs text-slate-400 mb-2">Pessoas ativas da congregação que atendem aos critérios entram automaticamente. Você pode adicionar ou remover na aba Membros.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1">
          <Field label="Sexo">
            <select className={inputClass} value={f.criterios?.sexo || ''} onChange={(e) => setCrit('sexo', e.target.value || null)}>
              <option value="">Todos</option><option value="Feminino">Feminino</option><option value="Masculino">Masculino</option>
            </select>
          </Field>
          <Field label="Idade mínima"><input type="number" min="0" className={inputClass} value={f.criterios?.idadeMin ?? ''} onChange={(e) => setCrit('idadeMin', e.target.value)} /></Field>
          <Field label="Idade máxima"><input type="number" min="0" className={inputClass} value={f.criterios?.idadeMax ?? ''} onChange={(e) => setCrit('idadeMax', e.target.value)} /></Field>
        </div>
      </div>

      <div className="border border-slate-100 rounded-lg p-3">
        <p className="text-sm font-medium text-slate-700">Aulas da EBD que contam como encontro</p>
        <p className="text-xs text-slate-400 mb-2">A chamada continua sendo feita na EBD; cada aula dessas classes aparece como um encontro do grupo (ex.: União de Jovens ← Jovens).</p>
        <div className="flex flex-wrap gap-1.5">
          {EBD_CLASSES.map((c) => {
            const on = (f.ebdClasses || []).includes(c);
            return (
              <button key={c} type="button" onClick={() => set('ebdClasses', on ? f.ebdClasses.filter((x) => x !== c) : [...(f.ebdClasses || []), c])}
                className={`px-3 py-1 rounded-full text-xs border ${on ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                aria-pressed={on}>
                {on ? '✓ ' : ''}EBD {c}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border border-slate-100 rounded-lg p-3">
        <p className="text-sm font-medium text-slate-700 mb-2">Liderança do grupo</p>
        <div className="space-y-2 mb-2">
          {(f.lideres || []).map((l, i) => (
            <div key={`${l.personId || l.nome}-${i}`} className="flex gap-2 items-center">
              <span className="flex-1 text-sm truncate">{l.nome}</span>
              <input className={`${inputClass} max-w-[160px]`} placeholder="Papel (Presidente…)" value={l.papel || ''} onChange={(e) => set('lideres', f.lideres.map((x, j) => (j === i ? { ...x, papel: e.target.value } : x)))} />
              <input className={`${inputClass} max-w-[170px]`} placeholder="WhatsApp" value={l.celular || ''} onChange={(e) => set('lideres', f.lideres.map((x, j) => (j === i ? { ...x, celular: e.target.value } : x)))} />
              <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => set('lideres', f.lideres.filter((_, j) => j !== i))} aria-label="Remover">✕</button>
            </div>
          ))}
        </div>
        <PersonPicker congregacao={f.congregacao} placeholder="Adicionar líder (buscar pelo nome)" onPick={(p) => set('lideres', [...(f.lideres || []), { personId: p._id, nome: p.nome, celular: p.celular || '', papel: '' }])} />
        <div className="mt-3 grid sm:grid-cols-2 gap-2 items-end">
          <Toggle checked={f.convocarChamada} onChange={(v) => set('convocarChamada', v)} label="Pedir a chamada aos líderes no WhatsApp" hint="No dia do encontro, após o horário abaixo" />
          <Field label="Horário do pedido"><input type="time" className={inputClass} value={f.horaChamada} onChange={(e) => set('horaChamada', e.target.value)} /></Field>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end"><Button onClick={submit} disabled={saving || !f.nome || !f.congregacao}>{saving ? 'Salvando...' : submitLabel}</Button></div>
    </div>
  );
}
