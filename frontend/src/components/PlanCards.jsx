import { brl } from './ui';

const FEATURE_LABELS = {
  aniversariosAutomaticos: 'Aniversários automáticos (WhatsApp + email + cartão)',
  notificacaoLideranca: 'Aviso diário à liderança',
  ebd: 'EBD com chamada e relatórios',
  agenteWhatsApp: 'Assistente de IA no WhatsApp da liderança',
  reengajamento: 'Motor de reengajamento de ausentes',
  relatorioSemanalIA: 'Relatório semanal gerado por IA',
  multimodal: 'IA lê áudios e fotos de fichas',
  whatsappOficial: 'WhatsApp Oficial (Cloud API da Meta)',
};

const limite = (v, sufixo) => (v === null || v === undefined ? `${sufixo} ilimitadas` : `${v.toLocaleString('pt-BR')} ${sufixo}`);

// Cards de planos: usados na página pública (/planos) e em Assinatura.
export default function PlanCards({ plans, ciclo = 'mensal', current, onSelect, selectLabel = 'Escolher' }) {
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {plans.map((p) => {
        const preco = ciclo === 'anual' ? p.precoAnual / 12 : p.precoMensal;
        const atual = current === p.id;
        return (
          <div key={p.id} className={`bg-white rounded-2xl border p-5 flex flex-col ${p.destaque ? 'border-ibbiGold ring-2 ring-ibbiGold/40' : 'border-stone-100'}`}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl text-ibbiNavy">{p.nome}</h3>
              {p.destaque && <span className="text-[10px] font-bold uppercase tracking-wider bg-ibbiGold text-ibbiNavy px-2 py-0.5 rounded-full">Mais escolhido</span>}
            </div>
            <p className="text-xs text-slate-500 mt-1 min-h-[32px]">{p.descricao}</p>
            <div className="mt-4 mb-4">
              {p.sobConsulta ? (
                <p className="text-2xl font-semibold text-ibbiNavy">Sob consulta</p>
              ) : (
                <>
                  <p className="text-3xl font-semibold text-ibbiNavy tabular-nums">{brl(preco)}<span className="text-sm text-slate-400 font-normal">/mês</span></p>
                  {ciclo === 'anual' && <p className="text-xs text-emerald-700">{brl(p.precoAnual)} por ano · 2 meses grátis</p>}
                </>
              )}
            </div>
            <ul className="text-sm space-y-1.5 mb-5 flex-1">
              <li className="text-slate-700">👥 {limite(p.limites.pessoas, 'pessoas').replace('pessoas ilimitadas', 'Pessoas ilimitadas')}</li>
              <li className="text-slate-700">⛪ Congregações ilimitadas</li>
              <li className="text-slate-700">💬 {limite(p.limites.whatsappMensagensMes, 'mensagens/mês')}</li>
              <li className="text-slate-700">✨ {p.limites.iaInteracoesMes === 0 ? 'Sem assistente de IA' : limite(p.limites.iaInteracoesMes, 'interações de IA/mês')}</li>
              {Object.entries(FEATURE_LABELS).map(([k, label]) => (
                <li key={k} className={p.features[k] ? 'text-slate-700' : 'text-slate-300 line-through'}>
                  <span aria-hidden="true">{p.features[k] ? '✓ ' : '– '}</span>{label}
                </li>
              ))}
            </ul>
            {onSelect && (
              <button
                type="button"
                disabled={atual}
                onClick={() => onSelect(p)}
                className={`w-full py-2 rounded-lg text-sm font-semibold transition ${atual ? 'bg-slate-100 text-slate-400' : p.destaque ? 'bg-ibbiGold text-ibbiNavy hover:brightness-95' : 'bg-ibbiBlue text-white hover:bg-ibbiNavy'}`}
              >
                {atual ? 'Plano atual' : p.sobConsulta ? 'Falar com a equipe' : selectLabel}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
