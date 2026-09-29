import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import PlanCards from '../../components/PlanCards';
import Reveal from '../../components/landing/Reveal';

const CONTACT_WHATSAPP = import.meta.env.VITE_CONTACT_WHATSAPP || '';

export default function Plans() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [ciclo, setCiclo] = useState('mensal');

  useEffect(() => { api.get('/public/plans').then((r) => setPlans(r.data)).catch(() => {}); }, []);

  const onSelect = (p) => {
    if (p.sobConsulta) {
      if (CONTACT_WHATSAPP) window.open(`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent('Olá! Quero saber mais sobre o plano Rede do PastorIA.')}`, '_blank', 'noopener');
      else navigate('/cadastro?plano=multiplicar');
      return;
    }
    navigate(`/cadastro?plano=${p.id}`);
  };

  return (
    <section id="planos" className="bg-brandCream py-20 sm:py-28 scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Reveal className="text-center max-w-2xl mx-auto">
          <p className="text-brandGold text-sm font-semibold tracking-wider uppercase">Planos</p>
          <h2 className="font-display text-3xl sm:text-5xl text-brandNavy mt-3">Menos que um almoço da liderança por mês.</h2>
          <p className="text-slate-600 mt-4">
            Uma igreja, todas as congregações, uma única cobrança. Comece com 14 dias grátis no plano Crescer, sem cartão.
          </p>
          <div className="mt-6 inline-flex bg-white rounded-full p-1 text-sm shadow-sm border border-stone-200">
            {['mensal', 'anual'].map((c) => (
              <button key={c} type="button" onClick={() => setCiclo(c)} className={`px-5 py-2 rounded-full transition ${ciclo === c ? 'bg-brandNavy text-white font-semibold' : 'text-slate-600'}`}>
                {c === 'mensal' ? 'Mensal' : 'Anual · 2 meses grátis'}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={120} className="mt-12">
          {plans.length
            ? <PlanCards plans={plans} ciclo={ciclo} onSelect={onSelect} selectLabel="Começar grátis" />
            : <p className="text-center text-sm text-slate-400">Carregando planos…</p>}
        </Reveal>

        <Reveal delay={200} className="mt-8 text-center text-sm text-slate-500">
          Todos os planos incluem aniversários automáticos, EBD com chamada e congregações ilimitadas. Valores em reais, impostos inclusos.
        </Reveal>
      </div>
    </section>
  );
}
