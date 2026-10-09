import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

// Próximas escalas (ministério, data e voluntários) no cartão de automação das escalas.
const ICONE = { confirmado: '✅', pendente: '⏳', recusado: '❌' };
const dataCurta = (d) => new Date(d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });

export default function EscalasResumo() {
  const [escalas, setEscalas] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    api.get('/escalas')
      .then((r) => setEscalas((r.data || []).slice(0, 3)))
      .catch((e) => setErro(e.response?.data?.message || 'Não foi possível carregar as escalas.'));
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">Próximas escalas</p>
        <Link to="/escalas" className="text-xs font-medium text-ibbiBlue hover:underline">Montar e editar escalas →</Link>
      </div>
      {erro && <p className="text-xs text-amber-700">{erro}</p>}
      {!erro && escalas === null && <p className="text-xs text-slate-400">Carregando…</p>}
      {escalas?.length === 0 && (
        <p className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-200 px-3 py-2">
          Nenhuma escala marcada. Em <Link to="/escalas" className="text-ibbiBlue hover:underline">Escalas</Link> você escolhe o ministério (louvor, recepção, som…), a data e quem serve em cada função.
        </p>
      )}
      {escalas?.map((e) => {
        const ok = e.itens.filter((i) => i.status === 'confirmado').length;
        return (
          <div key={e._id} className="rounded-lg border border-slate-200 px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800 truncate">{e.ministerio} <span className="font-normal text-slate-500">· {e.evento || 'Culto'}</span></p>
              <p className="text-xs text-slate-500 whitespace-nowrap">{dataCurta(e.data)}{e.horario ? ` · ${e.horario}` : ''}</p>
            </div>
            <p className="text-[11px] text-slate-400 mb-1">{e.congregacao} · {ok}/{e.itens.length} confirmados</p>
            <ul className="text-xs text-slate-600 space-y-0.5">
              {e.itens.slice(0, 6).map((i) => (
                <li key={i._id}><span aria-hidden="true">{ICONE[i.status] || '·'}</span> <span className="text-slate-400">{i.funcao}:</span> {i.nome}</li>
              ))}
              {e.itens.length > 6 && <li className="text-slate-400">e mais {e.itens.length - 6}</li>}
            </ul>
          </div>
        );
      })}
      <p className="text-[11px] text-slate-400">✅ confirmou · ⏳ ainda não respondeu · ❌ não pode</p>
    </div>
  );
}
