import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/Header';
import api from '../../services/api';
import { Card, KpiCard } from '../../components/ui';
import { useTenant } from '../../context/TenantContext';

const ETAPAS = [
  ['d1', 'Dia 1', 'Obrigado pela visita'],
  ['d2', 'Dia 2', 'Pedido de oração'],
  ['d3', 'Dia 3', 'Como foi a visita'],
  ['d7', 'Dia 7', 'Convite para a união/grupo'],
  ['d14', 'Dia 14', 'Convite à EBD'],
  ['d21', 'Dia 21', 'Te esperamos / batismo'],
  ['d30', 'Dia 30', 'Resumo à liderança'],
];
const ICONE = { enviada: '✅', pulada: '⏭️', erro: '⚠️', pendente: '·' };

// Jornada de 30 dias do visitante e do novo convertido: acolhimento automático até se firmar.
export default function Jornada() {
  const { hasFeature, tenant } = useTenant();
  const [data, setData] = useState(null);
  const [filtro, setFiltro] = useState('ativa');
  const [erro, setErro] = useState('');

  const load = useCallback(async () => setData((await api.get('/jornadas')).data), []);
  useEffect(() => { if (hasFeature('jornadaVisitante')) load().catch((e) => setErro(e.response?.data?.message || 'Falha ao carregar')); }, [load, hasFeature]);

  const encerrar = async (j) => {
    if (!window.confirm(`Encerrar a jornada de ${j.nome}? As mensagens programadas não serão enviadas.`)) return;
    await api.put(`/jornadas/${j._id}/cancelar`);
    load();
  };

  if (!hasFeature('jornadaVisitante')) {
    return (
      <div>
        <Header title="Jornada do visitante" />
        <Card><p className="text-sm text-slate-600">A jornada de 30 dias do visitante está disponível a partir do plano <strong>Crescer</strong>. <Link to="/assinatura" className="text-ibbiBlue">Ver planos</Link></p></Card>
      </div>
    );
  }

  const lista = (data?.jornadas || []).filter((j) => filtro === 'todas' || (filtro === 'voltaram' ? j.retornou : filtro === 'nao' ? !j.retornou : j.status === filtro));
  return (
    <div>
      <Header title="Jornada do visitante" subtitle="30 dias de acolhimento automático pelo WhatsApp: ninguém fica para trás depois da primeira visita" />
      {erro && <p className="mb-4 text-sm bg-red-50 border border-red-100 text-red-700 rounded-lg px-3 py-2">{erro}</p>}

      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <KpiCard label="Em jornada agora" value={data.totais.ativas} />
          <KpiCard label="Voltaram" value={data.totais.retornaram} hint="presença na EBD, encontro ou culto" />
          <KpiCard label="Taxa de retorno" value={`${data.totais.taxaRetorno}%`} hint="últimos 45 dias" />
          <KpiCard label="Concluídas" value={data.totais.concluidas} />
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        {[['ativa', 'Em jornada'], ['nao', 'Ainda não voltaram'], ['voltaram', 'Voltaram'], ['todas', 'Todas']].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setFiltro(v)} className={`px-3 py-1.5 rounded-lg border ${filtro === v ? 'bg-ibbiNavy text-white border-ibbiNavy' : 'bg-white border-slate-200 text-slate-600'}`}>{l}</button>
        ))}
      </div>

      <Card>
        {!lista.length && <p className="text-sm text-slate-400">Ninguém por aqui. Todo visitante ou novo decidido cadastrado entra automaticamente.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {lista.length > 0 && (
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase whitespace-nowrap">
                  <th className="py-2 pr-3">Pessoa</th>
                  <th className="pr-3">Dia</th>
                  {ETAPAS.map(([k, l, d]) => <th key={k} className="pr-2 text-center" title={d}>{l}</th>)}
                  <th className="pr-3">Voltou?</th>
                  <th />
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-slate-50">
              {lista.map((j) => (
                <tr key={j._id}>
                  <td className="py-2 pr-3 min-w-[10rem]">
                    <p className="font-medium text-ibbiNavy">{j.nome}</p>
                    <p className="text-xs text-slate-500">{j.tipo} · {j.congregacao}{j.respondeuEm ? ' · 💬 respondeu' : ''}</p>
                  </td>
                  <td className="pr-3 tabular-nums">{j.dia}/30</td>
                  {ETAPAS.map(([k]) => {
                    const e = j.etapas.find((x) => x.chave === k);
                    return <td key={k} className="pr-2 text-center" title={e?.erro || e?.status}>{ICONE[e?.status] || '·'}</td>;
                  })}
                  <td className="pr-3">{j.retornou ? <span className="text-emerald-700">✅ {j.retornouOnde}</span> : <span className="text-amber-700">ainda não</span>}</td>
                  <td>{j.status === 'ativa' && <button type="button" className="text-xs text-slate-400 hover:text-red-600" onClick={() => encerrar(j)}>encerrar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400">✅ enviada · ⏭️ pulada (atrasada ou a pessoa já voltou) · ⚠️ erro no envio. Mensagens às {tenant?.automacoes?.jornada?.hora || '10:00'} (horário da igreja), com intervalo anti-bloqueio.</p>
      </Card>
    </div>
  );
}
