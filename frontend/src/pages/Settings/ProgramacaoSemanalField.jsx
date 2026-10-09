import { useState } from 'react';
import { inputClass } from '../../components/ui';

// Programação semanal (boas-vindas de visitantes): horários prontos + horários livres.
// Continua salva como texto (Tenant.programacaoSemanal), uma linha por horário:
//   🟡 *Domingo — 09:00 | EBD*
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const PRESETS = [
  { dia: 0, hora: '08:45', nome: 'EBD' },
  { dia: 0, hora: '09:00', nome: 'EBD' },
  { dia: 0, hora: '18:00', nome: 'Culto' },
  { dia: 0, hora: '19:00', nome: 'Culto' },
  { dia: 2, hora: '19:30', nome: 'Culto de oração' },
  { dia: 3, hora: '19:30', nome: 'Estudo bíblico' },
  { dia: 4, hora: '19:30', nome: 'Culto' },
  { dia: 6, hora: '19:00', nome: 'Culto de jovens' },
];

const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const LINHA = /^\s*(?:🟡\s*)?\*?\s*(domingo|segunda|terca|quarta|quinta|sexta|sabado)\S*\s*[—–-]\s*(\d{1,2})(?:[:h](\d{2}))?h?\s*\|\s*(.+?)\s*\*?\s*$/i;

const parse = (texto) => {
  const linhas = [];
  const livres = [];
  String(texto || '').split('\n').forEach((l) => {
    const m = semAcento(l).match(LINHA);
    if (!m) { if (l.trim()) livres.push(l); return; }
    const nome = l.split('|').slice(1).join('|').replace(/\*\s*$/, '').trim();
    linhas.push({ dia: DIAS.findIndex((d) => semAcento(d) === m[1]), hora: `${m[2].padStart(2, '0')}:${m[3] || '00'}`, nome });
  });
  return { linhas, livres: livres.join('\n') };
};

const serialize = (linhas, livres) => [
  ...[...linhas]
    .filter((l) => l.nome.trim() && l.hora)
    .sort((a, b) => a.dia - b.dia || a.hora.localeCompare(b.hora))
    .map((l) => `🟡 *${DIAS[l.dia]} — ${l.hora} | ${l.nome.trim()}*`),
  ...(livres.trim() ? [livres.trim()] : []),
].join('\n');

export default function ProgramacaoSemanalField({ value, onChange }) {
  const [estado, setEstado] = useState(() => parse(value));
  const atualizar = (next) => {
    setEstado(next);
    onChange(serialize(next.linhas, next.livres));
  };
  const setLinha = (i, patch) => atualizar({ ...estado, linhas: estado.linhas.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const existe = (p) => estado.linhas.some((l) => l.dia === p.dia && l.hora === p.hora && semAcento(l.nome) === semAcento(p.nome));

  return (
    <div className="space-y-3">
      {estado.linhas.length === 0 && <p className="text-sm text-slate-400">Nenhum horário. Escolha abaixo ou adicione um.</p>}
      {estado.linhas.map((l, i) => (
        // Celular: dia · horário · ✕ na primeira linha, atividade embaixo. Desktop: tudo numa linha.
        <div key={i} className="grid grid-cols-[1fr_6.5rem_auto] sm:grid-cols-[8.5rem_6.5rem_1fr_auto] gap-2 items-center">
          <select className={`${inputClass} order-1`} value={l.dia} onChange={(e) => setLinha(i, { dia: Number(e.target.value) })} aria-label="Dia">
            {DIAS.map((d, k) => <option key={d} value={k}>{d}</option>)}
          </select>
          <input type="time" className={`${inputClass} order-2`} value={l.hora} onChange={(e) => setLinha(i, { hora: e.target.value })} aria-label="Horário" />
          <input className={`${inputClass} col-span-3 sm:col-span-1 order-4 sm:order-3`} value={l.nome} placeholder="Ex.: Culto da família" onChange={(e) => setLinha(i, { nome: e.target.value })} aria-label="Atividade" />
          <button type="button" className="order-3 sm:order-4 p-2 text-slate-400 hover:text-red-600" aria-label="Remover horário" onClick={() => atualizar({ ...estado, linhas: estado.linhas.filter((_, j) => j !== i) })}>✕</button>
        </div>
      ))}

      <div>
        <p className="text-xs font-medium text-slate-500 mb-1.5">Horários comuns</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.filter((p) => !existe(p)).map((p) => (
            <button
              key={`${p.dia}${p.hora}${p.nome}`}
              type="button"
              className="px-2.5 py-1 rounded-full border border-slate-200 text-xs text-slate-600 hover:border-ibbiBlue hover:text-ibbiBlue"
              onClick={() => atualizar({ ...estado, linhas: [...estado.linhas, p] })}
            >
              + {DIAS[p.dia]} {p.hora} · {p.nome}
            </button>
          ))}
          <button
            type="button"
            className="px-2.5 py-1 rounded-full border border-dashed border-slate-300 text-xs font-medium text-slate-700 hover:border-ibbiBlue hover:text-ibbiBlue"
            onClick={() => atualizar({ ...estado, linhas: [...estado.linhas, { dia: 0, hora: '19:00', nome: '' }] })}
          >
            + Outro horário
          </button>
        </div>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-slate-500">Observação (opcional)</span>
        <textarea
          className={`${inputClass} mt-1 min-h-[64px]`}
          value={estado.livres}
          onChange={(e) => atualizar({ ...estado, livres: e.target.value })}
          placeholder="Ex.: Rua das Flores, 120 · Estacionamento no local"
        />
      </label>
    </div>
  );
}
