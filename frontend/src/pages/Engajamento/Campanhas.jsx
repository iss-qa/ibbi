import { useCallback, useEffect, useState } from 'react';
import Header from '../../components/Header';
import api from '../../services/api';
import { Card, Button, Field, Modal, inputClass } from '../../components/ui';
import { CONGREGACOES } from '../../constants/congregacoes';

const STATUS = { agendada: ['⏰', 'Agendada'], enviando: ['📤', 'Enviando'], pausada: ['⏸️', 'Pausada (limite diário)'], concluida: ['✅', 'Concluída'], cancelada: ['❌', 'Cancelada'] };
const TIPO = { sermao: '📖 Sermão', evento: '🎟️ Evento', lembrete: '🔔 Lembrete', aviso: '📣 Aviso' };
const TIPOS_PESSOA = [['membro', 'Membros'], ['congregado', 'Congregados'], ['novo decidido', 'Novos decididos'], ['visitante', 'Visitantes']];
const fmt = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const amanha9h = () => { const d = new Date(Date.now() + 864e5); d.setHours(9, 0, 0, 0); return d.toISOString().slice(0, 16); };

// Envios em massa graduais (anti-bloqueio): resumo do sermão e avisos para a igreja.
export default function Campanhas() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState(null);
  const [previa, setPrevia] = useState(null);
  const [organizando, setOrganizando] = useState(false);
  const [erro, setErro] = useState('');

  const load = useCallback(async () => setLista((await api.get('/campanhas')).data), []);
  useEffect(() => { load().catch(() => {}); const t = setInterval(() => load().catch(() => {}), 20000); return () => clearInterval(t); }, [load]);

  // Prévia de quantas pessoas recebem (descadastrados ficam fora)
  useEffect(() => {
    if (!form) return;
    api.get('/campanhas/publico', { params: { congregacao: form.congregacao || undefined, tipos: form.tipos.join(',') } }).then((r) => setPrevia(r.data)).catch(() => setPrevia(null));
  }, [form?.congregacao, form?.tipos.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const novo = (tipo) => { setErro(''); setForm({ tipo, titulo: tipo === 'sermao' ? `Sermão de ${new Date().toLocaleDateString('pt-BR')}` : '', relato: '', texto: '', congregacao: '', tipos: ['membro', 'congregado', 'novo decidido'], enviarApos: tipo === 'sermao' ? amanha9h() : '' }); };
  const organizar = async () => {
    setOrganizando(true); setErro('');
    try { const { data } = await api.post('/campanhas/sermao/organizar', { relato: form.relato }); setForm((f) => ({ ...f, texto: data.texto })); }
    catch (e) { setErro(e.response?.data?.message || 'Falha ao organizar'); }
    finally { setOrganizando(false); }
  };
  const salvar = async () => {
    setErro('');
    try {
      await api.post('/campanhas', { ...form, enviarApos: form.enviarApos ? new Date(form.enviarApos).toISOString() : undefined });
      setForm(null); load();
    } catch (e) { setErro(e.response?.data?.message || 'Não foi possível agendar'); }
  };
  const cancelar = async (c) => { if (window.confirm(`Cancelar "${c.titulo}"? Quem ainda não recebeu não vai receber.`)) { await api.post(`/campanhas/${c.id}/cancelar`); load(); } };
  const togglePublico = (t) => setForm((f) => ({ ...f, tipos: f.tipos.includes(t) ? f.tipos.filter((x) => x !== t) : [...f.tipos, t] }));

  return (
    <div>
      <Header title="Campanhas" subtitle="Resumo do sermão e avisos para a igreja, enviados aos poucos para proteger o número"
        action={<div className="flex gap-2"><Button variant="gold" onClick={() => novo('sermao')}>📖 Resumo do sermão</Button><Button variant="outline" onClick={() => novo('aviso')}>📣 Aviso</Button></div>} />
      <p className="mb-4 text-xs text-slate-500">Ritmo seguro: ~50 mensagens por hora, até 400 por dia, das 8h às 21h. Envios grandes continuam no dia seguinte automaticamente. Quem respondeu SAIR não recebe.</p>

      {!lista.length && <Card><p className="text-sm text-slate-400">Nenhuma campanha ainda.</p></Card>}
      <div className="space-y-3">
        {lista.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl border border-stone-100 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs text-slate-500">{TIPO[c.tipo]} · {c.publico?.descricao || 'igreja'} · agendada para {fmt(c.enviarApos)}{c.criadoPorNome ? ` · por ${c.criadoPorNome}` : ''}</p>
                <p className="font-semibold text-ibbiNavy">{c.titulo}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{STATUS[c.status][0]} {STATUS[c.status][1]}</span>
                {['agendada', 'enviando', 'pausada'].includes(c.status) && <button type="button" className="text-xs text-slate-400 hover:text-red-600" onClick={() => cancelar(c)}>cancelar</button>}
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-ibbiGold" style={{ width: `${c.progresso}%` }} /></div>
            <p className="mt-1.5 text-xs text-slate-500 tabular-nums">✅ {c.enviados} enviadas · ⏳ {c.pendentes} na fila · 🔕 {c.bloqueados} descadastrados · ⚠️ {c.erros} erros · total {c.total}{c.pendentes && c.diasEstimados > 1 ? ` · ~${c.diasEstimados} dias` : ''}</p>
          </div>
        ))}
      </div>

      {form && (
        <Modal title={form.tipo === 'sermao' ? '📖 Resumo do sermão' : '📣 Aviso para a igreja'} onClose={() => setForm(null)} wide
          footer={<><Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button><Button variant="gold" disabled={!form.titulo || !form.texto || !previa?.recebem} onClick={salvar}>Agendar envio para {previa?.recebem ?? '…'} pessoa(s)</Button></>}>
          <div className="space-y-3">
            <Field label="Título (só para você identificar)"><input className={inputClass} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></Field>
            {form.tipo === 'sermao' && (
              <Field label="Conte o sermão" hint="Texto bíblico, pontos principais e aplicação. A IA organiza com perguntas para reflexão, sem inventar nada.">
                <textarea className={`${inputClass} min-h-[120px]`} value={form.relato} onChange={(e) => setForm({ ...form, relato: e.target.value })} />
                <Button variant="outline" className="mt-2" disabled={organizando || form.relato.length < 30} onClick={organizar}>{organizando ? 'Organizando…' : '✨ Organizar com IA'}</Button>
              </Field>
            )}
            <Field label="Mensagem" hint="Começa com &quot;Olá, (nome)!&quot; e termina com o aviso de como sair. Use *negrito* e _itálico_ do WhatsApp.">
              <textarea className={`${inputClass} min-h-[180px]`} maxLength={3500} value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Congregação">
                <select className={inputClass} value={form.congregacao} onChange={(e) => setForm({ ...form, congregacao: e.target.value })}>
                  <option value="">Todas</option>{CONGREGACOES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Enviar a partir de"><input type="datetime-local" className={inputClass} value={form.enviarApos} onChange={(e) => setForm({ ...form, enviarApos: e.target.value })} /></Field>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              {TIPOS_PESSOA.map(([v, l]) => (
                <label key={v} className={`px-3 py-1.5 rounded-lg border cursor-pointer ${form.tipos.includes(v) ? 'bg-ibbiNavy text-white border-ibbiNavy' : 'bg-white border-slate-200'}`}>
                  <input type="checkbox" className="sr-only" checked={form.tipos.includes(v)} onChange={() => togglePublico(v)} />{l}
                </label>
              ))}
            </div>
            {previa && <p className="text-sm text-slate-600">👥 <strong>{previa.recebem}</strong> pessoa(s) vão receber{previa.descadastrados ? ` · 🔕 ${previa.descadastrados} descadastrada(s) ficam de fora` : ''}.</p>}
            {erro && <p className="text-sm text-red-600">{erro}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
