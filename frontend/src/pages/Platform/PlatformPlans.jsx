import { useEffect, useState } from 'react';
import platformApi from '../../services/platformApi';
import PlanCards from '../../components/PlanCards';

export default function PlatformPlans() {
  const [plans, setPlans] = useState([]);
  const [ciclo, setCiclo] = useState('mensal');
  useEffect(() => { platformApi.get('/plans').then((r) => setPlans(r.data)).catch(() => {}); }, []);
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-ibbiNavy">Planos</h1>
          <p className="text-sm text-slate-500">Catálogo definido em backend/src/config/plans.js · página pública em /planos</p>
        </div>
        <select className="border rounded-lg px-3 py-2 text-sm" value={ciclo} onChange={(e) => setCiclo(e.target.value)} aria-label="Ciclo">
          <option value="mensal">Mensal</option><option value="anual">Anual</option>
        </select>
      </header>
      <PlanCards plans={plans} ciclo={ciclo} />
    </div>
  );
}
