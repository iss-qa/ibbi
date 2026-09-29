import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/Header';
import api from '../../services/api';
import useAuth from '../../hooks/useAuth';
import { useTenant } from '../../context/TenantContext';
import useCongregacaoScope from '../../hooks/useCongregacaoScope';
import { Badge, Button, Card, KpiCard, Modal, fmtDate, fmtDateTime, inputClass } from '../../components/ui';

const NIVEL = {
  atencao: { color: 'amber', icon: '●', label: 'Atenção' },
  risco: { color: 'orange', icon: '▲', label: 'Risco' },
  critico: { color: 'red', icon: '■', label: 'Crítico' },
};
const STATUS = {
  aberto: { color: 'amber', label: 'Aberto' },
  em_contato: { color: 'blue', label: 'Em contato' },
  resolvido: { color: 'green', label: 'Resolvido' },
  ignorado: { color: 'gray', label: 'Ignorado' },
};
const ACOES = [
  { tipo: 'ligacao', label: '📞 Liguei' },
  { tipo: 'visita', label: '🏠 Visitei' },
  { tipo: 'oracao', label: '🙏 Orei' },
  { tipo: 'mensagem_manual', label: '💬 Mandei mensagem' },
];

function MessageModal({ item, onClose, onSent }) {
  const [mensagem, setMensagem] = useState(item.alerta?.mensagemSugerida || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const gerar = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post(`/care/alerts/${item.alerta._id}/generate`);
      setMensagem(data.mensagem);
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao gerar mensagem');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!mensagem && item.alerta) gerar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enviar = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post(`/care/alerts/${item.alerta._id}/send`, { mensagem });
      onSent();
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao enviar');
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`Mensagem para ${item.nome}`}
      onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={gerar} disabled={loading}>✨ Gerar outra</Button>
          <Button onClick={enviar} disabled={loading || !mensagem.trim()}>{loading ? 'Aguarde...' : 'Enviar no WhatsApp'}</Button>
        </>
      )}
    >
      <p className="text-xs text-slate-500 mb-2">
        Texto gerado pela IA com base no tema da última aula. Revise e ajuste antes de enviar.
      </p>
      <textarea className={`${inputClass} min-h-[180px]`} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </Modal>
  );
}

