import { useCallback, useEffect, useState } from 'react';
import Header from '../components/Header';
import api from '../services/api';
import useAuth from '../hooks/useAuth';
import { Modal } from '../components/ui';
import PersonPicker from './Encontros/PersonPicker';

// Formulário de novo pedido (membro na página; liderança no modal "Novo pedido").
function PrayerForm({ onSent }) {
  const [confidencial, setConfidencial] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [status, setStatus] = useState(''); // '', 'enviando', 'ok', 'erro'
  const [feedback, setFeedback] = useState('');

  const handleSend = async (e) => {
    e.preventDefault();
    setStatus('enviando');
    setFeedback('');
    try {
      await api.post('/prayer/send', { mensagem, confidencial });
      setMensagem('');
      setStatus('ok');
      setFeedback('Pedido enviado com sucesso! A equipe de intercessão estará orando por você.');
      onSent?.();
    } catch (err) {
      setStatus('erro');
      setFeedback(err.response?.data?.message || 'Falha ao enviar o pedido. Tente novamente mais tarde.');
    }
  };

  return (
          <form onSubmit={handleSend} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">Seu pedido</label>
              <textarea
                className="w-full border border-slate-200 rounded-xl p-4 bg-slate-50 min-h-[160px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:bg-white transition resize-none"
                placeholder="Escreva aqui detalhadamente seu pedido de oração..."
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                disabled={status === 'enviando'}
                required
              />
            </div>
            
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={confidencial} onChange={(e) => setConfidencial(e.target.checked)} className="mt-1" />
              <span><strong>Confidencial</strong>: só os pastores veem (não vai para a equipe de intercessão)</span>
            </label>

            <button 
              className={`w-full sm:w-auto font-medium px-6 py-3 rounded-xl transition shadow-sm text-sm flex items-center justify-center gap-2 ${
                status === 'enviando' 
                  ? 'bg-blue-400 cursor-not-allowed text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`} 
              type="submit"
              disabled={status === 'enviando' || !mensagem.trim()}
            >
              {status === 'enviando' ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                  Enviando...
                </>
              ) : 'Enviar pedido'}
            </button>

            {status === 'ok' && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start sm:items-center gap-3 animate-fade-in">
                <span className="text-xl">🙌</span>
                <p className="text-sm font-medium text-emerald-800">{feedback}</p>
              </div>
            )}
            {status === 'erro' && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start sm:items-center gap-3 animate-fade-in">
                <span className="text-xl">⚠️</span>
                <p className="text-sm font-medium text-rose-800">{feedback}</p>
              </div>
            )}
          </form>
  );
}

