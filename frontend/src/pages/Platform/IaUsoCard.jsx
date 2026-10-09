import { useCallback, useEffect, useState } from 'react';
import platformApi from '../../services/platformApi';
import { Card, Toggle } from '../../components/ui';

const REFRESH_MS = 15000;
const OPERACAO = { agente: 'Agente (WhatsApp/web)', texto: 'Texto (mensagens, resumos)', transcricao: 'Transcrição de áudio' };
const n = (v) => Number(v || 0).toLocaleString('pt-BR');
const usd = (v, d = 4) => `US$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const brl = (v, d = 2) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: d, maximumFractionDigits: d });
const hora = (d) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const periodoAtual = () => new Date().toISOString().slice(0, 7);

const precoTxt = (p) => (p
  ? `US$ ${p.input} entrada · ${p.cached} cache · ${p.output} saída${p.cacheWrite ? ` · ${p.cacheWrite} escrita de cache` : ''} (por 1M tokens)`
  : 'sem preço cadastrado — custo não calculado');

// Consumo de IA por chamada: provedor, modelo servido (com versão), tokens e custo, ao vivo.
// Sem tenantId: todas as igrejas.
export default function IaUsoCard({ tenantId }) {
  const [periodo, setPeriodo] = useState(periodoAtual);
  const [aoVivo, setAoVivo] = useState(true);
  const [d, setD] = useState(null);
  const [erro, setErro] = useState(null);

  const load = useCallback(() => platformApi.get('/ia-uso', { params: { periodo, ...(tenantId ? { tenantId } : {}) } })
    .then((r) => { setD(r.data); setErro(null); })
    .catch((err) => setErro(err?.response?.data?.message || 'Falha ao carregar o consumo de IA')), [periodo, tenantId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!aoVivo || periodo !== periodoAtual()) return undefined;
    const id = setInterval(() => { if (document.visibilityState === 'visible') load(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [aoVivo, periodo, load]);

  const t = d?.totais || {};
  return (
    <Card
      title="Consumo de IA (por chamada)"
      subtitle="Custo gravado em cada chamada com o preço do modelo que respondeu e a cotação do dólar do momento"
      action={(
        <div className="flex flex-wrap items-center gap-3">
          <input type="month" className="border border-slate-200 rounded-lg px-2 py-1 text-sm" value={periodo} max={periodoAtual()} onChange={(e) => e.target.value && setPeriodo(e.target.value)} aria-label="Mês" />
          <Toggle checked={aoVivo} onChange={setAoVivo} label={<span className="inline-flex items-center gap-1.5">{aoVivo && periodo === periodoAtual() && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />}Ao vivo</span>} />
        </div>
      )}
    >
      {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}
      {!d ? <p className="text-sm text-slate-400">Carregando…</p> : (
        <div className="space-y-5 min-w-0">
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm">
            {d.ativo ? (
              <>
                <p className="text-slate-800"><span className="text-slate-500">IA em uso agora:</span> <strong>{d.ativo.providerNome}</strong> · <code className="text-ibbiNavy">{d.ativo.modelo}</code></p>
                <p className="text-xs text-slate-500 mt-0.5 break-words">{precoTxt(d.ativo.preco)}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Transcrição de áudio: {d.ativo.transcricao?.viaGemini ? <>no próprio Gemini (<code>{d.ativo.transcricao.modelo}</code>), cobrada por tokens</> : d.ativo.transcricao?.modelo ? <><code>{d.ativo.transcricao.modelo}</code>{d.ativo.transcricao.usdMin ? ` · US$ ${d.ativo.transcricao.usdMin}/min` : ''}</> : 'não configurada'}
                </p>
              </>
            ) : <p className="text-slate-500">Nenhum provedor de IA configurado no servidor.</p>}
            <p className="text-xs text-slate-500 mt-1">
              Cotação: US$ 1 = {brl(d.cotacao?.valor, 4)} ({d.cotacao?.fonte === 'awesomeapi' ? 'comercial, AwesomeAPI' : 'USD_BRL do servidor'}{d.cotacao?.atualizadoEm ? `, ${hora(d.cotacao.atualizadoEm)}` : ''})
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 text-center">
            {[
              ['Custo no mês', brl(t.brl), usd(t.usd)],
              ['Chamadas', n(t.chamadas), `${n(t.interacoes)} ${t.interacoes === 1 ? 'interação' : 'interações'}`],
              ['Custo por chamada', brl(t.chamadas ? t.brl / t.chamadas : 0, 4), ''],
              ['Tokens de entrada', n(t.input), `${t.cachePct || 0}% do cache`],
              ['Tokens de saída', n(t.output), t.thinking ? `${n(t.thinking)} pensando` : ''],
            ].map(([label, v, sub]) => (
              <div key={label} className="rounded-lg bg-white border border-slate-100 p-2 min-w-0">
                <p className="text-base font-semibold text-ibbiNavy tabular-nums truncate">{v}</p>
                <p className="text-[11px] text-slate-500">{label}</p>
                {sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}
              </div>
            ))}
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">Por modelo</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap [&_td+td]:pl-3 [&_th+th]:pl-3">
                <thead><tr className="text-left text-slate-500"><th className="py-1">Provedor</th><th>Modelo (versão)</th><th className="text-right">Chamadas</th><th className="text-right">Entrada</th><th className="text-right">Cache</th><th className="text-right">Escrita cache</th><th className="text-right">Saída</th><th className="text-right">Áudio</th><th className="text-right">US$</th><th className="text-right">R$</th></tr></thead>
                <tbody className="tabular-nums">
                  {d.porModelo.map((m) => (
                    <tr key={`${m.provider}-${m.modelo}`} className="border-t border-slate-100" title={precoTxt(m.preco)}>
                      <td className="py-1">{m.providerNome}</td><td><code>{m.modelo}</code></td>
                      <td className="text-right">{n(m.chamadas)}</td><td className="text-right">{n(m.input)}</td>
                      <td className="text-right">{m.cachePct}%</td><td className="text-right">{n(m.cacheWrite)}</td>
                      <td className="text-right">{n(m.output)}</td><td className="text-right">{m.audioMin ? `${n(m.audioMin)} min` : '—'}</td>
                      <td className="text-right">{usd(m.usd)}</td><td className="text-right font-medium">{brl(m.brl)}</td>
                    </tr>
                  ))}
                  {!d.porModelo.length && <tr><td colSpan={10} className="text-slate-400 py-2">Nenhuma chamada de IA registrada neste mês.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {d.porOperacao.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {d.porOperacao.map((o) => (
                <span key={o.operacao} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                  {OPERACAO[o.operacao] || o.operacao}: <strong>{n(o.chamadas)}</strong> · {brl(o.brl)}
                </span>
              ))}
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">Últimas chamadas</p>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-xs whitespace-nowrap [&_td+td]:pl-3 [&_th+th]:pl-3">
                <thead className="sticky top-0 bg-white"><tr className="text-left text-slate-500"><th className="py-1">Quando</th>{!tenantId && <th>Igreja</th>}<th>Operação</th><th>Modelo</th><th className="text-right">Entrada</th><th className="text-right">Cache</th><th className="text-right">Saída</th><th className="text-right">R$</th><th className="text-right">Tempo</th></tr></thead>
                <tbody className="tabular-nums">
                  {d.ultimas.map((e) => (
                    <tr key={e._id} className="border-t border-slate-100" title={`US$ ${e.usd} · cotação ${e.usdBrl}`}>
                      <td className="py-1">{hora(e.at)}</td>{!tenantId && <td className="max-w-[10rem] truncate">{e.igreja}</td>}
                      <td>{OPERACAO[e.operacao]?.split(' ')[0] || e.operacao}</td><td><code>{e.modelo}</code></td>
                      <td className="text-right">{e.audioSeg ? `${e.audioSeg}s áudio` : n(e.input)}</td>
                      <td className="text-right">{n(e.cached)}</td><td className="text-right">{n(e.output)}</td>
                      <td className="text-right">{brl(e.brl, 4)}</td><td className="text-right">{e.ms ? `${(e.ms / 1000).toFixed(1)}s` : '—'}</td>
                    </tr>
                  ))}
                  {!d.ultimas.length && <tr><td colSpan={9} className="text-slate-400 py-2">—</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
