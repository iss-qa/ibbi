import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/Header';
import api from '../../services/api';
import { Badge, Button, Card, Field, Modal, Tabs, inputClass } from '../../components/ui';
import GrupoForm from './GrupoForm';
import PersonPicker from './PersonPicker';
import { ATIVIDADES, DIAS, atividadeLabel, hojeIso } from './shared';

const NIVEL = { atencao: ['amber', 'Atenção'], risco: ['orange', 'Risco'], critico: ['red', 'Crítico'] };

// "Sede · mulheres · 18 a 35 anos": de onde vem o número de membros do grupo
const descCriterios = (g) => {
  const c = g.criterios || {};
  const sexo = c.sexo === 'Feminino' ? 'mulheres' : c.sexo === 'Masculino' ? 'homens' : 'homens e mulheres';
  const idade = c.idadeMin && c.idadeMax ? `${c.idadeMin} a ${c.idadeMax} anos`
    : c.idadeMin ? `${c.idadeMin} anos ou mais` : c.idadeMax ? `até ${c.idadeMax} anos` : 'todas as idades';
  return [g.congregacao, sexo, idade, ...(c.tipos?.length ? [c.tipos.join(', ')] : [])].join(' · ');
};

function RevisaoModal({ grupo, onClose, onDone }) {
  const [rev, setRev] = useState(null);
  const [remover, setRemover] = useState([]);
  const [adicionar, setAdicionar] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get(`/encontros/grupos/${grupo._id}/revisao`).then(({ data }) => {
      setRev(data);
      // Quem foi adicionado à mão e os líderes ficam desmarcados
      setRemover(data.fora.filter((f) => !f.manual && !f.lider).map((f) => String(f.personId)));
    }).catch(() => setRev({ erro: true }));
  }, [grupo._id]);
  const marcar = (id) => setRemover((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  const aplicar = async () => {
    setSaving(true);
    try {
      const { data } = await api.post(`/encontros/grupos/${grupo._id}/revisao`, { remover, adicionar: adicionar && rev.faltando.length > 0 });
      onDone(`${data.removidos} removido(s) e ${data.adicionados} adicionado(s). O grupo tem ${data.totalMembros} membros.`);
    } finally {
      setSaving(false);
    }
  };
  const nada = rev && !rev.erro && !rev.fora.length && !rev.faltando.length;
  return (
    <Modal
      title="Revisar membros pelos critérios"
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>{nada ? 'Fechar' : 'Cancelar'}</Button>{!nada && rev && !rev.erro && <Button onClick={aplicar} disabled={saving || (!remover.length && !(adicionar && rev.faltando.length))}>{saving ? 'Aplicando…' : 'Aplicar'}</Button>}</>}
    >
      {!rev && <p className="text-sm text-slate-500">Carregando…</p>}
      {rev?.erro && <p className="text-sm text-red-600">Não foi possível revisar agora.</p>}
      {rev && !rev.erro && (
        <div className="space-y-4 text-sm">
          <p className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-slate-700">
            <strong>{rev.pelosCriterios}</strong> pessoa(s) atendem hoje a <strong>{descCriterios(grupo)}</strong>. O grupo tem <strong>{grupo.membros.length}</strong>.
          </p>
          {nada && <p className="text-emerald-700">Tudo certo: o grupo já está de acordo com os critérios. ✅</p>}
          {rev.fora.length > 0 && (
            <div>
              <p className="font-medium text-ibbiNavy mb-1">Não atendem mais aos critérios ({rev.fora.length}) — marcados serão removidos</p>
              <ul className="max-h-60 overflow-y-auto divide-y divide-slate-50 border border-slate-100 rounded-xl">
                {rev.fora.map((f) => (
                  <li key={f.personId}>
                    <label className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4" checked={remover.includes(String(f.personId))} onChange={() => marcar(String(f.personId))} />
                      <span className="flex-1 min-w-0 truncate">{f.nome}</span>
                      <span className="text-xs text-slate-500 shrink-0">{f.motivo}{f.manual ? ' · adicionado à mão' : ''}{f.lider ? ' · líder' : ''}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {rev.faltando.length > 0 && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 mt-0.5" checked={adicionar} onChange={(e) => setAdicionar(e.target.checked)} />
              <span>
                Incluir <strong>{rev.faltando.length}</strong> pessoa(s) que atendem aos critérios e ainda não estão no grupo
                <span className="block text-xs text-slate-500 mt-0.5 line-clamp-2">{rev.faltando.slice(0, 8).map((p) => p.nome).join(', ')}{rev.faltando.length > 8 ? '…' : ''}</span>
              </span>
            </label>
          )}
        </div>
      )}
    </Modal>
  );
}

function NovoEncontroModal({ grupo, onClose, onCreated }) {
  const [f, setF] = useState({ data: hojeIso(), atividade: 'culto', tema: '', descricao: '' });
  const [error, setError] = useState('');
  const submit = async () => {
    setError('');
    try {
      const { data } = await api.post(`/encontros/grupos/${grupo._id}/encontros`, f);
      onCreated(data);
    } catch (err) {
      if (err?.response?.status === 409 && err.response.data?.encontro) onCreated(err.response.data.encontro);
      else setError(err?.response?.data?.message || 'Falha ao criar');
    }
  };
  return (
    <Modal title={`Novo encontro — ${grupo.nome}`} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={submit}>Criar e fazer a chamada</Button></>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Data"><input type="date" className={inputClass} value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Field>
        <Field label="Atividade">
          <select className={inputClass} value={f.atividade} onChange={(e) => setF({ ...f, atividade: e.target.value })}>
            {ATIVIDADES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2"><Field label="Tema"><input className={inputClass} value={f.tema} onChange={(e) => setF({ ...f, tema: e.target.value })} placeholder="Ex.: Mulheres de fé — Rute" /></Field></div>
        <div className="sm:col-span-2"><Field label="Descrição / anotações" hint="Usadas pela IA na mensagem para quem faltou (cite a referência bíblica completa)"><textarea className={`${inputClass} min-h-[90px]`} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Field></div>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </Modal>
  );
}

export default function GrupoEncontroPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [grupo, setGrupo] = useState(null);
  const [tab, setTab] = useState('encontros');
  const [encontros, setEncontros] = useState([]);
  const [freq, setFreq] = useState(null);
  const [showNovo, setShowNovo] = useState(false);
  const [showRevisao, setShowRevisao] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const [g, e] = await Promise.all([api.get(`/encontros/grupos/${id}`), api.get(`/encontros/grupos/${id}/encontros`)]);
    setGrupo(g.data);
    setEncontros(e.data);
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (tab === 'frequencia') api.get(`/encontros/grupos/${id}/frequencia`).then((r) => setFreq(r.data)).catch(() => setFreq([]));
  }, [tab, id]);

  if (!grupo) return <p className="text-sm text-slate-500">Carregando...</p>;

  const addMembro = async (p) => { await api.post(`/encontros/grupos/${id}/membros`, { personId: p._id }); load(); };
  const removeMembro = async (pid) => { await api.delete(`/encontros/grupos/${id}/membros/${pid}`); load(); };
  const salvarGrupo = async (payload) => {
    const mudouCriterios = payload.criterios && JSON.stringify(payload.criterios) !== JSON.stringify(grupo.criterios || {});
    await api.put(`/encontros/grupos/${id}`, payload);
    setMsg('Grupo atualizado.');
    await load();
    // Critérios novos: mostra quem entra e quem sai antes de mexer na lista
    if (mudouCriterios) { setTab('membros'); setShowRevisao(true); } else setTab('encontros');
  };

  return (
    <div>
      <Link to="/encontros" className="text-sm text-ibbiBlue">← Encontros</Link>
      <Header
        title={grupo.nome}
        subtitle={`${grupo.congregacao} · ${DIAS[grupo.diaSemana]} ${grupo.horario} · ${grupo.membros.length} membros${grupo.ebdClasses?.length ? ` · inclui EBD ${grupo.ebdClasses.join(', ')}` : ''}`}
        action={grupo.tipo === 'ebd'
          ? <Button variant="outline" onClick={() => navigate('/ebd')}>Fazer chamada na EBD</Button>
          : <Button onClick={() => setShowNovo(true)} disabled={!grupo.membros.length}>+ Novo encontro</Button>}
      />
      {msg && <p className="text-sm text-emerald-700 mb-3">{msg}</p>}
      {grupo.tipo === 'ebd' && (
        <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
          Este grupo espelha a classe <strong>{grupo.ebdClasse}</strong> da EBD: cada aula com chamada aparece aqui como encontro. Para registrar ou corrigir presenças, use o menu <strong>EBD</strong>.
        </div>
      )}

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[['encontros', grupo.tipo === 'ebd' ? 'Aulas' : 'Encontros'], ['membros', `Membros (${grupo.membros.length})`], ['frequencia', 'Frequência'], ...(grupo.tipo === 'ebd' ? [] : [['config', 'Configurar']])].map(([id, label]) => ({ id, label }))}
      />

      {tab === 'encontros' && (
        <Card>
          {!encontros.length && <p className="text-sm text-slate-500 py-4 text-center">Nenhum encontro registrado. Clique em "+ Novo encontro" ou deixe o assistente pedir a chamada aos líderes no WhatsApp.</p>}
          <ul className="divide-y divide-slate-100">
            {encontros.map((e) => {
              const pct = e.total ? Math.round((e.totalPresentes / e.total) * 100) : 0;
              return (
                <li key={e._id}>
                  <button type="button" onClick={() => navigate(e.ebdAulaId ? `/ebd/${e.ebdAulaId}` : `/encontros/${e._id}`)} className="w-full text-left py-3 flex items-center gap-3 hover:bg-slate-50 rounded-lg px-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800">
                        {new Date(e.data).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })} · {atividadeLabel(e.atividade)}
                        {e.ebdAulaId && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 align-middle">EBD</span>}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{e.tema || 'Sem tema'}{e.origem === 'whatsapp' ? ' · registrado pelo WhatsApp' : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums text-ibbiNavy">{e.totalPresentes}/{e.total}</p>
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {tab === 'membros' && (
        <Card title="Membros" subtitle={grupo.tipo === 'ebd' ? 'Alunos que já apareceram nas chamadas desta classe' : 'Quem entra na chamada de cada encontro'} action={grupo.tipo !== 'ebd' && <Button variant="outline" onClick={() => setShowRevisao(true)}>Revisar pelos critérios</Button>}>
          {grupo.tipo !== 'ebd' && (
            <p className="mb-3 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
              Entram sozinhos: <strong>{descCriterios(grupo)}</strong>. Pessoas novas que se encaixam são incluídas; ninguém sai sem você revisar. Ajuste em <button type="button" className="text-ibbiBlue hover:underline" onClick={() => setTab('config')}>Configurar</button>.
            </p>
          )}
          {grupo.tipo !== 'ebd' && <div className="mb-3 max-w-md"><PersonPicker congregacao={grupo.congregacao} placeholder="Adicionar pessoa ao grupo" onPick={addMembro} /></div>}
          <ul className="divide-y divide-slate-100">
            {[...grupo.membros].sort((a, b) => a.nome.localeCompare(b.nome)).map((m) => (
              <li key={m.personId} className="py-2 flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{m.nome}{grupo.lideres.some((l) => String(l.personId) === String(m.personId)) && <Badge color="navy">líder</Badge>}</span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-400">{m.celular || 'sem celular'}</span>
                  {grupo.tipo !== 'ebd' && <button type="button" className="text-xs text-red-600" onClick={() => removeMembro(m.personId)}>remover</button>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === 'frequencia' && (
        <Card title="Frequência" subtitle="Últimas 16 semanas · ordenado por faltas seguidas">
          {!freq ? <p className="text-sm text-slate-500">Carregando...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm [&_th]:whitespace-nowrap [&_th+th]:pl-3 [&_td+td]:pl-3">
                <thead><tr className="text-left text-slate-500 border-b border-slate-100"><th className="py-2">Nome</th><th className="text-right">Presenças</th><th className="text-right">Frequência</th><th className="text-right">Faltas seguidas</th><th className="pl-3">Situação</th></tr></thead>
                <tbody>
                  {freq.map((p) => (
                    <tr key={p.personId} className="border-b border-slate-50">
                      <td className="py-2 min-w-[9rem]">{p.nome}</td>
                      <td className="text-right tabular-nums">{p.presencas}/{p.totalAulas}</td>
                      <td className="text-right tabular-nums">{p.totalAulas ? `${p.taxaPresenca}%` : '—'}</td>
                      <td className="text-right tabular-nums">{p.faltasConsecutivas || 0}</td>
                      <td className="pl-3">{p.nivel ? <Badge color={NIVEL[p.nivel][0]}>{NIVEL[p.nivel][1]}</Badge> : <span className="text-xs text-slate-400">ok</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'config' && (
        <Card title="Configurar grupo"><GrupoForm initial={grupo} onSubmit={salvarGrupo} /></Card>
      )}

      {showRevisao && <RevisaoModal grupo={grupo} onClose={() => setShowRevisao(false)} onDone={(texto) => { setShowRevisao(false); setMsg(texto); load(); }} />}
      {showNovo && <NovoEncontroModal grupo={grupo} onClose={() => setShowNovo(false)} onCreated={(e) => navigate(`/encontros/${e._id}`)} />}
    </div>
  );
}
