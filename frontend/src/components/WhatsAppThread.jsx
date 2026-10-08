import { useEffect, useMemo, useRef, useState } from 'react';

// Cores do WhatsApp (tema claro)
export const WA = { header: '#075E54', bg: '#efeae2', out: '#d9fdd3', in: '#ffffff', tick: '#53bdeb', meta: '#667781' };

const ROTULO_COR = {
  aniversario: 'bg-amber-100 text-amber-800',
  ausencia: 'bg-rose-100 text-rose-800',
  visitante: 'bg-emerald-100 text-emerald-800',
  novo_decidido: 'bg-emerald-100 text-emerald-800',
  'novo cadastro': 'bg-sky-100 text-sky-800',
  assistente: 'bg-violet-100 text-violet-800',
  oracao: 'bg-indigo-100 text-indigo-800',
  lideranca: 'bg-slate-200 text-slate-700',
};

// *negrito* e _itálico_ como no WhatsApp
export const formatWa = (text) => String(text || '').split('\n').map((line, i) => (
  <span key={i} className="block min-h-[1.2em]">
    {line.split(/(\*[^*\n]+\*|_[^_\n]+_)/g).map((p, j) => {
      if (/^\*[^*]+\*$/.test(p)) return <strong key={j}>{p.slice(1, -1)}</strong>;
      if (/^_[^_]+_$/.test(p)) return <em key={j}>{p.slice(1, -1)}</em>;
      return p;
    })}
  </span>
));

export const hora = (d) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const dia = (d) => {
  const date = new Date(d);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (date.toDateString() === hoje.toDateString()) return 'Hoje';
  if (date.toDateString() === ontem.toDateString()) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
};

function Ticks({ status, erro }) {
  if (status === 'erro') return <span className="text-red-500 text-[11px]" title={erro || 'Não entregue'}>⚠︎ não entregue</span>;
  if (status === 'pendente' || status === 'enviando') return <span style={{ color: WA.meta }} title="Enviando">🕓</span>;
  return <span style={{ color: WA.tick }} title="Enviada" aria-label="Enviada">✓✓</span>;
}

/**
 * Conversa no estilo WhatsApp. `itens` vem de /me/whatsapp ou /whatsapp-panel/person/:id.
 * header: nó renderizado na barra verde; emptyText: mensagem quando não há itens.
 */
export default function WhatsAppThread({ itens = [], header, emptyText, loading, footer, showErrors = false }) {
  const [filtro, setFiltro] = useState('todas');
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView(); }, [itens, filtro]);
  useEffect(() => { setFiltro('todas'); }, [itens]);

  const tipos = useMemo(() => {
    const map = new Map();
    itens.forEach((i) => i.rotulo && map.set(i.tipo, i.rotulo));
    return [...map.entries()];
  }, [itens]);
  const visiveis = itens.filter((i) => filtro === 'todas' || i.tipo === filtro);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 px-4 py-3 text-white shrink-0" style={{ background: WA.header }}>
        <div className="min-w-0 flex-1">{header}</div>
        {tipos.length > 1 && (
          <select
            className="text-xs rounded-md bg-white/15 border border-white/20 px-2 py-1 text-white"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            aria-label="Filtrar mensagens"
          >
            <option value="todas" className="text-slate-800">Todas</option>
            {tipos.map(([t, r]) => <option key={t} value={t} className="text-slate-800">{r}</option>)}
          </select>
        )}
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4 space-y-1.5"
        style={{ background: WA.bg, backgroundImage: 'radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
      >
        {loading && <p className="text-center text-sm text-slate-500 mt-10">Carregando...</p>}
        {!loading && visiveis.length === 0 && (
          <p className="text-center text-sm text-slate-600 bg-white/80 rounded-lg p-3 mt-10">{emptyText || 'Nenhuma mensagem.'}</p>
        )}
        {!loading && visiveis.map((m, idx) => {
          const novoDia = idx === 0 || dia(visiveis[idx - 1].em) !== dia(m.em);
          const minha = m.direcao === 'enviada';
          return (
            <div key={m.id}>
              {novoDia && (
                <div className="flex justify-center my-3">
                  <span className="text-[11px] px-3 py-1 rounded-lg bg-white/90 shadow-sm" style={{ color: WA.meta }}>{dia(m.em)}</span>
                </div>
              )}
              <div className={`flex ${minha ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`relative max-w-[85%] sm:max-w-[75%] rounded-lg px-2.5 pt-1.5 pb-1 text-[14px] leading-snug shadow-sm text-[#111b21] ${minha ? 'rounded-tr-none' : 'rounded-tl-none'}`}
                  style={{ background: minha ? WA.out : WA.in }}
                >
                  {m.rotulo && !minha && (
                    <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded mb-1 ${ROTULO_COR[m.tipo] || 'bg-slate-100 text-slate-700'}`}>{m.rotulo}</span>
                  )}
                  {m.anexo && (
                    <div className="mb-1.5 rounded-md bg-gradient-to-br from-amber-50 to-rose-50 border border-amber-100 px-3 py-4 text-center text-xs text-amber-900">🎂 {m.anexo}</div>
                  )}
                  <div className="break-words">{formatWa(m.texto)}</div>
                  {showErrors && m.status === 'erro' && m.erro && <p className="text-[11px] text-red-600 mt-1">Motivo: {m.erro}</p>}
                  <div className="flex justify-end items-center gap-1 mt-0.5 text-[11px]" style={{ color: WA.meta }}>
                    <span>{hora(m.em)}</span>
                    {!minha && m.tipo !== 'assistente' && <Ticks status={m.status} erro={m.erro} />}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {footer && <div className="px-3 py-2.5 bg-[#f0f2f5] flex items-center gap-2 border-t border-black/5 shrink-0">{footer}</div>}
    </div>
  );
}
