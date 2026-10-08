import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import PlanCards from '../components/PlanCards';

// Página pública de planos (comercial).
export default function Pricing() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [ciclo, setCiclo] = useState('mensal');
  useEffect(() => { api.get('/public/plans').then((r) => setPlans(r.data)).catch(() => {}); }, []);

  return (
    <div className="min-h-screen bg-ibbiCream">
      <header className="bg-ibbiNavy text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
          <Link to="/" className="text-ibbiGold text-sm font-semibold tracking-wider uppercase hover:underline">PastorIA · IA pastoral no WhatsApp</Link>
          <h1 className="font-display text-3xl sm:text-5xl mt-3">Quem falta, faz falta.</h1>
          <p className="text-white/75 mt-4 max-w-2xl mx-auto">
            Aniversários, chamada da EBD e cuidado com quem está se afastando — direto no WhatsApp da liderança,
            sem precisar abrir sistema. A IA faz o trabalho repetitivo; a liderança faz o pastoreio.
          </p>
          <div className="mt-6 inline-flex bg-white/10 rounded-lg p-1 text-sm">
            {['mensal', 'anual'].map((c) => (
              <button key={c} type="button" onClick={() => setCiclo(c)} className={`px-4 py-1.5 rounded-md ${ciclo === c ? 'bg-ibbiGold text-ibbiNavy font-semibold' : 'text-white/80'}`}>
                {c === 'mensal' ? 'Mensal' : 'Anual · 2 meses grátis'}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 -mt-6 pb-16">
        <PlanCards plans={plans} ciclo={ciclo} selectLabel="Começar grátis" onSelect={(p) => navigate(p.sobConsulta ? '/cadastro?plano=multiplicar' : `/cadastro?plano=${p.id}`)} />
        <div className="grid md:grid-cols-3 gap-4 mt-10 text-sm">
          {[
            ['🎂 Aniversário sem esquecer', 'Felicitação com cartão personalizado no WhatsApp e email, e aviso à liderança de quem fez aniversário.'],
            ['📋 Chamada pelo WhatsApp', 'No domingo o assistente manda a lista da turma; o líder responde "1, 3, 5" ou um áudio e pronto.'],
            ['💛 Cuidado com ausentes', 'Quem faltou recebe uma mensagem acolhedora com o tema da aula; após semanas seguidas, a liderança é alertada.'],
          ].map(([t, d]) => (
            <div key={t} className="bg-white rounded-xl border border-stone-100 p-5">
              <h3 className="font-semibold text-ibbiNavy">{t}</h3>
              <p className="text-slate-600 mt-1">{d}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-slate-500 mt-10">
          14 dias grátis, sem cartão. <Link to="/cadastro" className="text-ibbiBlue font-medium">Cadastrar minha igreja</Link> · Já é cliente? <Link to="/login" className="text-ibbiBlue font-medium">Entrar</Link>
        </p>
      </main>
    </div>
  );
}
