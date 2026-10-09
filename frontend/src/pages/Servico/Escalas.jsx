import { useCallback, useEffect, useState } from 'react';
import Header from '../../components/Header';
import api from '../../services/api';
import { Card, Button, Field, Modal, inputClass } from '../../components/ui';
import { CONGREGACOES } from '../../constants/congregacoes';
import PersonPicker from '../Encontros/PersonPicker';
import { useDialog } from '../../components/dialog/DialogProvider.jsx';

const MINISTERIOS = ['Louvor', 'Recepção', 'Som e mídia', 'EBD', 'Infantil', 'Intercessão', 'Diaconia', 'Limpeza', 'Outro'];
const STATUS = { confirmado: ['✅', 'Confirmado', 'text-emerald-700 bg-emerald-50'], recusado: ['❌', 'Não pode', 'text-red-700 bg-red-50'], pendente: ['⏳', 'Aguardando', 'text-amber-700 bg-amber-50'] };
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const fmtData = (d) => { const x = new Date(d); return `${DIAS[x.getUTCDay()]}, ${x.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`; };
const novoForm = () => ({ ministerio: 'Louvor', evento: 'Culto de domingo', congregacao: CONGREGACOES[0] || 'Sede', data: '', horario: '19:00', observacao: '', itens: [], responsavel: null });

