import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/Header';
import api from '../../services/api';
import { Badge, Button, Card, Field, Modal, inputClass } from '../../components/ui';
import GrupoForm from './GrupoForm';
import PersonPicker from './PersonPicker';
import { ATIVIDADES, DIAS, atividadeLabel, hojeIso } from './shared';

const NIVEL = { atencao: ['amber', 'Atenção'], risco: ['orange', 'Risco'], critico: ['red', 'Crítico'] };

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

  const sincronizar = async () => {
    const { data } = await api.post(`/encontros/grupos/${id}/sincronizar`);
    setMsg(`${data.adicionados} pessoa(s) adicionada(s) pelos critérios.`);
    load();
  };
  const addMembro = async (p) => { await api.post(`/encontros/grupos/${id}/membros`, { personId: p._id }); load(); };
  const removeMembro = async (pid) => { await api.delete(`/encontros/grupos/${id}/membros/${pid}`); load(); };
  const salvarGrupo = async (payload) => { await api.put(`/encontros/grupos/${id}`, payload); setMsg('Grupo atualizado.'); setTab('encontros'); load(); };

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

      <div className="flex gap-1 mb-4 overflow-x-auto" role="tablist">
        {[['encontros', grupo.tipo === 'ebd' ? 'Aulas' : 'Encontros'], ['membros', `Membros (${grupo.membros.length})`], ['frequencia', 'Frequência'], ...(grupo.tipo === 'ebd' ? [] : [['config', 'Configurar']])].map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${tab === k ? 'bg-ibbiNavy text-white' : 'bg-white text-slate-600 border border-stone-100 hover:bg-slate-50'}`}>{l}</button>
        ))}
      </div>

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
        <Card title="Membros" subtitle={grupo.tipo === 'ebd' ? 'Alunos que já apareceram nas chamadas desta classe' : 'Quem entra na chamada de cada encontro'} action={grupo.tipo !== 'ebd' && <Button variant="outline" onClick={sincronizar}>Atualizar pelos critérios</Button>}>
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
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500 border-b border-slate-100"><th className="py-2">Nome</th><th className="text-right">Presenças</th><th className="text-right">Frequência</th><th className="text-right">Faltas seguidas</th><th className="pl-3">Situação</th></tr></thead>
                <tbody>
                  {freq.map((p) => (
                    <tr key={p.personId} className="border-b border-slate-50">
                      <td className="py-2">{p.nome}</td>
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

      {showNovo && <NovoEncontroModal grupo={grupo} onClose={() => setShowNovo(false)} onCreated={(e) => navigate(`/encontros/${e._id}`)} />}
    </div>
  );
}
