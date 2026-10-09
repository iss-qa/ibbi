import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import api from '../services/api';
import { Button } from '../components/ui';
import { useTenant } from '../context/TenantContext';

// Primeiros passos da igreja: cada etapa é conferida pelo estado real (WhatsApp conectado,
// pessoas cadastradas…); as de revisão o master confirma. Quando as obrigatórias ficam prontas, conclui.
export default function Onboarding() {
  const { refresh } = useTenant();
  const [st, setSt] = useState(null);
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const load = useCallback(async () => {
    setCarregando(true);
    try { setSt((await api.get('/tenant/onboarding')).data); } finally { setCarregando(false); }
  }, []);
  useEffect(() => { load().catch((e) => setErro(e.response?.data?.message || 'Falha ao carregar')); }, [load]);

  const acao = async (fn) => {
    setErro('');
    try { setSt((await fn()).data); refresh(); } catch (e) { setErro(e.response?.data?.message || 'Não foi possível salvar'); }
  };

  if (!st) return <div><Header title="Primeiros passos" /><p className="text-sm text-slate-500">{erro || 'Carregando…'}</p></div>;
  const pct = Math.round((st.feitas / st.total) * 100);

  return (
    <div>
      <Header
        title="Primeiros passos"
        subtitle="Deixe a igreja pronta para cuidar de cada pessoa. Leva uns 20 minutos."
        action={<Button variant="outline" onClick={load} disabled={carregando}>{carregando ? 'Conferindo…' : '↻ Conferir de novo'}</Button>}
      />

      <div className="bg-white rounded-2xl border border-stone-100 p-5 mb-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-ibbiNavy">{st.feitas} de {st.total} etapas</span>
          <span className="text-slate-500">{st.concluido ? '🎉 Igreja pronta!' : st.pronto ? 'Etapas obrigatórias prontas' : 'Faltam etapas obrigatórias'}</span>
        </div>
        <div className="mt-2 h-3 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-gradient-to-r from-ibbiGold to-amber-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {erro && <p className="mb-4 text-sm bg-red-50 border border-red-100 text-red-700 rounded-lg px-3 py-2">{erro}</p>}

      <ol className="space-y-3">
        {st.etapas.map((e, i) => (
          <li key={e.id} className={`bg-white rounded-2xl border p-4 sm:p-5 flex gap-4 ${e.feito ? 'border-emerald-100' : 'border-stone-100'}`}>
            <span className={`shrink-0 w-9 h-9 rounded-full grid place-items-center font-bold ${e.feito ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{e.feito ? '✓' : i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold ${e.feito ? 'text-slate-500' : 'text-ibbiNavy'}`}>
                {e.titulo}{!e.obrigatoria && <span className="ml-2 text-xs font-normal text-slate-400">opcional</span>}
              </p>
              <p className="text-sm text-slate-600 mt-0.5">{e.descricao}{e.detalhe ? ` (${e.detalhe})` : ''}</p>

              {e.acao === 'termos' && !e.feito && (
                <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm">
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={aceite} onChange={(ev) => setAceite(ev.target.checked)} className="mt-1" />
                    <span>Li e aceito os <Link to="/termos" target="_blank" className="text-ibbiBlue underline">Termos de Uso</Link> e a <Link to="/privacidade" target="_blank" className="text-ibbiBlue underline">Política de Privacidade</Link> (versão {st.termosVersao}), em nome da igreja.</span>
                  </label>
                  <Button variant="gold" className="mt-2" disabled={!aceite} onClick={() => acao(() => api.post('/tenant/termos/aceitar', { aceito: true }))}>Aceitar</Button>
                </div>
              )}

              {!e.feito && e.acao !== 'termos' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {e.link && <Link to={e.link} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-ibbiBlue text-white hover:bg-ibbiNavy">Fazer agora →</Link>}
                  {e.confirmavel && <Button variant="outline" onClick={() => acao(() => api.post('/tenant/onboarding/confirmar', { etapa: e.id }))}>Já revisei ✓</Button>}
                  {e.id === 'teste' && <span className="text-xs text-slate-500 self-center">Depois de enviar "menu", clique em "Conferir de novo".</span>}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      {!st.concluido && (
        <p className="mt-6 text-center text-sm text-slate-500">
          {st.dispensado
            ? <>Lembretes ocultos. <button type="button" className="text-ibbiBlue underline" onClick={() => acao(() => api.post('/tenant/onboarding/dispensar', { dispensar: false }))}>Mostrar de novo no painel</button></>
            : <button type="button" className="hover:text-ibbiNavy underline" onClick={() => acao(() => api.post('/tenant/onboarding/dispensar', { dispensar: true }))}>Ocultar os lembretes por enquanto</button>}
        </p>
      )}
    </div>
  );
}