// Escala de voluntários: convite no WhatsApp com "1 Confirmo / 2 Não posso".
export default function Escalas() {
  const { confirm } = useDialog();
  const [escalas, setEscalas] = useState([]);
  const [passadas, setPassadas] = useState(false);
  const [form, setForm] = useState(null);
  const [funcao, setFuncao] = useState('');
  const [detalhe, setDetalhe] = useState(null);
  const [sugestoes, setSugestoes] = useState(null);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  const load = useCallback(async () => {
    const { data } = await api.get('/escalas', { params: { passadas: passadas ? 1 : undefined } });
    setEscalas(data);
  }, [passadas]);
  useEffect(() => { load().catch((e) => setErro(e.response?.data?.message || 'Falha ao carregar')); }, [load]);

  const addPessoa = (p) => {
    if (!funcao.trim()) { setErro('Informe a função antes de escolher a pessoa (ex.: Vocal, Teclado, Portaria).'); return; }
    setErro('');
    setForm((f) => ({ ...f, itens: [...f.itens, { funcao: funcao.trim(), personId: p._id, nome: p.nome, celular: p.celular }] }));
  };

  const salvar = async (enviar) => {
    setErro('');
    try {
      const { data } = await api.post('/escalas', { ...form, responsavelId: form.responsavel?._id, itens: form.itens.map(({ funcao: f, personId }) => ({ funcao: f, personId })), enviar });
      setMsg(enviar ? `Escala criada e ${data.enviados} convite(s) na fila de envio (com intervalo anti-bloqueio).` : 'Escala salva. Envie os convites quando quiser.');
      setForm(null);
      load();
    } catch (e) {
      setErro(e.response?.data?.message || 'Não foi possível salvar');
    }
  };

  const atualizarDetalhe = (e) => { setDetalhe(e); load(); };
  const enviarConvites = async (e) => {
    const { data } = await api.post(`/escalas/${e._id}/convites`);
    setMsg(data.enviados ? `${data.enviados} convite(s) na fila de envio.` : 'Nenhum convite pendente.');
  };
  const remover = async (e, item) => atualizarDetalhe((await api.delete(`/escalas/${e._id}/itens/${item._id}`)).data);
  const cancelar = async (e) => {
    if (!(await confirm({ title: 'Cancelar escala', message: 'Cancelar esta escala?', confirmLabel: 'Cancelar escala', cancelLabel: 'Voltar', danger: true }))) return;
    await api.delete(`/escalas/${e._id}`);
    setDetalhe(null);
    load();
  };
  const verSugestoes = async (e, item) => setSugestoes({ item, lista: (await api.get(`/escalas/${e._id}/sugestoes`, { params: { funcao: item.funcao } })).data });
  const convidar = async (e, funcaoItem, personId) => {
    atualizarDetalhe((await api.post(`/escalas/${e._id}/itens`, { funcao: funcaoItem, personId, enviar: true })).data);
    setSugestoes(null);
  };

  return (
    <div>
      <Header
        title="Escalas de voluntários"
        subtitle="Convite pelo WhatsApp, confirmação com 1 toque e lembrete na véspera"
        action={<Button variant="gold" onClick={() => { setForm(novoForm()); setFuncao(''); }}>+ Nova escala</Button>}
      />
      {msg && <p className="mb-4 text-sm bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg px-3 py-2">{msg}</p>}
      {erro && !form && <p className="mb-4 text-sm bg-red-50 border border-red-100 text-red-700 rounded-lg px-3 py-2">{erro}</p>}

      <div className="mb-3 inline-flex bg-white border border-slate-200 rounded-lg p-1 text-sm">
        {[[false, 'Próximas'], [true, 'Passadas (60 dias)']].map(([v, l]) => (
          <button key={l} type="button" onClick={() => setPassadas(v)} className={`px-3 py-1 rounded-md ${passadas === v ? 'bg-ibbiNavy text-white font-semibold' : 'text-slate-600'}`}>{l}</button>
        ))}
      </div>

      {!escalas.length && <Card><p className="text-sm text-slate-400">Nenhuma escala {passadas ? 'nos últimos 60 dias' : 'agendada'}.</p></Card>}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {escalas.map((e) => {
          const c = (s) => e.itens.filter((i) => i.status === s).length;
          return (
            <button key={e._id} type="button" onClick={() => setDetalhe(e)} className="text-left bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-soft transition">
              <p className="text-xs text-slate-500">{fmtData(e.data)}{e.horario ? ` · ${e.horario}` : ''} · {e.congregacao}</p>
              <p className="font-display text-lg text-ibbiNavy mt-0.5">{e.ministerio}</p>
              <p className="text-sm text-slate-600">{e.evento}</p>
              <p className="mt-3 text-sm tabular-nums">✅ {c('confirmado')} · ⏳ {c('pendente')} · ❌ {c('recusado')}</p>
            </button>
          );
        })}
      </div>

      {form && (
        <Modal title="Nova escala" onClose={() => setForm(null)} wide
          footer={(
            <>
              <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
              <Button variant="outline" disabled={!form.data || !form.itens.length} onClick={() => salvar(false)}>Salvar sem enviar</Button>
              <Button variant="gold" disabled={!form.data || !form.itens.length} onClick={() => salvar(true)}>Salvar e enviar convites</Button>
            </>
          )}
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Ministério">
              <input className={inputClass} list="ministerios" value={form.ministerio} onChange={(e) => setForm({ ...form, ministerio: e.target.value })} />
              <datalist id="ministerios">{MINISTERIOS.map((m) => <option key={m} value={m} />)}</datalist>
            </Field>
            <Field label="Evento"><input className={inputClass} value={form.evento} onChange={(e) => setForm({ ...form, evento: e.target.value })} /></Field>
            <Field label="Data"><input type="date" className={inputClass} value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></Field>
            <Field label="Horário"><input type="time" className={inputClass} value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} /></Field>
            <Field label="Congregação">
              <select className={inputClass} value={form.congregacao} onChange={(e) => setForm({ ...form, congregacao: e.target.value })}>
                {CONGREGACOES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Responsável" hint="Recebe no WhatsApp quem não pode, com sugestões de substituto. Vazio = você.">
              {form.responsavel
                ? <div className="flex items-center justify-between text-sm border border-slate-200 rounded-lg px-3 py-2">{form.responsavel.nome}<button type="button" className="text-red-600 text-xs" onClick={() => setForm({ ...form, responsavel: null })}>trocar</button></div>
                : <PersonPicker onPick={(p) => setForm({ ...form, responsavel: p })} placeholder="Buscar responsável" />}
            </Field>
            <div className="sm:col-span-2">
              <Field label="Observação (vai no convite)"><input className={inputClass} maxLength={500} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Ex.: chegar 30 min antes para o ensaio" /></Field>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-ibbiNavy">Quem vai servir</p>
            <div className="grid sm:grid-cols-[160px_1fr] gap-2 mt-2">
              <input className={inputClass} placeholder="Função (ex.: Vocal)" value={funcao} onChange={(e) => setFuncao(e.target.value)} />
              <PersonPicker onPick={addPessoa} congregacao={form.congregacao} placeholder="Buscar pessoa e adicionar" />
            </div>
            {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
            <ul className="mt-3 divide-y divide-slate-50 text-sm">
              {form.itens.map((it, i) => (
                <li key={`${it.personId}-${i}`} className="flex items-center justify-between py-1.5">
                  <span><strong>{it.funcao}</strong>: {it.nome}{!it.celular && <span className="ml-1 text-xs text-amber-700">(sem celular: não recebe convite)</span>}</span>
                  <button type="button" className="text-xs text-red-600" onClick={() => setForm({ ...form, itens: form.itens.filter((_, j) => j !== i) })}>remover</button>
                </li>
              ))}
              {!form.itens.length && <li className="py-2 text-slate-400">Digite a função e busque a pessoa.</li>}
            </ul>
          </div>
        </Modal>
      )}

      {detalhe && (
        <Modal title={`${detalhe.ministerio} · ${fmtData(detalhe.data)}${detalhe.horario ? ` ${detalhe.horario}` : ''}`} onClose={() => { setDetalhe(null); setSugestoes(null); }} wide
          footer={(
            <>
              <Button variant="ghost" onClick={() => cancelar(detalhe)}>Cancelar escala</Button>
              <Button variant="gold" onClick={() => enviarConvites(detalhe)}>Enviar convites pendentes</Button>
            </>
          )}
        >
          <p className="text-sm text-slate-600">{detalhe.evento} · {detalhe.congregacao}{detalhe.responsavelNome ? ` · responsável: ${detalhe.responsavelNome}` : ''}</p>
          <ul className="mt-3 divide-y divide-slate-100">
            {detalhe.itens.map((it) => {
              const [ic, label, cls] = STATUS[it.status];
              return (
                <li key={it._id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <p><strong>{it.funcao}</strong>: {it.nome}{it.substituiu && <span className="text-xs text-slate-500"> (no lugar de {it.substituiu})</span>}</p>
                    <p className="text-xs text-slate-400">{it.conviteEnviadoEm ? `convite enviado ${new Date(it.conviteEnviadoEm).toLocaleString('pt-BR')}` : 'convite não enviado'}{it.motivoRecusa ? ` · motivo: ${it.motivoRecusa}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{ic} {label}</span>
                    {it.status === 'recusado' && <Button variant="outline" className="text-xs" onClick={() => verSugestoes(detalhe, it)}>Substituto</Button>}
                    <button type="button" className="text-xs text-slate-400 hover:text-red-600" onClick={() => remover(detalhe, it)}>remover</button>
                  </div>
                </li>
              );
            })}
          </ul>
          {sugestoes && (
            <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 p-3">
              <p className="text-sm font-semibold text-ibbiNavy">Substituto para {sugestoes.item.funcao}</p>
              <p className="text-xs text-slate-500">Mesma função ou ministério, livres nessa data.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {sugestoes.lista.map((p) => <Button key={p.id} variant="outline" className="text-xs" onClick={() => convidar(detalhe, sugestoes.item.funcao, p.id)}>{p.nome}</Button>)}
                {!sugestoes.lista.length && <span className="text-xs text-slate-400">Nenhuma sugestão. Busque abaixo.</span>}
              </div>
              <div className="mt-2"><PersonPicker onPick={(p) => convidar(detalhe, sugestoes.item.funcao, p._id)} congregacao={detalhe.congregacao} placeholder="Ou buscar outra pessoa" /></div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
