import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/Header';
import api from '../../services/api';
import { Card, Button, Field, Modal, inputClass } from '../../components/ui';
import { CONGREGACOES } from '../../constants/congregacoes';
import PersonPicker from '../Encontros/PersonPicker';

const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const STATUS = { inscrito: ['🟡', 'Inscrito', 'bg-amber-50 text-amber-700'], pago: ['✅', 'Pago', 'bg-emerald-50 text-emerald-700'], espera: ['⏳', 'Espera', 'bg-slate-100 text-slate-600'] };
const novoEvento = () => ({ titulo: '', data: '', horario: '', local: '', descricao: '', congregacao: '', vagas: '', valor: '' });

// Eventos com inscrição pelo WhatsApp ("INSCREVER <código>") e Pix com valor.
export default function Eventos() {
  const [lista, setLista] = useState([]);
  const [pixOk, setPixOk] = useState(true);
  const [form, setForm] = useState(null);
  const [det, setDet] = useState(null);
  const [pix, setPix] = useState(null);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  const load = useCallback(async () => { const { data } = await api.get('/eventos'); setLista(data.eventos); setPixOk(data.pixConfigurado); }, []);
  useEffect(() => { load().catch(() => {}); }, [load]);
  const abrir = async (id) => { setPix(null); setDet((await api.get(`/eventos/${id}`)).data); };

  const salvar = async () => {
    setErro('');
    try { await api.post('/eventos', form); setForm(null); load(); } catch (e) { setErro(e.response?.data?.message || 'Não foi possível salvar'); }
  };
  const status = async (insc, s) => { await api.put(`/eventos/${det.id}/inscricoes/${insc._id}`, { status: s }); abrir(det.id); load(); };
  const inscrever = async (p) => { await api.post(`/eventos/${det.id}/inscricoes`, { personId: p._id }); abrir(det.id); load(); };
  const divulgar = async () => {
    if (!window.confirm('Divulgar para a igreja pelo WhatsApp? O envio é gradual e quem respondeu SAIR não recebe.')) return;
    const { data } = await api.post(`/eventos/${det.id}/divulgar`, {});
    setMsg(`📣 Divulgação na fila para ${data.pendentes} pessoa(s). Acompanhe em Campanhas.`); setDet(null);
  };
  const verPix = async () => setPix((await api.get(`/eventos/${det.id}/pix`)).data);
  const encerrar = async (aberto) => { await api.put(`/eventos/${det.id}`, { inscricoesAbertas: aberto }); abrir(det.id); load(); };

  return (
    <div>
      <Header title="Eventos e inscrições" subtitle="A pessoa responde INSCREVER + código no WhatsApp; evento pago recebe o Pix na hora"
        action={<Button variant="gold" onClick={() => { setErro(''); setForm(novoEvento()); }}>+ Novo evento</Button>} />
      {!pixOk && <p className="mb-4 text-sm bg-amber-50 border border-amber-100 text-amber-800 rounded-lg px-3 py-2">Para eventos pagos, configure a <strong>chave Pix</strong> em <Link to="/configuracoes?aba=igreja" className="underline">Configurações → Igreja</Link>.</p>}
      {msg && <p className="mb-4 text-sm bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg px-3 py-2">{msg}</p>}

      {!lista.length && <Card><p className="text-sm text-slate-400">Nenhum evento próximo.</p></Card>}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {lista.map((e) => (
          <button key={e.id} type="button" onClick={() => abrir(e.id)} className="text-left bg-white rounded-2xl border border-stone-100 p-4 hover:shadow-soft transition">
            <p className="text-xs text-slate-500">{e.data}{e.horario ? ` · ${e.horario}` : ''}{e.congregacao ? ` · ${e.congregacao}` : ''}</p>
            <p className="font-display text-lg text-ibbiNavy">{e.titulo}</p>
            <p className="text-sm text-slate-600">{e.valor ? brl(e.valor) : 'Gratuito'} · código <strong className="font-mono">{e.codigo}</strong></p>
            <p className="mt-2 text-sm tabular-nums">🎟️ {e.inscritos}{e.vagas ? `/${e.vagas}` : ''}{e.valor ? ` · ✅ ${e.pagos} pagos` : ''}{e.espera ? ` · ⏳ ${e.espera}` : ''}{!e.inscricoesAbertas ? ' · 🔒 encerradas' : ''}</p>
          </button>
        ))}
      </div>

      {form && (
        <Modal title="Novo evento" onClose={() => setForm(null)} wide footer={<Button variant="gold" disabled={!form.titulo || !form.data} onClick={salvar}>Criar evento</Button>}>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Field label="Nome do evento"><input className={inputClass} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: Retiro de Jovens 2026" /></Field></div>
            <Field label="Data"><input type="date" className={inputClass} value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></Field>
            <Field label="Horário"><input type="time" className={inputClass} value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} /></Field>
            <Field label="Local"><input className={inputClass} value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} /></Field>
            <Field label="Congregação"><select className={inputClass} value={form.congregacao} onChange={(e) => setForm({ ...form, congregacao: e.target.value })}><option value="">Toda a igreja</option>{CONGREGACOES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Vagas" hint="Vazio = ilimitado. Lotou: entra na lista de espera."><input type="number" min="1" className={inputClass} value={form.vagas} onChange={(e) => setForm({ ...form, vagas: e.target.value })} /></Field>
            <Field label="Valor (R$)" hint="0 ou vazio = gratuito"><input type="number" min="0" step="0.01" className={inputClass} value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Descrição (vai na divulgação)"><textarea className={`${inputClass} min-h-[90px]`} maxLength={1500} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></Field></div>
          </div>
          {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
        </Modal>
      )}

      {det && (
        <Modal title={det.titulo} onClose={() => setDet(null)} wide
          footer={(
            <>
              <Button variant="ghost" onClick={() => encerrar(!det.inscricoesAbertas)}>{det.inscricoesAbertas ? '🔒 Encerrar inscrições' : '🔓 Reabrir inscrições'}</Button>
              {det.valor > 0 && <Button variant="outline" onClick={verPix}>Ver Pix</Button>}
              <Button variant="gold" onClick={divulgar}>📣 Divulgar no WhatsApp</Button>
            </>
          )}>
          <p className="text-sm text-slate-600">{det.data}{det.horario ? ` às ${det.horario}` : ''}{det.local ? ` · ${det.local}` : ''} · {det.valor ? brl(det.valor) : 'gratuito'} · inscrição: <strong className="font-mono">INSCREVER {det.codigo}</strong></p>
          <p className="mt-1 text-sm tabular-nums">🎟️ {det.inscritos}{det.vagas ? `/${det.vagas}` : ''} inscritos{det.valor ? ` · ✅ ${det.pagos} pagos` : ''}{det.espera ? ` · ⏳ ${det.espera} na espera` : ''}</p>
          {pix && (pix.pix ? (
            <div className="mt-3 flex gap-3 items-start rounded-xl bg-slate-50 border border-slate-100 p-3">
              <img src={pix.pix.qr} alt="QR Code Pix de exemplo" className="w-28 h-28" />
              <div className="text-xs break-all"><p className="font-semibold text-ibbiNavy mb-1">Exemplo do Pix que cada inscrito recebe (com identificador próprio):</p>{pix.pix.copiaECola}</div>
            </div>
          ) : <p className="mt-3 text-sm text-amber-700">{pix.motivo}</p>)}
          <div className="mt-3"><PersonPicker onPick={inscrever} placeholder="Inscrever alguém manualmente" /></div>
          <ul className="mt-3 divide-y divide-slate-100 max-h-72 overflow-y-auto text-sm">
            {det.inscricoes.map((i) => (
              <li key={i._id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <span>{i.nome}{i.celular ? <span className="text-xs text-slate-400"> · {i.celular}</span> : null}{i.origem === 'whatsapp' ? <span className="text-xs text-slate-400"> · WhatsApp</span> : null}</span>
                <span className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS[i.status]?.[2]}`}>{STATUS[i.status]?.[0]} {STATUS[i.status]?.[1]}</span>
                  {det.valor > 0 && i.status === 'inscrito' && <Button variant="outline" className="text-xs" onClick={() => status(i, 'pago')}>Confirmar pagamento</Button>}
                  <button type="button" className="text-xs text-slate-400 hover:text-red-600" onClick={() => status(i, 'cancelado')}>cancelar</button>
                </span>
              </li>
            ))}
            {!det.inscricoes.length && <li className="py-2 text-slate-400">Ninguém inscrito ainda.</li>}
          </ul>
        </Modal>
      )}
    </div>
  );
}