// Rede de intercessores: recebem no WhatsApp os pedidos NÃO confidenciais (só o primeiro nome de quem pediu).
function Intercessores() {
  const [lista, setLista] = useState([]);
  const [aberto, setAberto] = useState(false);
  const load = useCallback(async () => setLista((await api.get('/intercessores')).data), []);
  useEffect(() => { load().catch(() => {}); }, [load]);
  const marcar = async (personId, intercessor) => { await api.put(`/intercessores/${personId}`, { intercessor }); load(); };
  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-4 mt-2">
      <button type="button" onClick={() => setAberto((v) => !v)} className="w-full flex items-center justify-between text-left">
        <span className="font-semibold text-ibbiNavy">🙏 Rede de intercessores <span className="font-normal text-slate-500">· {lista.length} pessoa(s)</span></span>
        <span className="text-xs text-ibbiBlue">{aberto ? 'fechar' : 'gerenciar'}</span>
      </button>
      {aberto && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-500">Cada pedido não confidencial vai para os intercessores no WhatsApp, e quem pediu recebe "X intercessores estão orando por você". Uma semana depois, perguntamos como está a situação.</p>
          <PersonPicker onPick={(p) => marcar(p._id, true)} placeholder="Adicionar intercessor" />
          <ul className="divide-y divide-slate-50 text-sm">
            {lista.map((p) => (
              <li key={p._id} className="py-1.5 flex justify-between"><span>{p.nome} <span className="text-xs text-slate-400">· {p.congregacao}</span></span><button type="button" className="text-xs text-red-600" onClick={() => marcar(p._id, false)}>remover</button></li>
            ))}
            {!lista.length && <li className="py-1.5 text-slate-400">Ninguém ainda.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

const DIAS = [7, 30, 90];
const STATUS = [['', 'Todos'], ['novo', 'Novos'], ['orado', 'Orados'], ['arquivado', 'Arquivados']];
const fmt = (d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const ORIGEM = { web: 'Portal', whatsapp: 'WhatsApp', importado: 'Histórico' };

// Liderança: a essência é ler os pedidos (inclusive em voz alta no culto).
function PrayerList() {
  const [dias, setDias] = useState(7);
  const [status, setStatus] = useState('');
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState(false);
  const [leitura, setLeitura] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/prayer', { params: { dias, status: status || undefined } });
      setPedidos(data.pedidos || []);
    } finally {
      setLoading(false);
    }
  }, [dias, status]);

  useEffect(() => { load(); }, [load]);

  const mudarStatus = async (id, novoStatus) => {
    const { data } = await api.put(`/prayer/${id}/status`, { status: novoStatus });
    setPedidos((lista) => lista.map((p) => (p._id === id ? data : p)).filter((p) => !status || p.status === status));
  };

  const novos = pedidos.filter((p) => p.status === 'novo').length;

  return (
    <div className="min-h-screen">
      <Header title="Pedidos de Oração" subtitle="O que a igreja pediu para orarmos juntos" />
      <div className="max-w-4xl mx-auto px-4"><Intercessores /></div>

      <div className="max-w-4xl mx-auto px-4 mt-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex bg-white border border-slate-200 rounded-lg p-1 text-sm">
              {DIAS.map((d) => (
                <button key={d} type="button" onClick={() => setDias(d)} className={`px-3 py-1 rounded-md ${dias === d ? 'bg-ibbiNavy text-white font-semibold' : 'text-slate-600'}`}>{d} dias</button>
              ))}
            </div>
            <select className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setLeitura(true)} disabled={!pedidos.length} className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50">📖 Modo leitura</button>
            <button type="button" onClick={() => setNovo(true)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-ibbiGold text-ibbiNavy hover:brightness-95">+ Novo pedido</button>
          </div>
        </div>

        <p className="text-sm text-slate-500">
          {loading ? 'Carregando…' : `${pedidos.length} pedido(s)${novos ? ` · ${novos} ainda não orado(s)` : ''}. No WhatsApp: menu → 11 → 2.`}
        </p>

        {!loading && !pedidos.length && (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400">Nenhum pedido de oração neste período. 🙏</div>
        )}

        <div className="space-y-3">
          {pedidos.map((p) => (
            <article key={p._id} className={`bg-white rounded-2xl border p-5 ${p.status === 'novo' ? 'border-ibbiGold/40' : 'border-slate-100'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-ibbiNavy">{p.nome}</p>
                  <p className="text-xs text-slate-500">{[p.congregacao, fmt(p.createdAt), ORIGEM[p.origem]].filter(Boolean).join(' · ')}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.status === 'orado' ? 'bg-emerald-50 text-emerald-700' : p.status === 'arquivado' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>
                  {p.status === 'orado' ? `Orado${p.oradoPor ? ` por ${p.oradoPor.split(' ')[0]}` : ''}` : p.status === 'arquivado' ? 'Arquivado' : 'Novo'}
                </span>
              </div>
              <p className="mt-3 text-slate-700 whitespace-pre-line leading-relaxed">{p.texto}</p>
              <div className="mt-3 flex gap-2 text-xs">
                {p.status !== 'orado' && <button type="button" onClick={() => mudarStatus(p._id, 'orado')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">🙏 Marcar como orado</button>}
                {p.status !== 'arquivado' && <button type="button" onClick={() => mudarStatus(p._id, 'arquivado')} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Arquivar</button>}
                {p.status !== 'novo' && <button type="button" onClick={() => mudarStatus(p._id, 'novo')} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Reabrir</button>}
              </div>
            </article>
          ))}
        </div>
      </div>

      {novo && (
        <Modal title="Novo pedido de oração" onClose={() => setNovo(false)}>
          <PrayerForm onSent={() => { load(); setTimeout(() => setNovo(false), 1200); }} />
        </Modal>
      )}

      {leitura && (
        <div className="fixed inset-0 z-[70] bg-ibbiNavy text-white overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-10">
            <div className="flex items-center justify-between">
              <p className="text-ibbiGold font-display text-2xl">🙏 Pedidos de oração</p>
              <button type="button" onClick={() => setLeitura(false)} className="text-white/70 hover:text-white text-sm border border-white/20 rounded-lg px-3 py-1.5">Fechar</button>
            </div>
            <ol className="mt-8 space-y-8">
              {pedidos.filter((p) => p.status !== 'arquivado').map((p) => (
                <li key={p._id}>
                  <p className="text-ibbiGold font-semibold text-xl">{p.nome}{p.congregacao ? <span className="text-white/50 font-normal"> · {p.congregacao}</span> : null}</p>
                  <p className="mt-2 text-2xl leading-relaxed">{p.texto}</p>
                </li>
              ))}
            </ol>
            <p className="mt-12 text-white/50 italic">“Orai uns pelos outros.” (Tiago 5:16)</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PrayerRequest() {
  const { user } = useAuth();
  if (['admin', 'master'].includes(user?.role)) return <PrayerList />;
  return (
    <div className="min-h-screen">
      <Header title="Pedido de Oração" subtitle="Envie sua solicitação com segurança" />
      <div className="max-w-2xl mx-auto px-4 mt-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
          <PrayerForm />
        </div>
      </div>
    </div>
  );
}
