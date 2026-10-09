import { Button, Field, inputClass } from '../../components/ui';
import { CONGREGACOES } from '../../constants/congregacoes';

// Agenda de cultos (lembretes "LEMBRETE"): um cartão por culto.
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const ANTECEDENCIA = [60, 120, 180, 240, 360, 720];
const NOVO = { titulo: 'Culto', diaSemana: 0, horario: '19:00', lembreteMin: 180, ativo: true };

export default function AgendaCultos({ cultos = [], onChange }) {
  const upd = (i, patch) => onChange(cultos.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <div className="space-y-3">
      {cultos.length === 0 && <p className="text-sm text-slate-400">Nenhum culto na agenda.</p>}
      {cultos.map((c, i) => (
        <div key={c._id || i} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <Field label="Nome do culto"><input className={inputClass} value={c.titulo || ''} onChange={(e) => upd(i, { titulo: e.target.value })} placeholder="Ex.: Culto da família" /></Field>
            </div>
            <button
              type="button"
              className="mb-0.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => onChange(cultos.filter((_, j) => j !== i))}
              aria-label={`Remover ${c.titulo || 'culto'}`}
            >
              Remover
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Dia">
              <select className={inputClass} value={c.diaSemana ?? 0} onChange={(e) => upd(i, { diaSemana: Number(e.target.value) })}>
                {DIAS.map((d, k) => <option key={d} value={k}>{d}</option>)}
              </select>
            </Field>
            <Field label="Horário"><input type="time" className={inputClass} value={c.horario || ''} onChange={(e) => upd(i, { horario: e.target.value })} /></Field>
            <Field label="Lembrete">
              <select className={inputClass} value={c.lembreteMin || 180} onChange={(e) => upd(i, { lembreteMin: Number(e.target.value) })}>
                {ANTECEDENCIA.map((m) => <option key={m} value={m}>{m / 60} {m === 60 ? 'hora' : 'horas'} antes</option>)}
              </select>
            </Field>
            <Field label="Congregação">
              <select className={inputClass} value={c.congregacao || ''} onChange={(e) => upd(i, { congregacao: e.target.value })}>
                <option value="">Todas</option>
                {CONGREGACOES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Link da transmissão (opcional)"><input className={inputClass} value={c.liveUrl || ''} onChange={(e) => upd(i, { liveUrl: e.target.value })} placeholder="https://youtube.com/..." /></Field>
        </div>
      ))}
      <Button variant="outline" onClick={() => onChange([...cultos, NOVO])}>+ Adicionar culto</Button>
      <p className="text-[11px] text-slate-400">O envio é gradual (~50 por hora): com muitos inscritos, use 3 horas ou mais de antecedência.</p>
    </div>
  );
}
