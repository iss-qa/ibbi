import { useEffect, useState } from 'react';

// Conversa simulada entre o assistente (Barnabé) e um líder: chamada → ausência → cuidado → retorno.
// Nomes fictícios. Roda em loop com indicador de "digitando".
const SCRIPT = [
  { from: 'ana', text: 'Bom dia, Pr. Marcos! 🙏 Chamada da classe *Jovens · Sede*. Quem faltou hoje?\n1 Ana Paula\n2 Bruno\n3 Carla\n4 Daniel\n5 Eduarda', delay: 900 },
  { from: 'lider', text: '2 e 4', delay: 1400 },
  { from: 'ana', text: 'Anotado ✅ Bruno e Daniel.\n\nBruno está na *3ª falta seguida*. Quer que eu envie uma mensagem de cuidado?', delay: 1600 },
  { from: 'lider', text: 'sim', delay: 1300 },
  { from: 'ana', text: 'Enviado 💛 Avisei a liderança também. Te conto se ele responder.', delay: 1500 },
  { from: 'ana', text: '🎉 Bruno respondeu: "Obrigado, pastor. Senti falta. Domingo estou aí!"', delay: 2200, highlight: true },
];

const PAUSE_END = 4500;

const Bold = ({ text }) => text.split(/(\*[^*]+\*)/g).map((part, i) => (
  part.startsWith('*') && part.endsWith('*')
    ? <strong key={i}>{part.slice(1, -1)}</strong>
    : <span key={i}>{part}</span>
));

export default function ChatDemo() {
  const [count, setCount] = useState(0);
  const [typing, setTyping] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let timer;
    const step = (i) => {
      if (cancelled) return;
      if (i >= SCRIPT.length) {
        timer = setTimeout(() => { setCount(0); step(0); }, PAUSE_END);
        return;
      }
      const msg = SCRIPT[i];
      setTyping(msg.from);
      timer = setTimeout(() => {
        if (cancelled) return;
        setTyping(null);
        setCount(i + 1);
        timer = setTimeout(() => step(i + 1), 500);
      }, msg.delay);
    };
    step(0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  const shown = SCRIPT.slice(0, count);

  return (
    <div className="relative mx-auto w-[300px] sm:w-[330px]">
      {/* moldura do celular */}
      <div className="rounded-[2.4rem] bg-slate-900 p-2.5 shadow-2xl shadow-black/40 ring-1 ring-white/10">
        <div className="rounded-[2rem] overflow-hidden bg-[#efe7dd] h-[560px] flex flex-col">
          <div className="bg-[#075e54] text-white px-4 pt-7 pb-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brandGold text-brandNavy grid place-items-center font-bold">B</div>
            <div className="leading-tight">
              <p className="font-semibold text-sm">Barnabé · PastorIA</p>
              <p className="text-[11px] text-white/80">{typing === 'ana' ? 'digitando…' : 'online'}</p>
            </div>
          </div>

          {/* text-slate-800: o hero é text-white e as bolhas herdariam a cor */}
          <div className="flex-1 overflow-hidden px-3 py-3 space-y-2 text-[13px] leading-snug text-slate-800 flex flex-col justify-end">
            {shown.map((m, i) => (
              <div key={i} className={`animate-bubble max-w-[85%] rounded-2xl px-3 py-2 whitespace-pre-line shadow-sm ${m.from === 'ana'
                ? `self-start bg-white rounded-tl-sm ${m.highlight ? 'ring-2 ring-brandGold' : ''}`
                : 'self-end bg-[#dcf8c6] rounded-tr-sm'}`}
              >
                <Bold text={m.text} />
                <span className="block text-[10px] text-slate-400 text-right mt-1">11:3{i} ✓✓</span>
              </div>
            ))}
            {typing && (
              <div className={`animate-bubble rounded-2xl px-3 py-2.5 shadow-sm flex gap-1 ${typing === 'ana' ? 'self-start bg-white' : 'self-end bg-[#dcf8c6]'}`}>
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-slate-500" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-slate-500" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-slate-500" />
              </div>
            )}
          </div>

          <div className="px-3 pb-4 pt-1">
            <div className="bg-white rounded-full px-4 py-2 text-xs text-slate-400 flex items-center justify-between">
              Mensagem
              <span className="w-6 h-6 rounded-full bg-[#075e54]" />
            </div>
          </div>
        </div>
      </div>

      {/* selos flutuantes */}
      <div className="animate-float absolute -left-8 sm:-left-20 top-28 bg-white rounded-xl shadow-soft px-3 py-2 text-xs font-semibold text-brandNavy flex items-center gap-2">
        <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500 text-emerald-500 pulse-ring" />
        Chamada feita em 8s
      </div>
      <div className="animate-float-slow absolute -right-8 sm:-right-16 bottom-14 bg-white rounded-xl shadow-soft px-3 py-2 text-xs font-semibold text-brandNavy">
        💛 1 pessoa reengajada
      </div>
    </div>
  );
}
