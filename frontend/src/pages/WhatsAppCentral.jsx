import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import WhatsAppThread, { WA, hora, dia } from '../components/WhatsAppThread';
import useCongregacaoScope from '../hooks/useCongregacaoScope';
import useAuth from '../hooks/useAuth';

const initials = (nome) => String(nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function Avatar({ nome, fotoUrl, size = 'w-11 h-11' }) {
  const [falhou, setFalhou] = useState(false);
  if (fotoUrl && !falhou) return <img src={fotoUrl} alt="" onError={() => setFalhou(true)} className={`${size} rounded-full object-cover shrink-0`} />;
  return <div className={`${size} rounded-full bg-slate-300 text-white flex items-center justify-center text-sm font-semibold shrink-0`}>{initials(nome)}</div>;
}

const quando = (d) => {
  if (!d) return '';
  const label = dia(d);
  return label === 'Hoje' ? hora(d) : label === 'Ontem' ? 'Ontem' : new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

// Central de WhatsApp (admin/master): registro das mensagens enviadas a cada pessoa
// das congregações que o usuário gere. Cada membro vê só as suas em "Meu WhatsApp".
// Campo de envio dentro da conversa (usa o mesmo envio individual da Comunicação).
function Composer({ person, onSent }) {
  const [texto, setTexto] = useState('');
  const [sending, setSending] = useState(false);
  const [erro, setErro] = useState('');
  const enviar = async () => {
    if (!texto.trim()) return;
    setSending(true);
    setErro('');
    try {
      await api.post('/messages/send-individual', { personId: person.personId, mensagem: texto.trim() });
      setTexto('');
      onSent();
    } catch (err) {
      setErro(err?.response?.data?.message || 'Falha ao enviar');
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="flex-1 flex flex-col gap-1">
      <div className="flex items-end gap-2">
        <textarea
          rows={1}
          className="flex-1 min-w-0 resize-none rounded-2xl bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 max-h-32"
          placeholder={person.celular ? `Mensagem para ${person.nome.split(' ')[0]} — use {nome} para personalizar` : 'Pessoa sem celular cadastrado'}
          value={texto}
          disabled={!person.celular || sending}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
        />
        <button
          type="button"
          onClick={enviar}
          disabled={!texto.trim() || sending || !person.celular}
          className="w-10 h-10 rounded-full text-white flex items-center justify-center disabled:opacity-40 shrink-0"
          style={{ background: '#00a884' }}
          aria-label="Enviar"
        >
          {sending ? '…' : '➤'}
        </button>
      </div>
      {erro && <p className="text-xs text-red-600 px-2">{erro}</p>}
    </div>
  );
}

export default function WhatsAppCentral({ embedded = false }) {
  const { user } = useAuth();
  const { options: congregacaoOptions } = useCongregacaoScope();
  const [congregacao, setCongregacao] = useState('Todos');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [thread, setThread] = useState(null);

  const load = useCallback(async () => {
    const { data: d } = await api.get('/whatsapp-panel/contacts', { params: { search: search || undefined, congregacao } });
    setData(d);
  }, [search, congregacao]);

  useEffect(() => {
    const t = setTimeout(() => { load().catch(() => setData({ contatos: [], totais: {} })); }, 250);
    return () => clearTimeout(t);
  }, [load]);

  const loadThread = useCallback((person, { silent = false } = {}) => {
    if (!person) return;
    if (!silent) setThread(null);
    api.get(`/whatsapp-panel/person/${person.personId}`).then((r) => setThread(r.data)).catch(() => setThread({ itens: [] }));
  }, []);
  useEffect(() => { loadThread(selected); }, [selected, loadThread]);

  return (
    <div>
      <div className="mb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-2">
        <div>
          {!embedded && <h1 className="font-display text-2xl md:text-3xl text-ibbiNavy">Central de WhatsApp</h1>}
          <p className="text-xs md:text-sm text-slate-500">
            Registro de tudo o que foi enviado para cada pessoa{user?.role === 'master' ? '' : ' das suas congregações'} (últimos {data?.periodoDias || 180} dias).
            {data?.totais && <> · {data.totais.conversas} conversas · {data.totais.mensagens} mensagens{data.totais.erros ? <span className="text-red-600"> · {data.totais.erros} não entregues</span> : null}</>}
          </p>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden shadow-soft border border-black/5 bg-white flex h-[calc(100vh-10rem)] min-h-[480px]">
        {/* Lista de conversas */}
        <aside className={`${selected ? 'hidden lg:flex' : 'flex'} w-full lg:w-[340px] xl:w-[380px] flex-col border-r border-slate-200 shrink-0`}>
          <div className="px-3 py-3 border-b border-slate-100 space-y-2" style={{ background: '#f0f2f5' }}>
            <input
              className="w-full rounded-lg bg-white px-3 py-2 text-sm border border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="Pesquisar pessoa"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {congregacaoOptions.length > 1 && (
              <select className="w-full rounded-lg bg-white px-3 py-1.5 text-sm" value={congregacao} onChange={(e) => setCongregacao(e.target.value)} aria-label="Congregação">
                <option value="Todos">{user?.role === 'master' ? 'Todas as congregações' : 'Minhas congregações'}</option>
                {congregacaoOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
          <ul className="flex-1 overflow-y-auto">
            {!data && <li className="p-4 text-sm text-slate-500">Carregando...</li>}
            {data?.contatos?.length === 0 && <li className="p-4 text-sm text-slate-500">{search ? 'Ninguém encontrado.' : 'Nenhuma mensagem registrada ainda.'}</li>}
            {data?.contatos?.map((c) => (
              <li key={c.personId}>
                <button
                  type="button"
                  onClick={() => setSelected(c)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 border-b border-slate-100 ${selected?.personId === c.personId ? 'bg-slate-100' : ''}`}
                >
                  <Avatar nome={c.nome} fotoUrl={c.fotoUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-medium text-[15px] text-slate-900 truncate">{c.nome}</p>
                      <span className="text-[11px] shrink-0" style={{ color: c.erros ? '#dc2626' : WA.meta }}>{quando(c.ultima)}</span>
                    </div>
                    <p className="text-[13px] truncate" style={{ color: WA.meta }}>
                      {c.ultima ? <>{c.ultimoTipo && <strong className="font-medium">{c.ultimoTipo}: </strong>}{c.preview}</> : <em>Sem mensagens</em>}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{c.congregacao} · {c.celular}{c.erros ? <span className="text-red-600"> · {c.erros} não entregue(s)</span> : ''}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Conversa */}
        <section className={`${selected ? 'flex' : 'hidden lg:flex'} flex-1 min-w-0 flex-col`}>
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8" style={{ background: '#f8f9fa' }}>
              <p className="font-display text-xl text-ibbiNavy">Selecione uma pessoa</p>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">Veja o histórico de aniversário, boas-vindas, mensagens de ausência, avisos e conversas com o assistente.</p>
            </div>
          ) : (
            <WhatsAppThread
              loading={!thread}
              itens={thread?.itens || []}
              showErrors
              emptyText="Nenhuma mensagem enviada para esta pessoa ainda."
              header={(
                <div className="flex items-center gap-3">
                  <button type="button" className="lg:hidden text-white/90 text-lg" onClick={() => setSelected(null)} aria-label="Voltar">←</button>
                  <Avatar nome={selected.nome} fotoUrl={selected.fotoUrl} size="w-10 h-10" />
                  <div className="min-w-0">
                    <p className="font-semibold leading-tight truncate">{selected.nome}</p>
                    <p className="text-xs text-white/75 truncate">{selected.celular} · {selected.congregacao}{selected.tipo ? ` · ${selected.tipo}` : ''}</p>
                  </div>
                </div>
              )}
              footer={<Composer person={selected} onSent={() => { loadThread(selected, { silent: true }); load(); }} />}
            />
          )}
        </section>
      </div>
    </div>
  );
}
