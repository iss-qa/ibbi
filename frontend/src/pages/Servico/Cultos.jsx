import { useCallback, useEffect, useState } from 'react';
import Header from '../../components/Header';
import api from '../../services/api';
import { Card, Button, Field, Modal, inputClass } from '../../components/ui';
import { CONGREGACOES } from '../../constants/congregacoes';
import PersonPicker from '../Encontros/PersonPicker';

const fmtHora = (d) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// Presença no culto por QR Code: o QR abre o WhatsApp da igreja com "CHEGUEI <código>".
export default function Cultos() {
  const [lista, setLista] = useState([]);
  const [numeroOk, setNumeroOk] = useState(true);
  const [form, setForm] = useState({ congregacao: CONGREGACOES[0] || 'Sede', titulo: 'Culto' });
  const [aberto, setAberto] = useState(null); // detalhe com QR
  const [telao, setTelao] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  // Convite fica fixo enquanto o modal está aberto (a lista de presentes atualiza a cada 15s)
  const [convite, setConvite] = useState(null);
  const [aviso, setAviso] = useState('');

  const load = useCallback(async () => {
    const { data } = await api.get('/cultos');
    setLista(data.cultos || []);
    setNumeroOk(data.numeroConfigurado);
  }, []);
  useEffect(() => { load().catch((e) => setErro(e.response?.data?.message || 'Falha ao carregar')); }, [load]);

  const abrir = async () => {
    setLoading(true);
    setErro('');
    try {
      const { data } = await api.post('/cultos', form);
      setAberto(data);
      load();
    } catch (e) {
      setErro(e.response?.data?.message || 'Não foi possível abrir o check-in');
    } finally {
      setLoading(false);
    }
  };
  const ver = async (id) => setAberto((await api.get(`/cultos/${id}`)).data);

  useEffect(() => { setConvite(aberto?.convite || null); setAviso(''); }, [aberto?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const outraFrase = async () => {
    const { data } = await api.get(`/cultos/${aberto.id}`);
    setConvite(data.convite);
  };
  const compartilhar = async () => {
    if (navigator.share) {
      try { await navigator.share({ text: convite.texto }); return; } catch (e) { if (e?.name === 'AbortError') return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(convite.texto)}`, '_blank', 'noopener');
  };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(convite.texto); setAviso('Convite copiado ✅'); } catch { setAviso('Não foi possível copiar. Selecione o texto e copie.'); }
  };
  const enviarLideranca = async () => {
    setAviso('');
    try {
      const { data } = await api.post(`/cultos/${aberto.id}/lideranca`);
      setAviso(`QR e convite na fila para ${data.destinatarios} contato(s) da liderança 📲`);
    } catch (e) {
      setAviso(e.response?.data?.message || 'Não foi possível enviar à liderança.');
    }
  };
  const encerrar = async () => {
    await api.post(`/cultos/${aberto.id}/encerrar`);
    setAberto(null);
    setTelao(false);
    load();
  };
  const addPresenca = async (p) => setAberto((await api.post(`/cultos/${aberto.id}/presencas`, { personId: p._id })).data);

  // Atualiza a lista de presentes a cada 15s enquanto o QR está aberto.
  useEffect(() => {
    if (!aberto?.aberto) return undefined;
    const t = setInterval(() => ver(aberto.id).catch(() => {}), 15000);
    return () => clearInterval(t);
  }, [aberto?.id, aberto?.aberto]);

  return (
    <div>
      <Header title="Cultos" subtitle="Presença por QR Code: o membro aponta a câmera e confirma pelo WhatsApp" />

      {!numeroOk && (
        <p className="mb-4 text-sm bg-amber-50 border border-amber-100 text-amber-800 rounded-lg px-3 py-2">
          Para gerar o QR Code, informe o <strong>número do WhatsApp da igreja</strong> em Configurações → WhatsApp.
        </p>
      )}
      {erro && <p className="mb-4 text-sm bg-red-50 border border-red-100 text-red-700 rounded-lg px-3 py-2">{erro}</p>}

      <div className="grid lg:grid-cols-[360px_1fr] gap-4 items-start">
        <Card title="Abrir check-in de hoje" subtitle="Reaproveita o check-in já aberto na congregação">
          <div className="space-y-3">
            <Field label="Congregação">
              <select className={inputClass} value={form.congregacao} onChange={(e) => setForm({ ...form, congregacao: e.target.value })}>
                {CONGREGACOES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Título" hint="Ex.: Culto de domingo, Culto de oração, Santa Ceia">
              <input className={inputClass} value={form.titulo} maxLength={80} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </Field>
            <Button variant="gold" className="w-full" disabled={loading} onClick={abrir}>{loading ? 'Abrindo…' : '⛪ Abrir check-in e gerar QR'}</Button>
            <p className="text-xs text-slate-500 leading-relaxed">
              Membro cadastrado: presença na hora. Número desconhecido: o assistente pede o nome, cadastra como visitante
              e ele entra na jornada de 30 dias. Quem não faz check-in não recebe falta.
            </p>
          </div>
        </Card>

        <Card title="Últimos cultos">
          {!lista.length && <p className="text-sm text-slate-400">Nenhum culto com check-in ainda.</p>}
          <div className="divide-y divide-slate-100">
            {lista.map((c) => (
              <button key={c.id} type="button" onClick={() => ver(c.id)} className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-slate-50 px-1 rounded">
                <div>
                  <p className="font-medium text-ibbiNavy">{c.titulo} <span className="text-slate-400 font-normal">· {c.congregacao}</span></p>
                  <p className="text-xs text-slate-500">{c.data} · código {c.codigo}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold tabular-nums">{c.presentes} presença(s)</p>
                  <p className="text-xs text-slate-500">{c.visitantes ? `🙋 ${c.visitantes} visitante(s) · ` : ''}{c.aberto ? <span className="text-emerald-600">aberto</span> : 'encerrado'}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {aberto && !telao && (
        <Modal title={`${aberto.titulo} · ${aberto.congregacao}`} onClose={() => setAberto(null)} wide
          footer={(
            <>
              {aberto.aberto && aberto.qr && <Button variant="outline" onClick={() => setTelao(true)}>🖥️ Mostrar no telão</Button>}
              {aberto.aberto && <Button variant="danger" onClick={encerrar}>Encerrar check-in</Button>}
            </>
          )}
        >
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="text-center">
              {aberto.qr ? <img src={aberto.qr} alt={`QR Code do check-in ${aberto.codigo}`} className="w-full max-w-[280px] mx-auto rounded-lg border border-slate-100" /> : <p className="text-sm text-slate-400">QR indisponível (número da igreja não configurado).</p>}
              <p className="mt-2 text-sm text-slate-600">ou envie <strong className="font-mono">CHEGUEI {aberto.codigo}</strong></p>
            </div>
            <div>
              <p className="font-semibold text-ibbiNavy">{aberto.presentes} presença(s){aberto.visitantes ? ` · 🙋 ${aberto.visitantes} visitante(s)` : ''}</p>
              {aberto.aberto && <div className="mt-2"><PersonPicker onPick={addPresenca} placeholder="Marcar presença manual (recepção)" /></div>}
              <ul className="mt-3 max-h-64 overflow-y-auto text-sm divide-y divide-slate-50">
                {aberto.presencas.map((p) => (
                  <li key={`${p.personId}-${p.em}`} className="py-1.5 flex justify-between gap-2">
                    <span>{p.nome}{p.visitante && <span className="ml-1 text-xs text-amber-700">🙋 visitante</span>}</span>
                    <span className="text-xs text-slate-400">{fmtHora(p.em)} · {p.via === 'qr' ? 'QR' : p.via === 'web' ? 'recepção' : p.via}</span>
                  </li>
                ))}
                {!aberto.presencas.length && <li className="py-2 text-slate-400">Ninguém fez check-in ainda.</li>}
              </ul>
            </div>
          </div>
          {aberto.aberto && convite && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="font-semibold text-ibbiNavy">📤 Convite para os grupos</p>
                <button type="button" className="text-xs text-ibbiBlue hover:underline" onClick={outraFrase}>🔀 Outra frase</button>
              </div>
              <p className="text-xs text-slate-500 mb-2">A liderança encaminha nos grupos da igreja. O link mostra o logo da igreja e abre o WhatsApp com o check-in pronto; não informa quantos já estão presentes.</p>
              <pre className="whitespace-pre-wrap break-words font-sans text-sm bg-[#efe7dd] text-slate-800 rounded-xl p-3 max-h-56 overflow-y-auto">{convite.texto}</pre>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="gold" onClick={compartilhar}>📤 Compartilhar</Button>
                <Button variant="outline" onClick={copiar}>Copiar texto</Button>
                <Button variant="outline" onClick={enviarLideranca}>📲 Enviar QR à liderança</Button>
              </div>
              {aviso && <p className="text-sm text-slate-700 mt-2">{aviso}</p>}
            </div>
          )}
        </Modal>
      )}

      {aberto && telao && (
        <div className="fixed inset-0 z-[80] bg-ibbiNavy text-white flex flex-col items-center justify-center p-6" onClick={() => setTelao(false)} role="presentation">
          <p className="font-display text-3xl sm:text-5xl text-ibbiGold text-center">{aberto.titulo}</p>
          <p className="mt-2 text-white/70 text-lg">Aponte a câmera e confirme sua presença no WhatsApp</p>
          <img src={aberto.qr} alt="QR Code do check-in" className="mt-6 w-[min(70vh,80vw)] bg-white rounded-2xl p-3" />
          <p className="mt-5 text-2xl">ou envie <strong className="font-mono text-ibbiGold">CHEGUEI {aberto.codigo}</strong></p>
          <p className="mt-3 text-white/60">{aberto.presentes} presença(s) confirmada(s) · toque para sair</p>
        </div>
      )}
    </div>
  );
}
