import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { useTenant } from '../context/TenantContext';

// Lembrete para o master enquanto a igreja não termina os primeiros passos
// (ou quando há nova versão dos termos para aceitar — o backend informa `termosPendentes`).

export default function OnboardingBanner() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  if (user?.role !== 'master' || !tenant) return null;
  const termosPendentes = Boolean(tenant.termosPendentes);
  const pendente = !tenant.onboarding?.concluido && !tenant.onboarding?.dispensado;
  if (!termosPendentes && !pendente) return null;
  return (
    <div className="mb-5 rounded-2xl border border-ibbiGold/40 bg-gradient-to-r from-ibbiNavy to-ibbiBlue text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div>
        <p className="font-display text-lg">{termosPendentes ? 'Atualizamos os Termos e a Política de Privacidade' : 'Vamos deixar a igreja pronta? 🌱'}</p>
        <p className="text-sm text-white/80">{termosPendentes ? 'Leia e aceite a nova versão para continuar usando todos os recursos.' : 'Conecte o WhatsApp, traga as pessoas e ligue as automações: o checklist mostra o que falta.'}</p>
      </div>
      <Link to="/primeiros-passos" className="shrink-0 text-center px-4 py-2 rounded-full bg-ibbiGold text-ibbiNavy font-semibold text-sm hover:brightness-95">
        {termosPendentes ? 'Ler e aceitar' : 'Ver primeiros passos'}
      </Link>
    </div>
  );
}
