import { brl } from './ui';

const FEATURE_LABELS = {
  aniversariosAutomaticos: 'Aniversários automáticos (WhatsApp + email + cartão)',
  notificacaoLideranca: 'Aviso diário à liderança',
  ebd: 'EBD com chamada e relatórios',
  checkinCulto: 'Presença no culto por QR Code',
  escalas: 'Escala de voluntários com confirmação no WhatsApp',
  agenteWhatsApp: 'Assistente de IA no WhatsApp da liderança',
  reengajamento: 'Motor de reengajamento de ausentes',
  jornadaVisitante: 'Jornada de 30 dias do visitante e do novo convertido',
  relatorioSemanalIA: 'Relatório semanal da liderança',
  multimodal: 'IA lê áudios e fotos de fichas',
  whatsappOficial: 'WhatsApp Oficial (Cloud API da Meta)',
};
const ICONE = { semente: '🌱', crescer: '🌿', multiplicar: '🌳', rede: '🌐' };

const numero = (v) => (v === null || v === undefined ? 'Sob medida' : v.toLocaleString('pt-BR'));
const faixaDe = (p) => p.faixa || (p.limites.pessoas ? `Até ${p.limites.pessoas.toLocaleString('pt-BR')} pessoas` : 'Pessoas ilimitadas');

// Cards de planos: usados na página pública (/planos), na landing, na plataforma e em Assinatura.
// Cada plano mostra só o que acrescenta ao anterior ("Tudo do Semente, mais:").
export default function PlanCards({ plans, ciclo = 'mensal', current, onSelect, selectLabel = 'Escolher' }) {
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
      {plans.map((p, i) => {
        const preco = ciclo === 'anual' ? p.precoAnual / 12 : p.precoMensal;
        const atual = current === p.id;
        const anterior = plans[i - 1];
        const novos = Object.keys(FEATURE_LABELS).filter((k) => p.features?.[k] && !(anterior?.features?.[k]));
        const destaque = p.destaque && !atual;
        return (
          <div
            key={p.id}
            className={`relative bg-white rounded-2xl border p-5 flex flex-col transition ${
              atual ? 'border-ibbiBlue ring-2 ring-ibbiBlue/30'
                : destaque ? 'border-ibbiGold ring-2 ring-ibbiGold/40 shadow-lg xl:-translate-y-1'
                  : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            {(atual || p.destaque) && (
              <span className={`absolute -top-3 left-5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${atual ? 'bg-ibbiBlue text-white' : 'bg-ibbiGold text-ibbiNavy'}`}>
                {atual ? 'Seu plano' : 'Mais escolhido'}
              </span>
            )}

            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xl" aria-hidden="true">{ICONE[p.id] || '⛪'}</span>
              <div className="min-w-0">
                <h3 className="font-display text-xl leading-tight text-ibbiNavy">{p.nome}</h3>
                <p className="text-xs font-semibold text-ibbiBlue">{faixaDe(p)}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3 min-h-[2.5rem]">{p.descricao}</p>

            <div className="my-4">
              {p.sobConsulta ? (
                <>
                  <p className="text-2xl font-semibold text-ibbiNavy">Sob consulta</p>
                  <p className="text-xs text-slate-400">Proposta conforme o tamanho da rede</p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-semibold text-ibbiNavy tabular-nums">{brl(preco)}<span className="text-sm text-slate-400 font-normal">/mês</span></p>
                  <p className="text-xs text-slate-400">{ciclo === 'anual' ? <span className="text-emerald-700">{brl(p.precoAnual)} por ano · 2 meses grátis</span> : 'Cobrança mensal'}</p>
                </>
              )}
            </div>

            {p.limites.pessoas == null && p.limites.whatsappMensagensMes == null ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-center text-sm font-semibold text-ibbiNavy mb-4">Limites sob medida</p>
            ) : (
              <dl className="grid grid-cols-3 gap-1.5 text-center mb-4">
                {[
                  ['pessoas', numero(p.limites.pessoas)],
                  ['msgs/mês', numero(p.limites.whatsappMensagensMes)],
                  ['IA/mês', p.limites.iaInteracoesMes === 0 ? '—' : numero(p.limites.iaInteracoesMes)],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo} className="rounded-lg bg-slate-50 px-1 py-2 min-w-0">
                    <dd className="text-sm font-semibold text-ibbiNavy tabular-nums leading-tight">{valor}</dd>
                    <dt className="text-[10px] text-slate-500 mt-0.5 truncate">{rotulo}</dt>
                  </div>
                ))}
              </dl>
            )}

            <p className="text-xs font-semibold text-slate-600 mb-2">{anterior ? `Tudo do ${anterior.nome}, mais:` : 'Inclui:'}</p>
            <ul className="text-sm space-y-1.5 mb-5 flex-1">
              {i === 0 && <li className="flex gap-2 text-slate-700"><span className="text-emerald-600" aria-hidden="true">✓</span>Congregações ilimitadas</li>}
              {[...novos.map((k) => FEATURE_LABELS[k]), ...(p.extras || [])].map((label) => (
                <li key={label} className="flex gap-2 text-slate-700"><span className="text-emerald-600" aria-hidden="true">✓</span>{label}</li>
              ))}
              {!novos.length && !p.extras?.length && i > 0 && <li className="text-slate-400 text-xs">Limites maiores de pessoas, mensagens e IA.</li>}
            </ul>

            {onSelect && (
              <button
                type="button"
                disabled={atual}
                onClick={() => onSelect(p)}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition ${atual ? 'bg-slate-100 text-slate-400 cursor-default' : destaque ? 'bg-ibbiGold text-ibbiNavy hover:brightness-95' : 'bg-ibbiBlue text-white hover:bg-ibbiNavy'}`}
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
