import { useEffect, useState } from 'react';
import Header from '../../components/Header';
import api from '../../services/api';
import { CONGREGACOES } from '../../constants/congregacoes';

const grupos = ['criança', 'adolescente', 'jovem', 'adulto 1', 'adulto 2', 'idoso', 'ancião'];

const STATUS_STYLE = {
  concluido: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  erro: 'bg-red-50 text-red-600 border border-red-200',
  enviando: 'bg-amber-50 text-amber-700 border border-amber-200',
  pendente: 'bg-slate-100 text-slate-500 border border-slate-200',
};

const STATUS_DOT = {
  concluido: 'bg-emerald-500',
  erro: 'bg-red-500',
  enviando: 'bg-amber-400',
  pendente: 'bg-slate-400',
};

const TIPO_ICON = {
  aniversario: '🎂',
  aviso: '📢',
  reunião: '📅',
  convite: '✉️',
  oracao: '🙏',
  personalizada: '💬',
};

const inputClass =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition placeholder:text-slate-400';

const textareaClass =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition placeholder:text-slate-400 resize-none';

function SectionCard({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-100 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function SendTab({ label, icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${active
        ? 'bg-blue-600 text-white shadow-sm'
        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
        }`}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}

export default function CommunicationPanel() {
  const [activeTab, setActiveTab] = useState('grupo');
  const [grupo, setGrupo] = useState('');
  const [congregacao, setCongregacao] = useState('Sede');
  const [mensagemGrupo, setMensagemGrupo] = useState('');
  const [mensagemCongregacao, setMensagemCongregacao] = useState('');
  const [mensagemIndividual, setMensagemIndividual] = useState('');
  const [individual, setIndividual] = useState({ personId: '', celular: '' });
  const [toast, setToast] = useState('');
  const [log, setLog] = useState([]);
  const [filters, setFilters] = useState({ tipo: '', status: '' });
  const [showMessage, setShowMessage] = useState(null);
  const [prayerLog, setPrayerLog] = useState([]);
  const [showPrayer, setShowPrayer] = useState(false);
  const [sending, setSending] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadLog = async () => {
    const { data } = await api.get('/messages/log');
    setLog(data);
  };

  const loadPrayerLog = async () => {
    const { data } = await api.get('/messages/prayer-log');
    setPrayerLog(data);
  };

  useEffect(() => {
    loadLog();
    loadPrayerLog();
  }, []);

  const handleByGroup = async () => {
    setSending(true);
    await api.post('/messages/send-by-group', { grupo, mensagem: mensagemGrupo });
    showToast('Envio por grupo enfileirado com sucesso!');
    setMensagemGrupo('');
    setSending(false);
    loadLog();
  };

  const handleByCongregation = async () => {
    setSending(true);
    await api.post('/messages/send-by-congregation', { congregacao, mensagem: mensagemCongregacao });
    showToast('Envio por congregação enfileirado com sucesso!');
    setMensagemCongregacao('');
    setSending(false);
    loadLog();
  };

  const handleIndividual = async () => {
    setSending(true);
    await api.post('/messages/send-individual', { ...individual, mensagem: mensagemIndividual });
    showToast('Mensagem individual enviada!');
    setMensagemIndividual('');
    setIndividual({ personId: '', celular: '' });
    setSending(false);
    loadLog();
  };

  const sendBirthdayNow = async () => {
    setSending(true);
    await api.post('/messages/send-birthday-now');
    showToast('Disparo de aniversários realizado!');
    setSending(false);
    loadLog();
  };

  const resend = async (id) => {
    setSending(true);
    await api.post(`/messages/resend/${id}`);
    showToast('Reenvio enfileirado!');
    setSending(false);
    loadLog();
  };

  const filteredLog = log.filter((item) => {
    if (filters.tipo && item.tipo !== filters.tipo) return false;
    if (filters.status && item.status !== filters.status) return false;
    return true;
  });

  const stats = {
    total: log.length,
    concluido: log.filter((i) => i.status === 'concluido').length,
    enviando: log.filter((i) => i.status === 'enviando').length,
    erro: log.filter((i) => i.status === 'erro').length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Comunicação" subtitle="Envios via WhatsApp" />

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {toast}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Coluna esquerda: Envio ─────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Tabs de envio */}
          <SectionCard>
            <div className="p-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Nova mensagem</h2>
              <div className="flex gap-1.5 flex-wrap">
                <SendTab label="Por grupo" icon="👥" active={activeTab === 'grupo'} onClick={() => setActiveTab('grupo')} />
                <SendTab label="Congregação" icon="🏛️" active={activeTab === 'congregacao'} onClick={() => setActiveTab('congregacao')} />
                <SendTab label="Individual" icon="💬" active={activeTab === 'individual'} onClick={() => setActiveTab('individual')} />
              </div>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {activeTab === 'grupo' && (
                <>
                  <select className={inputClass} value={grupo} onChange={(e) => setGrupo(e.target.value)}>
                    <option value="">Selecione o grupo</option>
                    {grupos.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <textarea
                    className={textareaClass}
                    rows={4}
                    placeholder="Mensagem... use {nome} e {congregacao}"
                    value={mensagemGrupo}
                    onChange={(e) => setMensagemGrupo(e.target.value)}
                  />
                  <button
                    onClick={handleByGroup}
                    disabled={sending || !grupo || !mensagemGrupo}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Enviar para o grupo
                  </button>
                </>
              )}

              {activeTab === 'congregacao' && (
                <>
                  <select className={inputClass} value={congregacao} onChange={(e) => setCongregacao(e.target.value)}>
                    {CONGREGACOES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <textarea
                    className={textareaClass}
                    rows={4}
                    placeholder="Mensagem... use {nome} e {congregacao}"
                    value={mensagemCongregacao}
                    onChange={(e) => setMensagemCongregacao(e.target.value)}
                  />
                  <button
                    onClick={handleByCongregation}
                    disabled={sending || !mensagemCongregacao}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Enviar para a congregação
                  </button>
                </>
              )}

              {activeTab === 'individual' && (
                <>
                  <input
                    className={inputClass}
                    placeholder="Celular (WhatsApp)"
                    value={individual.celular}
                    onChange={(e) => setIndividual((p) => ({ ...p, celular: e.target.value }))}
                  />
                  <textarea
                    className={textareaClass}
                    rows={4}
                    placeholder="Mensagem personalizada..."
                    value={mensagemIndividual}
                    onChange={(e) => setMensagemIndividual(e.target.value)}
                  />
                  <button
                    onClick={handleIndividual}
                    disabled={sending || !individual.celular || !mensagemIndividual}
                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Enviar mensagem
                  </button>
                </>
              )}
            </div>
          </SectionCard>

          <SectionCard>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Testar aniversário agora</p>
                <p className="text-xs text-slate-400">Dispara mensagem para aniversariantes do dia</p>
              </div>
              <button
                onClick={sendBirthdayNow}
                className="bg-ibbiBlue text-white text-xs font-semibold px-3 py-2 rounded-lg"
              >
                Enviar agora
              </button>
            </div>
          </SectionCard>

          {/* Pedidos de oração */}
          <SectionCard>
            <button
              onClick={() => setShowPrayer((s) => !s)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition"
            >
              <div className="flex items-center gap-2">
                <span>🙏</span>
                Pedidos de oração
                <span className="ml-1 bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full">{prayerLog.length}</span>
              </div>
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${showPrayer ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showPrayer && (
              <div className="border-t border-slate-100 divide-y divide-slate-50">
                {prayerLog.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Nenhum pedido registrado</p>
                ) : (
                  prayerLog.map((row) => (
                    <div key={row._id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-700">{row.nome}</span>
                        <span className="text-[10px] text-slate-400">{new Date(row.data).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <p className="text-xs text-slate-500">{row.conteudo}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Coluna direita: Histórico ──────────────────────── */}
        <div className="lg:col-span-3 flex flex-col gap-4">

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total', value: stats.total, color: 'text-slate-700', bg: 'bg-white' },
              { label: 'Enviados', value: stats.concluido, color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'Enviando', value: stats.enviando, color: 'text-amber-700', bg: 'bg-amber-50' },
              { label: 'Com erro', value: stats.erro, color: 'text-red-600', bg: 'bg-red-50' },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} rounded-xl border border-slate-100 px-3 py-3 text-center`}>
                <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filtros + lista */}
          <SectionCard className="flex-1">
            {/* Filtros */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 flex-wrap">
              <h2 className="text-sm font-semibold text-slate-700 mr-auto">Histórico de envios</h2>
              <select
                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                value={filters.tipo}
                onChange={(e) => setFilters((f) => ({ ...f, tipo: e.target.value }))}
              >
                <option value="">Todos os tipos</option>
                <option value="aniversario">aniversário</option>
                <option value="aviso">aviso</option>
                <option value="reunião">reunião</option>
                <option value="convite">convite</option>
                <option value="oracao">oração</option>
                <option value="personalizada">personalizada</option>
              </select>
              <select
                className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="">Todos os status</option>
                <option value="pendente">pendente</option>
                <option value="enviando">enviando</option>
                <option value="concluido">concluído</option>
                <option value="erro">erro</option>
              </select>
              <span className="text-xs text-slate-400 whitespace-nowrap">{filteredLog.length} mensagens</span>
            </div>

            {/* Lista de mensagens */}
            <div className="divide-y divide-slate-50">
              {filteredLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <svg className="w-10 h-10 mb-3 text-slate-200" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <p className="text-sm">Nenhuma mensagem encontrada</p>
                </div>
              ) : (
                filteredLog.map((row) => (
                  <div
                    key={row._id}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition group cursor-pointer"
                    onClick={() => setShowMessage(row)}
                  >
                    {/* Ícone do tipo */}
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-base shrink-0">
                      {TIPO_ICON[row.tipo] || '💬'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-slate-700 capitalize">{row.tipo}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[row.status] || 'bg-slate-100 text-slate-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[row.status] || 'bg-slate-400'}`} />
                          {row.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">{row.conteudo || '—'}</p>
                    </div>

                    {/* Data */}
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-500">{new Date(row.criadoEm).toLocaleDateString('pt-BR')}</p>
                      <p className="text-[10px] text-slate-400">{new Date(row.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>

                    <button
                      className="text-xs text-amber-600 px-2 py-1 rounded-lg hover:bg-amber-50"
                      onClick={(e) => { e.stopPropagation(); resend(row._id); }}
                    >
                      Reenviar
                    </button>

                    {/* Arrow */}
                    <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* ── Modal: ver mensagem ────────────────────────────── */}
      {showMessage && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50" onClick={() => setShowMessage(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg">
                  {TIPO_ICON[showMessage.tipo] || '💬'}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-800 capitalize">{showMessage.tipo}</h3>
                  <p className="text-xs text-slate-400">{new Date(showMessage.criadoEm).toLocaleString('pt-BR')}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[showMessage.status] || 'bg-slate-100 text-slate-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[showMessage.status] || 'bg-slate-400'}`} />
                {showMessage.status}
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{showMessage.conteudo}</pre>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowMessage(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
