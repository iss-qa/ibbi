import { useEffect, useState } from 'react';
import api from '../services/api';

// "Indique e ganhe": cada igreja indicada que assinar vale 1 mês grátis para quem indicou.
export default function IndiqueGanhe() {
  const [d, setD] = useState(null);
  const [copiado, setCopiado] = useState(false);
  useEffect(() => { api.get('/tenant/indicacao').then((r) => setD(r.data)).catch(() => {}); }, []);
  if (!d) return null;
  const msg = `Conheça o PastorIA: cuidado pastoral pelo WhatsApp, com chamada, jornada do visitante e alerta de quem está se afastando. Pelo meu link você ganha ${14 + d.bonusTrialDias} dias grátis: ${d.link}`;
  const copiar = async () => { try { await navigator.clipboard.writeText(d.link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sem clipboard */ } };
  return (
    <section className="mb-5 rounded-2xl border border-ibbiGold/40 bg-gradient-to-r from-amber-50 to-white p-5">
      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div>
          <p className="font-display text-xl text-ibbiNavy">🎁 Indique e ganhe 1 mês grátis</p>
          <p className="text-sm text-slate-600 mt-1">Cada igreja que assinar pelo seu link vale <strong>1 mensalidade grátis</strong> para vocês. A igreja indicada ganha <strong>+{d.bonusTrialDias} dias</strong> de teste.</p>
          <p className="text-xs text-slate-500 mt-2">{d.indicadas} igreja(s) indicada(s) · {d.concedidos.length} assinaram · <strong>{d.creditosMeses} mês(es) grátis</strong> a usar</p>
        </div>
        <div className="flex flex-col gap-2 md:w-96">
          <code className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 break-all">{d.link}</code>
          <div className="flex gap-2">
            <button type="button" onClick={copiar} className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-ibbiNavy text-white">{copiado ? 'Copiado ✓' : 'Copiar link'}</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className="flex-1 text-center px-3 py-2 rounded-lg text-sm font-semibold bg-[#25d366] text-white">Enviar no WhatsApp</a>
          </div>
        </div>
      </div>
    </section>
  );
}
