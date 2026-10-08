import { Link } from 'react-router-dom';
import ChatDemo from './ChatDemo';

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-brandNavy text-white">
      <div className="absolute inset-0 bg-grid opacity-60" aria-hidden="true" />
      <div className="animate-glow absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-brandBlue blur-3xl" aria-hidden="true" />
      <div className="animate-glow absolute -bottom-40 -right-24 w-[420px] h-[420px] rounded-full bg-brandGold/40 blur-3xl" style={{ animationDelay: '-5s' }} aria-hidden="true" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-28 pb-16 sm:pt-36 sm:pb-24 grid lg:grid-cols-2 gap-14 items-center">
        <div>
          <p className="reveal is-visible inline-flex items-center gap-2 text-xs sm:text-sm font-semibold tracking-wider uppercase text-brandGold bg-white/5 border border-brandGold/30 rounded-full px-3.5 py-1.5">
            <span className="relative inline-flex w-2 h-2 rounded-full bg-brandGold text-brandGold pulse-ring" />
            IA pastoral no WhatsApp da sua igreja
          </p>

          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl leading-[1.02] mt-6">
            Quem falta,<br />
            <span className="text-shimmer">faz falta.</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/80 mt-6 max-w-xl leading-relaxed">
            O <strong className="text-white">PastorIA</strong> percebe quem está se afastando, avisa a liderança e ajuda a trazer cada pessoa de volta.
            Tudo pelo WhatsApp: sem planilha, sem sistema complicado, sem ninguém esquecido.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link to="/cadastro" className="group inline-flex items-center justify-center gap-2 bg-brandGold text-brandNavy font-bold px-7 py-3.5 rounded-full shadow-lg shadow-brandGold/25 hover:brightness-95 hover:-translate-y-0.5 transition">
              Começar 14 dias grátis
              <svg className="w-4 h-4 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
            <a href="#como-funciona" className="inline-flex items-center justify-center gap-2 border border-white/25 text-white font-semibold px-7 py-3.5 rounded-full hover:bg-white/10 transition">
              Ver como funciona
            </a>
          </div>

          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/60">
            {['Sem cartão de crédito', 'Pronto em minutos', 'Cancele quando quiser'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex justify-center lg:justify-end">
          <ChatDemo />
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xs sm:text-sm text-white/55">
          <span>Nascido dentro de uma igreja real</span>
          <span className="hidden sm:inline">•</span>
          <span>Congregações ilimitadas</span>
          <span className="hidden sm:inline">•</span>
          <span>WhatsApp comum ou API Oficial</span>
          <span className="hidden sm:inline">•</span>
          <span>Credenciais criptografadas</span>
        </div>
      </div>
    </section>
  );
}