function HistoryModal({ item, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get(`/care/person/${item.personId}`).then((r) => setData(r.data)).catch(() => setData({ historico: [], alertas: [] }));
  }, [item.personId]);
  return (
    <Modal title={`Histórico — ${item.nome}`} onClose={onClose} wide>
      {!data ? <p className="text-sm text-slate-500">Carregando...</p> : (
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Frequência na EBD</h4>
            <div className="flex flex-wrap gap-1.5 mb-3" aria-label="Linha do tempo de presença">
              {[...data.historico].reverse().map((h) => (
                <span
                  key={h.data}
                  title={`${fmtDate(h.data)} — ${h.presente ? 'presente' : 'ausente'}`}
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${h.presente ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                >
                  {h.presente ? 'P' : 'F'}
                </span>
              ))}
            </div>
            <ul className="text-sm divide-y divide-slate-100">
              {data.historico.slice(0, 10).map((h) => (
                <li key={h.data} className="py-1.5 flex justify-between gap-2">
                  <span className="text-slate-600">{fmtDate(h.data)} · {h.classe}{h.tema ? ` · ${h.tema}` : ''}</span>
                  <span className={h.presente ? 'text-emerald-700' : 'text-red-700'}>{h.presente ? 'Presente' : 'Ausente'}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Ações de cuidado</h4>
            {data.alertas.flatMap((a) => a.acoes).length === 0 && <p className="text-sm text-slate-400">Nenhuma ação registrada.</p>}
            <ul className="space-y-2">
              {data.alertas.flatMap((a) => a.acoes).sort((a, b) => new Date(b.em) - new Date(a.em)).map((ac) => (
                <li key={ac._id} className="text-sm border border-slate-100 rounded-lg p-2">
                  <div className="flex justify-between text-xs text-slate-400"><span>{ac.tipo.replace(/_/g, ' ')} · {ac.por}</span><span>{fmtDateTime(ac.em)}</span></div>
                  {ac.descricao && <p className="text-slate-700 mt-1 whitespace-pre-wrap">{ac.descricao}</p>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function CareDashboard() {
  const { user } = useAuth();
  const { tenant, hasFeature } = useTenant();
  const { options: congregacaoOptions } = useCongregacaoScope();
  const [congregacao, setCongregacao] = useState('Todos');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filtroNivel, setFiltroNivel] = useState('todos');
  const [msgItem, setMsgItem] = useState(null);
  const [histItem, setHistItem] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get('/care/overview', { params: { congregacao } });
      setData(d);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao carregar');
    }
  }, [congregacao]);

  useEffect(() => { load(); }, [load]);

  const registrar = async (item, patch) => {
    if (!item.alerta) return;
    await api.put(`/care/alerts/${item.alerta._id}`, patch);
    load();
  };

  const lista = useMemo(
    () => (data?.emRisco || []).filter((s) => filtroNivel === 'todos' || s.nivel === filtroNivel),
    [data, filtroNivel],
  );
  const automacao = tenant?.automacoes?.ausencia;

  return (
    <div>
      <Header
        title="Cuidado Pastoral"
        subtitle="Quem precisa de um telefonema hoje — faltas seguidas na EBD e nos encontros das uniões"
        action={congregacaoOptions.length > 1 && (
          <select className="border rounded-lg px-3 py-2 text-sm w-full sm:w-auto" value={congregacao} onChange={(e) => setCongregacao(e.target.value)} aria-label="Filtrar por congregação">
            <option value="Todos">{user?.role === 'master' ? 'Todas as congregações' : 'Minhas congregações'}</option>
            {congregacaoOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      />

      {!hasFeature('reengajamento') && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
          O envio automático de mensagens aos ausentes faz parte do plano <strong>Crescer</strong>. O painel abaixo continua mostrando quem está se afastando.
          {user?.role === 'master' && <Link to="/assinatura" className="ml-1 underline font-medium">Ver planos</Link>}
        </div>
      )}
      {hasFeature('reengajamento') && !automacao?.ativo && user?.role === 'master' && (
        <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900">
          O motor de reengajamento está desligado. Ative em <Link to="/configuracoes" className="underline font-medium">Configurações → Automações</Link> para que a IA prepare mensagens para os ausentes depois de cada chamada.
        </div>
      )}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <KpiCard label="Acompanhados na EBD" value={data?.totais.acompanhados ?? '—'} />
        <KpiCard label="Atenção (2 faltas)" value={data?.totais.atencao ?? '—'} accent="text-amber-600" />
        <KpiCard label="Risco (3+ faltas)" value={data?.totais.risco ?? '—'} accent="text-orange-600" />
        <KpiCard label={`Crítico (${automacao?.semanasAlerta || 4}+ faltas)`} value={data?.totais.critico ?? '—'} accent="text-red-600" />
        <KpiCard label="Presença média (16 sem.)" value={data ? `${data.totais.taxaMedia}%` : '—'} />
      </section>

      <Card
        title="Membros se afastando"
        subtitle={`${lista.length} pessoa(s) · ordenado por risco`}
        action={(
          <div className="flex gap-1 text-xs" role="tablist" aria-label="Filtrar por nível">
            {['todos', 'critico', 'risco', 'atencao'].map((n) => (
              <button
                key={n}
                type="button"
                role="tab"
                aria-selected={filtroNivel === n}
                onClick={() => setFiltroNivel(n)}
                className={`px-2.5 py-1 rounded-full ${filtroNivel === n ? 'bg-ibbiNavy text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {n === 'todos' ? 'Todos' : NIVEL[n].label}
              </button>
            ))}
          </div>
        )}
      >
        {!data && <p className="text-sm text-slate-500">Carregando...</p>}
        {data && lista.length === 0 && (
          <p className="text-sm text-slate-500 py-6 text-center">🙌 Ninguém com faltas consecutivas neste filtro. Glória a Deus!</p>
        )}
        <ul className="divide-y divide-slate-100">
          {lista.map((item) => {
            const nivel = NIVEL[item.nivel];
            const st = item.alerta ? STATUS[item.alerta.status] : null;
            return (
              <li key={`${item.personId}-${item.origem}-${item.grupoId || ''}`} className="py-3 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" className="font-medium text-ibbiBlue hover:underline text-left" onClick={() => setHistItem(item)}>{item.nome}</button>
                    <Badge color="gray">{item.origem === 'encontro' ? `Encontro · ${item.classe}` : 'EBD'}</Badge>
                    <Badge color={nivel.color} icon={nivel.icon}>{nivel.label} · {item.faltasConsecutivas} faltas seguidas</Badge>
                    {st && <Badge color={st.color}>{st.label}</Badge>}
                    {item.alerta?.precisaVisita && <Badge color="red" icon="🏠">Sugerida visita</Badge>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {item.classe} · {item.congregacao} · última presença: {item.ultimaPresenca ? fmtDate(item.ultimaPresenca) : 'sem registro'} · frequência {item.taxaPresenca}%
                    {item.tendencia !== null && item.tendencia < 0 && <span className="text-red-600"> (↓ {Math.abs(item.tendencia)} p.p.)</span>}
                  </p>
                  {item.alerta?.motivoInformado && (
                    <p className="text-xs text-slate-700 mt-1 bg-slate-50 rounded px-2 py-1">💬 {item.alerta.motivoInformado}</p>
                  )}
                  {item.alerta?.mensagemEnviadaEm && (
                    <p className="text-[11px] text-emerald-700 mt-1">✓ Mensagem enviada em {fmtDateTime(item.alerta.mensagemEnviadaEm)}</p>
                  )}
                </div>
                {item.alerta && item.alerta.status !== 'resolvido' && (
                  <div className="flex flex-wrap gap-1.5 lg:justify-end">
                    {hasFeature('reengajamento') && (
                      <Button variant={item.alerta.mensagemSugerida ? 'gold' : 'outline'} className="text-xs" onClick={() => setMsgItem(item)}>
                        {item.alerta.mensagemSugerida ? '✨ Revisar mensagem' : '✨ Mensagem IA'}
                      </Button>
                    )}
                    {ACOES.map((a) => (
                      <Button key={a.tipo} variant="ghost" className="text-xs" onClick={() => registrar(item, { acao: { tipo: a.tipo, descricao: a.label.slice(2) } })}>{a.label}</Button>
                    ))}
                    <Button variant="ghost" className="text-xs" onClick={() => registrar(item, { status: 'resolvido', acao: { tipo: 'outro', descricao: 'Marcado como resolvido' } })}>✓ Resolver</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {msgItem && <MessageModal item={msgItem} onClose={() => setMsgItem(null)} onSent={() => { setMsgItem(null); load(); }} />}
      {histItem && <HistoryModal item={histItem} onClose={() => setHistItem(null)} />}
    </div>
  );
}
