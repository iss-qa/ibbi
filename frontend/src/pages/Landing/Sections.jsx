import { useState } from 'react';
import { Link } from 'react-router-dom';
import Reveal from '../../components/landing/Reveal';
import Logo from '../../components/landing/Logo';

// ── A dor ──────────────────────────────────────────────────────────────
const PAINS = [
  { icon: '🪑', title: 'A cadeira vazia que ninguém notou', text: 'Alguém falta um domingo, depois outro. Quando a liderança percebe, já se passaram semanas e a distância virou silêncio.' },
  { icon: '📋', title: 'A lista que ficou na gaveta', text: 'A chamada é feita no papel, a planilha não é atualizada e a informação nunca chega a quem poderia agir.' },
  { icon: '⏳', title: 'Um pastor, centenas de vidas', text: 'Não há como acompanhar cada pessoa de memória. Sem ajuda, o cuidado fica restrito a quem já está perto.' },
];

export function Problem() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="text-center max-w-3xl mx-auto">
          <p className="text-brandGold text-sm font-semibold tracking-wider uppercase">O problema</p>
          <h2 className="font-display text-3xl sm:text-5xl text-brandNavy mt-3 leading-tight">
            Sua igreja não perde membros de uma vez.<br className="hidden sm:block" /> Perde <em className="text-brandBlue">um domingo de cada vez</em>.
          </h2>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-5 mt-12">
          {PAINS.map((p, i) => (
            <Reveal key={p.title} delay={i * 120} className="group bg-brandCream rounded-2xl p-6 border border-stone-100 hover:-translate-y-1 hover:shadow-soft transition">
              <span className="text-3xl">{p.icon}</span>
              <h3 className="font-semibold text-brandNavy text-lg mt-4">{p.title}</h3>
              <p className="text-slate-600 mt-2 leading-relaxed">{p.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Versículo ──────────────────────────────────────────────────────────
export function Verse() {
  return (
    <section className="relative overflow-hidden bg-brandNavy text-white py-20 sm:py-24">
      <div className="absolute inset-0 bg-grid opacity-40" aria-hidden="true" />
      <div className="animate-glow absolute top-0 right-0 w-[380px] h-[380px] rounded-full bg-brandGold/30 blur-3xl" aria-hidden="true" />
      <Reveal className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <span className="text-5xl text-brandGold font-display leading-none">“</span>
        <blockquote className="font-display text-2xl sm:text-4xl leading-snug mt-2">
          Qual de vós é o homem que, possuindo cem ovelhas e perdendo uma delas, não deixa no deserto as noventa e nove
          e não vai após a perdida <span className="text-brandGold">até que a encontre</span>?
        </blockquote>
        <p className="text-white/60 mt-6 tracking-wider uppercase text-sm">Lucas 15:4</p>
        <p className="mt-10 text-lg sm:text-xl text-white/85 max-w-2xl mx-auto">
          O PastorIA não substitui o pastor. Ele mostra onde está a centésima ovelha, para que ninguém vá atrás dela tarde demais.
        </p>
        <p className="mt-4 font-display text-2xl text-brandGold">A IA avisa. O pastor abraça.</p>
      </Reveal>
    </section>
  );
}

// ── Como funciona ──────────────────────────────────────────────────────
const STEPS = [
  { n: '01', title: 'Cadastre sua igreja', text: 'Leva dois minutos. Informe congregações, liderança e importe as pessoas por planilha ou pelo próprio WhatsApp.' },
  { n: '02', title: 'Conecte o WhatsApp', text: 'Leia um QR Code com o número da igreja ou use a API Oficial da Meta. Nada muda para os membros.' },
  { n: '03', title: 'Deixe o Barnabé trabalhar', text: 'O assistente faz a chamada no domingo, percebe ausências, escreve mensagens acolhedoras e avisa a liderança. Você decide; ele executa. Cada igreja pode dar outro nome bíblico ao seu assistente.' },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-brandCream py-20 sm:py-28 scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="text-center max-w-2xl mx-auto">
          <p className="text-brandGold text-sm font-semibold tracking-wider uppercase">Como funciona</p>
          <h2 className="font-display text-3xl sm:text-5xl text-brandNavy mt-3">Três passos. Nenhuma ovelha a menos.</h2>
        </Reveal>
        <div className="relative grid md:grid-cols-3 gap-6 mt-14">
          <div className="hidden md:block absolute top-9 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-brandGold/60 to-transparent" aria-hidden="true" />
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 150} className="relative bg-white rounded-2xl p-7 border border-stone-100 shadow-sm">
              <span className="absolute -top-5 left-7 w-11 h-11 rounded-full bg-brandNavy text-brandGold font-display font-bold grid place-items-center ring-4 ring-brandCream">{s.n}</span>
              <h3 className="font-semibold text-brandNavy text-xl mt-5">{s.title}</h3>
              <p className="text-slate-600 mt-2 leading-relaxed">{s.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Recursos ───────────────────────────────────────────────────────────
const FEATURES = [
  { icon: '💬', title: 'Assistente de IA no WhatsApp', text: 'Pergunte "quem faltou três domingos seguidos?" ou "quantos jovens temos em Periperi?" e receba a resposta na hora, sem abrir sistema.' },
  { icon: '📋', title: 'Chamada em segundos', text: 'No domingo o Barnabé envia a lista da turma. O líder responde "1, 3, 5" ou manda um áudio. Pronto: frequência registrada.' },
  { icon: '💛', title: 'Reengajamento de ausentes', text: 'Quem faltou recebe uma mensagem acolhedora com o tema da aula. Após semanas seguidas, a liderança é alertada com nome e histórico.' },
  { icon: '🎂', title: 'Aniversários que ninguém esquece', text: 'Cartão personalizado no WhatsApp e no email, e aviso diário à liderança de quem faz aniversário.' },
  { icon: '📊', title: 'Frequência e relatórios', text: 'EBD, encontros de grupos e cultos: por classe, pessoa ou congregação. Toda segunda, um relatório semanal escrito pela IA.' },
  { icon: '🎙️', title: 'Áudio e foto viram cadastro', text: 'Mande um áudio ou a foto de uma ficha de visitante e a IA transcreve, entende e cadastra.' },
  { icon: '🙏', title: 'Pedidos de oração', text: 'Os membros enviam pedidos pelo portal e a igreja recebe no WhatsApp da secretaria.' },
  { icon: '⛪', title: 'Congregações ilimitadas', text: 'Sede e todas as congregações em um só lugar, com liderança e relatórios por local. Uma cobrança só.' },
  { icon: '🔒', title: 'Seguro por padrão', text: 'Acesso por papel (master, admin, membro), credenciais criptografadas e dados isolados por igreja.' },
];

export function Features() {
  return (
    <section id="recursos" className="bg-white py-20 sm:py-28 scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="text-center max-w-2xl mx-auto">
          <p className="text-brandGold text-sm font-semibold tracking-wider uppercase">Recursos</p>
          <h2 className="font-display text-3xl sm:text-5xl text-brandNavy mt-3">Tudo pelo WhatsApp. Tudo com propósito.</h2>
          <p className="text-slate-600 mt-4">A liderança já vive no WhatsApp. O PastorIA leva a gestão e o cuidado para lá, em vez de trazer a igreja para uma tela.</p>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 100} className="group rounded-2xl border border-stone-100 p-6 hover:border-brandGold/50 hover:shadow-soft hover:-translate-y-1 transition bg-white">
              <span className="inline-grid place-items-center w-12 h-12 rounded-xl bg-brandCream text-2xl group-hover:scale-110 transition">{f.icon}</span>
              <h3 className="font-semibold text-brandNavy text-lg mt-4">{f.title}</h3>
              <p className="text-slate-600 mt-2 leading-relaxed text-[15px]">{f.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Chamada pelo WhatsApp (demo estática) ──────────────────────────────
export function AttendanceShowcase() {
  return (
    <section className="bg-brandCream py-20 sm:py-28 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
        <Reveal>
          <p className="text-brandGold text-sm font-semibold tracking-wider uppercase">Controle de frequência</p>
          <h2 className="font-display text-3xl sm:text-5xl text-brandNavy mt-3 leading-tight">Chamada feita antes do café da comunhão.</h2>
          <p className="text-slate-600 mt-5 text-lg leading-relaxed">
            Sem caderno, sem planilha, sem "depois eu lanço". O líder responde no WhatsApp e a presença já está no relatório,
            por classe, congregação e pessoa. E quem faltou entra automaticamente no radar do cuidado.
          </p>
          <ul className="mt-6 space-y-3 text-slate-700">
            {[
              'Convocação automática no horário da EBD ou do encontro',
              'Responda com números, nomes ou um áudio',
              'Presença bloqueada após 7 dias, para relatórios confiáveis',
              'Histórico individual: quem está esfriando aparece antes de sumir',
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-1 w-5 h-5 rounded-full bg-brandNavy text-brandGold grid place-items-center text-xs">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={150} className="relative">
          <div className="animate-float-slow bg-white rounded-2xl shadow-soft p-5 max-w-md mx-auto">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Relatório · Jovens · Sede</span>
              <span>Domingo, 11:42</span>
            </div>
            <div className="mt-4 space-y-2">
              {[
                ['Ana Paula', 'presente', 'bg-emerald-500'],
                ['Bruno', '3ª falta seguida', 'bg-red-500'],
                ['Carla', 'presente', 'bg-emerald-500'],
                ['Daniel', '1ª falta', 'bg-amber-400'],
                ['Eduarda', 'presente', 'bg-emerald-500'],
              ].map(([n, s, c]) => (
                <div key={n} className="flex items-center justify-between rounded-lg bg-brandCream px-3 py-2 text-sm">
                  <span className="font-medium text-brandNavy">{n}</span>
                  <span className="flex items-center gap-2 text-slate-600"><span className={`w-2 h-2 rounded-full ${c}`} />{s}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-brandGold/40 bg-brandGold/10 p-3 text-sm text-brandNavy">
              <strong>Barnabé:</strong> Bruno faltou 3 domingos seguidos. Mensagem de cuidado enviada e liderança avisada. 💛
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── Origem ─────────────────────────────────────────────────────────────
export function Origin() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <Reveal className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <p className="text-brandGold text-sm font-semibold tracking-wider uppercase">Nossa história</p>
        <h2 className="font-display text-3xl sm:text-4xl text-brandNavy mt-3">Nascido dentro de uma igreja, não de um escritório.</h2>
        <p className="text-slate-600 mt-5 text-lg leading-relaxed">
          O PastorIA começou como a ferramenta interna da Igreja Batista Bíblica Israel, em Salvador, para resolver um problema
          concreto: cuidar de quem estava sumindo entre a sede e as congregações. Deu tão certo que decidimos abrir para
          qualquer igreja que sinta a mesma dor.
        </p>
      </Reveal>
    </section>
  );
}

// ── FAQ ────────────────────────────────────────────────────────────────
const FAQ = [
  ['A IA fala com os membros sem a liderança saber?', 'Não. Toda mensagem a um membro passa por aprovação da liderança, a menos que você ative o envio automático nas configurações. O Barnabé propõe; o pastor decide.'],
  ['Preciso do WhatsApp Oficial (API da Meta)?', 'Não. Você pode conectar o número da igreja por QR Code em minutos. A API Oficial está disponível no plano Multiplicar para quem precisa de alto volume.'],
  ['Funciona com várias congregações?', 'Sim, e sem custo extra. Uma igreja com dez congregações continua sendo uma única assinatura, com liderança e relatórios por local.'],
  ['Como importo as pessoas que já tenho?', 'Por planilha (CSV), pelo formulário de convite que os membros preenchem sozinhos, ou mandando um áudio ou foto de ficha para o Barnabé.'],
  ['O que acontece quando o teste grátis termina?', 'Você escolhe um plano e segue de onde parou. Se não escolher, o acesso fica pausado, mas seus dados continuam guardados.'],
  ['Meus dados estão seguros?', 'Cada igreja fica isolada no banco de dados, as credenciais do WhatsApp são criptografadas e o acesso é controlado por papel. Você pode exportar tudo a qualquer momento.'],
];

export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="bg-brandCream py-20 sm:py-28 scroll-mt-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <Reveal className="text-center">
          <p className="text-brandGold text-sm font-semibold tracking-wider uppercase">Dúvidas frequentes</p>
          <h2 className="font-display text-3xl sm:text-5xl text-brandNavy mt-3">Antes de começar</h2>
        </Reveal>
        <div className="mt-10 space-y-3">
          {FAQ.map(([q, a], i) => (
            <Reveal key={q} delay={i * 60} className="bg-white rounded-xl border border-stone-100 overflow-hidden">
              <button type="button" onClick={() => setOpen(open === i ? -1 : i)} className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 font-semibold text-brandNavy" aria-expanded={open === i}>
                {q}
                <span className={`shrink-0 w-7 h-7 rounded-full bg-brandCream grid place-items-center text-brandNavy transition-transform ${open === i ? 'rotate-45' : ''}`}>+</span>
              </button>
              <div className={`grid transition-[grid-template-rows] duration-300 ${open === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-slate-600 leading-relaxed">{a}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA final ──────────────────────────────────────────────────────────
export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-brandNavy text-white py-24 sm:py-32">
      <div className="absolute inset-0 bg-grid opacity-40" aria-hidden="true" />
      <div className="animate-glow absolute -bottom-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-brandGold/30 blur-3xl" aria-hidden="true" />
      <Reveal className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="font-display text-4xl sm:text-6xl leading-tight">Nenhuma ovelha<br />a menos.</h2>
        <p className="text-white/75 mt-6 text-lg">
          Comece hoje. Em 14 dias você vai saber exatamente quem está se afastando e já terá começado a trazê-los de volta.
        </p>
        <Link to="/cadastro" className="inline-flex items-center gap-2 mt-8 bg-brandGold text-brandNavy font-bold px-8 py-4 rounded-full shadow-lg shadow-brandGold/25 hover:brightness-95 hover:-translate-y-0.5 transition text-lg">
          Cadastrar minha igreja
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" /></svg>
        </Link>
        <p className="text-white/50 text-sm mt-4">14 dias grátis · sem cartão · sem fidelidade</p>
      </Reveal>
    </section>
  );
}

// ── Rodapé ─────────────────────────────────────────────────────────────
export function Footer() {
  return (
    <footer className="bg-[#071634] text-white/70 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-3 gap-8 items-start">
        <div>
          <Logo light />
          <p className="mt-3 text-sm font-display text-brandGold text-lg">Quem falta, faz falta.</p>
          <p className="mt-2 text-xs text-white/50 max-w-xs">Gestão de pessoas e cuidado pastoral com IA, pelo WhatsApp, para igrejas de qualquer tamanho.</p>
        </div>
        <nav className="text-sm space-y-2">
          <p className="font-semibold text-white">Produto</p>
          <a href="#como-funciona" className="block hover:text-white">Como funciona</a>
          <a href="#recursos" className="block hover:text-white">Recursos</a>
          <Link to="/planos" className="block hover:text-white">Planos</Link>
          <a href="#faq" className="block hover:text-white">Dúvidas</a>
        </nav>
        <nav className="text-sm space-y-2">
          <p className="font-semibold text-white">Acesso</p>
          <Link to="/cadastro" className="block hover:text-white">Cadastrar igreja</Link>
          <Link to="/login" className="block hover:text-white">Entrar</Link>
          <Link to="/platform/login" className="block hover:text-white text-white/40">Plataforma</Link>
        </nav>
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-10 pt-6 border-t border-white/10 text-xs text-white/40 flex flex-col sm:flex-row justify-between gap-2">
        <span>© {new Date().getFullYear()} PastorIA. Todos os direitos reservados.</span>
        <span>“Apascenta as minhas ovelhas.” — João 21:17</span>
      </div>
    </footer>
  );
}
