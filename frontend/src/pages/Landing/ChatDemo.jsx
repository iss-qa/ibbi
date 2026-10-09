import { useEffect, useState } from 'react';

// Conversas simuladas entre o assistente (Barnabé) e um líder, uma por contexto.
// Cada cena roda 2 vezes e passa para a próxima; os pontos embaixo trocam na mão. Nomes fictícios.
const SCENES = [
  {
    id: 'ebd',
    label: 'EBD',
    chip: 'Domingo · Chamada da EBD',
    hora: [11, 30],
    script: [
      { from: 'bot', text: 'Bom dia, Pr. Byrne! 🙏 Chamada da classe *Jovens · Sede*. Quem faltou hoje?\n1 Ana Paula\n2 Bruno\n3 Carla\n4 Daniel\n5 Eduarda', delay: 900 },
      { from: 'lider', text: '2 e 4', delay: 1400 },
      { from: 'bot', text: 'Anotado ✅ Bruno e Daniel.\n\nBruno está na *3ª falta seguida*. Quer que eu envie uma mensagem de cuidado?', delay: 1600 },
      { from: 'lider', text: 'sim', delay: 1300 },
      { from: 'bot', text: 'Enviado 💛 Avisei a liderança também. Te conto se ele responder.', delay: 1500 },
      { from: 'bot', text: '🎉 Bruno respondeu: "Obrigado, pastor. Senti falta. Domingo estou aí!"', delay: 2200, highlight: true },
    ],
    badges: [
      { icon: 'pulse', text: 'Chamada feita em 8s' },
      { icon: '💛', text: '1 pessoa reengajada' },
    ],
  },
  {
    id: 'encontros',
    label: 'Encontros',
    chip: 'Segunda · Cuidado da semana',
    hora: [9, 10],
    script: [
      { from: 'bot', text: '📉 Pr. Byrne, a *Júlia* (União de Jovens) está esfriando: veio a 4 de 4 encontros e faltou 3 dos últimos 4.\n\nComo quer cuidar?\n1 Ligar\n2 Visitar\n3 Orar\n4 Mandar mensagem', delay: 1100 },
      { from: 'lider', text: '2', delay: 1200 },
      { from: 'bot', text: 'Visita encaminhada ao diácono *Paulo*, que mora perto dela 🏠\nSábado te pergunto se foi feita.', delay: 1600 },
      { from: 'bot', text: 'Sábado chegou 🙂 A visita à Júlia foi feita?', delay: 1500 },
      { from: 'lider', text: 'Foi! Ela está passando por um luto. Disse que volta domingo 🙏', delay: 1700 },
      { from: 'bot', text: '🎉 Júlia marcou presença no encontro de sexta! Não deixamos ela se afastar.', delay: 2200, highlight: true },
    ],
    badges: [
      { icon: '📉', text: 'Esfriamento visto cedo' },
      { icon: '🏠', text: 'Visita no tempo certo' },
    ],
  },
  {
    id: 'aniversario',
    label: 'Aniversários',
    chip: 'Hoje · 08:00',
    hora: [8, 0],
    script: [
      { from: 'bot', text: '🎂 Bom dia, Pr. Byrne! Hoje fazem aniversário *Dona Cida* (72) e *Lucas* (15).\nAs felicitações com cartão já foram enviadas 💌', delay: 1100 },
      { from: 'lider', text: 'A Dona Cida não vem há um tempo, né?', delay: 1500 },
      { from: 'bot', text: 'Isso: *4 domingos* sem vir. Quer que eu mande um recado seu junto do parabéns, dizendo que a igreja sente falta dela?', delay: 1700 },
      { from: 'lider', text: 'manda sim', delay: 1200 },
      { from: 'bot', text: 'Enviado 💛 "Dona Cida, feliz aniversário! A família da fé sente sua falta. Domingo guardamos seu lugar."', delay: 1700 },
      { from: 'bot', text: '🎉 Dona Cida respondeu: "Que alegria lembrarem de mim! Domingo vou com minha neta."', delay: 2200, highlight: true },
    ],
    badges: [
      { icon: '🎂', text: 'Ninguém esquecido' },
      { icon: '💌', text: 'Cartão enviado às 08h' },
    ],
  },
  {
    id: 'visitante',
    label: 'Visitantes',
    chip: 'Jornada do visitante · 30 dias',
    hora: [19, 40],
    script: [
      { from: 'bot', text: '🌱 Pr. Byrne, a *Mariana* visitou o culto de domingo (check-in pelo QR). Já enviei boas-vindas e a programação da semana.', delay: 1200 },
      { from: 'bot', text: 'Dia 7: ela contou que quer conhecer a *União de Jovens*. Posso pedir ao líder Thiago para recebê-la na sexta?', delay: 1700 },
      { from: 'lider', text: 'pode sim!', delay: 1200 },
      { from: 'bot', text: 'Feito ✅ Thiago já tem o contato dela e vai esperar na porta.', delay: 1500 },
      { from: 'bot', text: '🎉 Mariana voltou! Presença registrada no encontro de sexta. Ela não ficou só na primeira visita.', delay: 2200, highlight: true },
    ],
    badges: [
      { icon: '🌱', text: 'Jornada de 30 dias' },
      { icon: '🙌', text: 'Visitante voltou' },
    ],
  },
];

const PLAYS_PER_SCENE = 2;
const PAUSE_END = 3000;
// Tempo para ler a mensagem antes da próxima começar a ser digitada (~20 caracteres por segundo).
const leitura = (text) => Math.min(6500, Math.max(1500, text.length * 50));

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const Bold = ({ text }) => text.split(/(\*[^*]+\*)/g).map((part, i) => (
  part.startsWith('*') && part.endsWith('*')
    ? <strong key={i}>{part.slice(1, -1)}</strong>
    : <span key={i}>{part}</span>
));

const horario = ([h, m], i) => {
  const t = h * 60 + m + i;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export default function ChatDemo() {
  // run muda a cada reinício (fim da rodada ou clique), mesmo voltando para a mesma cena
  const [play, setPlay] = useState({ scene: 0, round: 0, run: 0 });
  // progresso amarrado à rodada: na troca de cena nada da conversa anterior aparece
  const [progress, setProgress] = useState({ run: 0, count: 0 });
  const [typing, setTyping] = useState(null);
  const scene = SCENES[play.scene];

  useEffect(() => {
    const { script } = SCENES[play.scene];
    // Sem animação: conversa inteira, sem trocar de cena sozinho.
    const { run } = play;
    if (reducedMotion()) { setTyping(null); setProgress({ run, count: script.length }); return undefined; }
    let cancelled = false;
    let timer;
    const step = (i) => {
      if (cancelled) return;
      if (i >= script.length) {
        timer = setTimeout(() => setPlay((p) => (p.round + 1 < PLAYS_PER_SCENE
          ? { ...p, round: p.round + 1, run: p.run + 1 }
          : { scene: (p.scene + 1) % SCENES.length, round: 0, run: p.run + 1 })), PAUSE_END + leitura(script[script.length - 1].text));
        return;
      }
      setTyping(script[i].from);
      timer = setTimeout(() => {
        if (cancelled) return;
        setTyping(null);
        setProgress({ run, count: i + 1 });
        // a última mensagem lê junto com a pausa final
        timer = setTimeout(() => step(i + 1), i + 1 < script.length ? leitura(script[i].text) : 0);
      }, script[i].delay);
    };
    timer = setTimeout(() => step(0), 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [play.scene, play.run]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = scene.script.slice(0, progress.run === play.run ? progress.count : 0);
  const [badgeA, badgeB] = scene.badges;

  return (
    <div className="relative mx-auto w-[300px] sm:w-[330px]">
      {/* moldura do celular */}
      <div className="rounded-[2.4rem] bg-slate-900 p-2.5 shadow-2xl shadow-black/40 ring-1 ring-white/10">
        <div className="rounded-[2rem] overflow-hidden bg-[#efe7dd] h-[560px] flex flex-col">
          <div className="bg-[#075e54] text-white px-4 pt-7 pb-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brandGold text-brandNavy grid place-items-center font-bold">B</div>
            <div className="leading-tight">
              <p className="font-semibold text-sm">Barnabé · PastorIA</p>
              <p className="text-[11px] text-white/80">{typing === 'bot' ? 'digitando…' : 'online'}</p>
            </div>
          </div>

          {/* text-slate-800: o hero é text-white e as bolhas herdariam a cor */}
          <div key={play.run} className="flex-1 overflow-hidden px-3 py-3 space-y-2 text-[13px] leading-snug text-slate-800 flex flex-col justify-end">
            <p className="animate-bubble self-center bg-[#e1f2fb] text-slate-600 text-[11px] font-medium rounded-lg px-2.5 py-1 shadow-sm">{scene.chip}</p>
            {shown.map((m, i) => (
              <div key={i} className={`animate-bubble max-w-[85%] rounded-2xl px-3 py-2 whitespace-pre-line shadow-sm ${m.from === 'bot'
                ? `self-start bg-white rounded-tl-sm ${m.highlight ? 'ring-2 ring-brandGold' : ''}`
                : 'self-end bg-[#dcf8c6] rounded-tr-sm'}`}
              >
                <Bold text={m.text} />
                <span className="block text-[10px] text-slate-400 text-right mt-1">{horario(scene.hora, i)} ✓✓</span>
              </div>
            ))}
            {typing && (
              <div className={`animate-bubble rounded-2xl px-3 py-2.5 shadow-sm flex gap-1 ${typing === 'bot' ? 'self-start bg-white' : 'self-end bg-[#dcf8c6]'}`}>
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

      {/* selos flutuantes (mudam com a cena) */}
      <div key={`a-${play.scene}`} className="animate-bubble absolute -left-8 sm:-left-20 top-28">
        <div className="animate-float bg-white rounded-xl shadow-soft px-3 py-2 text-xs font-semibold text-brandNavy flex items-center gap-2 whitespace-nowrap">
          {badgeA.icon === 'pulse'
            ? <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500 text-emerald-500 pulse-ring" />
            : <span aria-hidden="true">{badgeA.icon}</span>}
          {badgeA.text}
        </div>
      </div>
      <div key={`b-${play.scene}`} className="animate-bubble absolute -right-8 sm:-right-16 bottom-14">
        <div className="animate-float-slow bg-white rounded-xl shadow-soft px-3 py-2 text-xs font-semibold text-brandNavy whitespace-nowrap">
          <span aria-hidden="true">{badgeB.icon}</span> {badgeB.text}
        </div>
      </div>

      {/* troca de contexto */}
      <div className="mt-5 -mx-4 flex flex-wrap justify-center gap-1" role="tablist" aria-label="Exemplos de conversa">
        {SCENES.map((s, i) => {
          const ativo = i === play.scene;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => setPlay((p) => ({ scene: i, round: 0, run: p.run + 1 }))}
              className={`px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition ${ativo
                ? 'bg-brandGold text-brandNavy shadow-sm'
                : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'}`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
