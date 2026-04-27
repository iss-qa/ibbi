import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from '../../components/Header';
import api from '../../services/api';
import { CONGREGACOES } from '../../constants/congregacoes';
import useAuth from '../../hooks/useAuth';
import { formatPhoneBR } from '../../utils/phoneMask';

const grupos = ['criança', 'adolescente', 'jovem', 'adulto 1', 'adulto 2', 'idoso', 'ancião'];
const personTypes = ['congregado', 'membro', 'visitante', 'novo decidido', 'criança'];

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

const RECIPIENT_STATUS_STYLE = {
  concluido: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  erro: 'bg-red-50 text-red-600 border border-red-200',
  enviando: 'bg-amber-50 text-amber-700 border border-amber-200',
  pendente: 'bg-slate-100 text-slate-500 border border-slate-200',
};

const RECIPIENT_STATUS_LABEL = {
  concluido: 'Enviado',
  erro: 'Falha',
  enviando: 'Enviando',
  pendente: 'Na fila',
};

const TIPO_ICON = {
  aniversario: '🎂',
  'novo cadastro': '✨',
  'aviso - novo cadastro': '✨',
  'aviso - novo membro': '✨',
  aviso: '📢',
  reunião: '📅',
  convite: '✉️',
  oracao: '🙏',
  personalizada: '💬',
  'novo_decidido': '🕊️',
  'visitante': '🌟',
  'projeto_amigo': '🤝',
};

const normalizeTipo = (tipo) => {
  if (['aviso - novo cadastro', 'aviso - novo membro'].includes(tipo)) return 'novo cadastro';
  if (tipo === 'novo_decidido') return 'novo decidido';
  if (tipo === 'visitante') return 'visitante';
  if (tipo === 'projeto_amigo') return 'projeto amigo';
  return tipo;
};

const LOG_PAGE_SIZE = 10;

const inputClass =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-lg sm:text-base text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition placeholder:text-slate-400 min-h-[44px] appearance-none';

const textareaClass =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-base sm:text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition placeholder:text-slate-400 resize-none min-h-[44px]';

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
      className={`flex items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-lg text-sm font-medium transition flex-1 sm:flex-none ${active
        ? 'bg-blue-600 text-white shadow-sm'
        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
        }`}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}

function PersonOption({ person, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(person)}
      className={`w-full text-left px-4 py-3 transition flex items-start justify-between gap-3 ${
        selected
          ? 'bg-blue-50 text-blue-700'
          : 'hover:bg-slate-50 text-slate-700'
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate">{person.nome}</p>
        <p className="text-xs text-slate-500 truncate">
          {formatPhoneBR(person.celular || '') || 'Sem celular'}{person.congregacao ? ` • ${person.congregacao}` : ''}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
        selected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
      }`}>
        {person.tipo}
      </span>
    </button>
  );
}

const normalizeRecipientList = (msg) => {
  const errorsByPhone = new Map((msg.erros || []).map((item) => [item.celular, item.motivo]));
  return (msg.destinatarios || [])
    .map((dest, index) => {
      const inferredStatus = dest.status
        || (errorsByPhone.has(dest.celular) ? 'erro' : null)
        || (msg.status === 'concluido' ? 'concluido' : null)
        || (msg.status === 'erro' && (msg.destinatarios || []).length === 1 ? 'erro' : null)
        || (msg.status === 'enviando' && index === 0 ? 'enviando' : null)
        || 'pendente';

      return {
        ...dest,
        ordem: Number.isFinite(dest.ordem) ? dest.ordem : index,
        status: inferredStatus,
        erro: dest.erro || errorsByPhone.get(dest.celular) || '',
      };
    })
    .sort((a, b) => a.ordem - b.ordem);
};

const getRecipientProgress = (msg) => {
  const recipients = normalizeRecipientList(msg);
  const counts = recipients.reduce((acc, dest) => {
    acc[dest.status] = (acc[dest.status] || 0) + 1;
    return acc;
  }, {});

  const currentRecipient = recipients.find((dest) => dest.status === 'enviando') || null;
  const nextPending = recipients.find((dest) => dest.status === 'pendente') || null;

  return {
    recipients,
    total: recipients.length,
    sent: counts.concluido || 0,
    failed: counts.erro || 0,
    sending: counts.enviando || 0,
    pending: counts.pendente || 0,
    currentRecipient,
    nextPending,
  };
};

export default function CommunicationPanel() {
  const { user } = useAuth();
  const lockedCongregacao = user?.role === 'admin' ? user?.congregacao : '';
  const [activeTab, setActiveTab] = useState('grupo');
  const [grupo, setGrupo] = useState('');
  const [congregacao, setCongregacao] = useState('Sede');
  const [mensagemGrupo, setMensagemGrupo] = useState('');
  const [mensagemCongregacao, setMensagemCongregacao] = useState('');
  const [mensagemIndividual, setMensagemIndividual] = useState('');
  const [mensagemFalhas, setMensagemFalhas] = useState('');
  const [falhasCount, setFalhasCount] = useState(0);
  const [individual, setIndividual] = useState({ personId: '', celular: '', nome: '', congregacao: '' });
  const [personSearch, setPersonSearch] = useState('');
  const [personTypeFilter, setPersonTypeFilter] = useState('');
  const [personOptions, setPersonOptions] = useState([]);
  const [personLoading, setPersonLoading] = useState(false);
  const [personDropdownOpen, setPersonDropdownOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [log, setLog] = useState([]);
  const [filters, setFilters] = useState({ tipo: '', status: '' });
  const [showMessage, setShowMessage] = useState(null);
  const [showPrayerMessage, setShowPrayerMessage] = useState(null);
  const [prayerLog, setPrayerLog] = useState([]);
  const [summary, setSummary] = useState({ total: 0, concluido: 0, enviando: 0, erro: 0, byType: [] });
  const [sending, setSending] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [showPrayerModal, setShowPrayerModal] = useState(false);
  const personComboboxRef = useRef(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadLog = useCallback(async () => {
    const { data } = await api.get('/messages/log');
    setLog(data);
  }, []);
  const loadPrayerLog = useCallback(async () => {
    const { data } = await api.get('/messages/prayer-log');
    setPrayerLog(data);
  }, []);
  const loadSummary = useCallback(async () => {
    const { data } = await api.get('/messages/summary');
    setSummary(data);
  }, []);

  useEffect(() => { loadLog(); loadPrayerLog(); loadSummary(); }, [loadLog, loadPrayerLog, loadSummary]);
  useEffect(() => { if (lockedCongregacao) setCongregacao(lockedCongregacao); }, [lockedCongregacao]);
  useEffect(() => {
    const hasSending = log.some((item) => item.status === 'enviando');
    if (!hasSending) return undefined;

    const timer = setInterval(() => {
      loadLog().catch(console.error);
      loadSummary().catch(console.error);
    }, 10000);

    return () => clearInterval(timer);
  }, [log, loadLog, loadSummary]);
  useEffect(() => {
    if (!showMessage) return;
    const updatedMessage = log.find((item) => item._id === showMessage._id);
    if (updatedMessage) {
      setShowMessage(updatedMessage);
    }
  }, [log, showMessage]);

  useEffect(() => {
    if (showNewMessage) {
      api.get('/messages/pending-photos-count').then((res) => {
        setFalhasCount(res.data.count);
      }).catch(console.error);
    }
  }, [showNewMessage]);

  useEffect(() => {
    if (!showNewMessage || activeTab !== 'individual') return undefined;

    const timer = setTimeout(async () => {
      setPersonLoading(true);
      try {
        const params = { page: 1, limit: 12, status: 'ativo' };
        if (personSearch.trim()) params.search = personSearch.trim();
        if (personTypeFilter) params.tipo = personTypeFilter;

        const { data } = await api.get('/persons', { params });
        const items = (data.items || []).filter((person) => person.celular);
        setPersonOptions(items);
      } catch (err) {
        console.error('Erro ao carregar pessoas para envio individual:', err);
        setPersonOptions([]);
      } finally {
        setPersonLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [showNewMessage, activeTab, personSearch, personTypeFilter]);

  useEffect(() => {
    if (!personDropdownOpen) return undefined;

    const handleClickOutside = (event) => {
      if (personComboboxRef.current && !personComboboxRef.current.contains(event.target)) {
        setPersonDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [personDropdownOpen]);

  const selectedPersonLabel = useMemo(() => {
    if (!individual.personId) return '';
    const parts = [individual.nome, formatPhoneBR(individual.celular || ''), individual.congregacao].filter(Boolean);
    return parts.join(' • ');
  }, [individual]);

  const handleByGroup = async () => {
    setSending(true);
    await api.post('/messages/send-by-group', { grupo, mensagem: mensagemGrupo });
    showToast('Envio por grupo enfileirado!');
    setMensagemGrupo('');
    setSending(false);
    loadLog();
    loadSummary();
  };

  const handleByCongregation = async () => {
    setSending(true);
    await api.post('/messages/send-by-congregation', { congregacao, mensagem: mensagemCongregacao });
    showToast('Envio por congregação enfileirado!');
    setMensagemCongregacao('');
    setSending(false);
    loadLog();
    loadSummary();
  };

  const handleIndividual = async () => {
    setSending(true);
    await api.post('/messages/send-individual', { ...individual, mensagem: mensagemIndividual });
    showToast('Mensagem individual enviada!');
    setMensagemIndividual('');
    setIndividual({ personId: '', celular: '', nome: '', congregacao: '' });
    setPersonSearch('');
    setPersonTypeFilter('');
    setSending(false);
    loadLog();
    loadSummary();
  };

  const handleSelectPerson = (person) => {
    setIndividual({
      personId: person._id,
      celular: person.celular || '',
      nome: person.nome || '',
      congregacao: person.congregacao || '',
    });
    setPersonSearch(person.nome || '');
    setPersonDropdownOpen(false);
  };

  const clearSelectedPerson = () => {
    setIndividual({ personId: '', celular: '', nome: '', congregacao: '' });
    setPersonSearch('');
    setPersonDropdownOpen(true);
  };

  const resend = async (id) => {
    setSending(true);
    try {
      await api.post(`/messages/resend/${id}`);
      showToast('Reenvio enfileirado!');
      loadLog();
      loadSummary();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Não foi possível reenviar agora.');
    } finally {
      setSending(false);
    }
  };

  const filteredLog = log.filter((item) => {
    if (filters.tipo && normalizeTipo(item.tipo) !== filters.tipo && item.tipo !== filters.tipo) return false;
    if (filters.status && item.status !== filters.status) return false;
    return true;
  });

  const logTotalPages = Math.ceil(filteredLog.length / LOG_PAGE_SIZE);

  const stats = {
    total: summary.total,
    concluido: summary.concluido,
    enviando: summary.enviando,
    erro: summary.erro,
  };

  // Build enriched content for birthday messages
  const renderMessageContent = (msg) => {
    const isBirthday = msg.tipo === 'aniversario';
    const progress = getRecipientProgress(msg);
    const dest = progress.recipients?.[0];

    return (
      <>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{msg.conteudo}</pre>
        </div>

        {isBirthday && dest && (
          <div className="mt-4 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Destinatário</p>
            <div className="flex items-center gap-3 bg-amber-50 rounded-xl p-3 border border-amber-100">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-lg">🎂</div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{dest.nome}</p>
                {dest.celular && <p className="text-xs text-slate-500">{dest.celular}</p>}
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#0a1f44] to-[#112b5e] rounded-xl p-4 text-center">
              <p className="text-amber-400 text-[10px] font-bold tracking-[4px] mb-1">IBBI</p>
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-amber-400 to-amber-600 p-[2px] mb-3">
                <div className="w-full h-full rounded-full bg-[#0d2255] flex items-center justify-center text-2xl">🎂</div>
              </div>
              <p className="text-amber-400 text-[10px] font-bold tracking-[3px] mb-1">PARABÉNS</p>
              <p className="text-white text-xl font-bold">{dest.nome?.split(' ')[0]}</p>
              <div className="mt-3 bg-white/10 rounded-lg p-3 mx-4">
                <p className="text-white/90 text-xs italic leading-relaxed">
                  Feliz aniversário! Que o Senhor continue guiando seus passos com graça, paz e alegria em cada novo dia. 🙏
                </p>
              </div>
              <div className="mt-3 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full py-2 mx-8">
                <p className="text-[#0a1f44] text-[10px] font-bold tracking-[2px]">FELIZ ANIVERSÁRIO</p>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 text-center">
              Imagem do cartão de aniversário enviada junto com a mensagem
            </p>
          </div>
        )}

        {progress.total > 1 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Destinatários ({progress.total})
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {[
                { label: 'Enviados', value: progress.sent, style: 'text-emerald-700 bg-emerald-50' },
                { label: 'Falhas', value: progress.failed, style: 'text-red-600 bg-red-50' },
                { label: 'Em fila', value: progress.pending, style: 'text-slate-600 bg-slate-100' },
                { label: 'Em envio', value: progress.sending, style: 'text-amber-700 bg-amber-50' },
              ].map((item) => (
                <div key={item.label} className={`rounded-xl px-3 py-2 ${item.style}`}>
                  <p className="text-lg font-semibold">{item.value}</p>
                  <p className="text-[11px] font-medium">{item.label}</p>
                </div>
              ))}
            </div>

            {(progress.currentRecipient || progress.nextPending) && (
              <div className="mb-3 rounded-xl border border-slate-200 bg-stone-50 px-3 py-2.5 text-xs text-slate-600">
                {progress.currentRecipient && (
                  <p>
                    <span className="font-semibold text-slate-700">Enviando agora:</span> {progress.currentRecipient.nome}
                  </p>
                )}
                {progress.nextPending && (
                  <p className={progress.currentRecipient ? 'mt-1' : ''}>
                    <span className="font-semibold text-slate-700">Próximo da fila:</span> {progress.nextPending.nome}
                  </p>
                )}
              </div>
            )}

            <div className="max-h-64 overflow-y-auto space-y-1">
              {progress.recipients.map((d, i) => (
                <div key={`${d.celular}-${i}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{d.nome}</p>
                      {d.celular && <p className="text-[11px] text-slate-400">{d.celular}</p>}
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${RECIPIENT_STATUS_STYLE[d.status] || RECIPIENT_STATUS_STYLE.pendente}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[d.status] || STATUS_DOT.pendente}`} />
                      {RECIPIENT_STATUS_LABEL[d.status] || d.status}
                    </span>
                  </div>
                  {d.erro && (
                    <p className="mt-1 text-[11px] text-red-600">{d.erro}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {msg.erros?.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">
              Erros ({msg.erros.length})
            </p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {msg.erros.map((e, i) => (
                <div key={i} className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-1.5">
                  {e.celular} — {e.motivo}
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen">
      <Header title="Comunicação" subtitle="Envios via WhatsApp" />

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {toast}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Stats Row + Action Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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

          {/* Nova Mensagem Button */}
          <button
            onClick={() => setShowNewMessage(true)}
            className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-center hover:bg-blue-100 transition group"
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <p className="text-sm font-semibold text-blue-700">Nova Mensagem</p>
            </div>
          </button>

          {/* Pedidos de Oração Button */}
          <button
            onClick={() => setShowPrayerModal(true)}
            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-center hover:bg-amber-100 transition group"
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg">🙏</span>
              <p className="text-sm font-semibold text-amber-700">Oração ({prayerLog.length})</p>
            </div>
          </button>
        </div>

        <SectionCard className="p-4">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Contadores por tipo</h2>
              <p className="text-xs text-slate-400">Resumo geral dos envios por categoria</p>
            </div>
            <span className="text-[11px] text-slate-400">Logo abaixo dos indicadores principais</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
            {summary.byType.map((item) => (
              <div
                key={item.key}
                className="rounded-xl border border-slate-100 bg-stone-50/70 px-3 py-2.5 min-h-[74px] flex flex-col justify-center"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{TIPO_ICON[item.key] || TIPO_ICON[normalizeTipo(item.key)] || '💬'}</span>
                  <span className="text-lg font-semibold text-slate-800">{item.count}</span>
                </div>
                <p className="text-[11px] font-medium text-slate-500 mt-1 leading-snug">{item.label}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Full-width History */}
        <SectionCard className="flex-1">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 flex-wrap">
            <h2 className="text-sm font-semibold text-slate-700 mr-auto">Histórico de envios</h2>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white focus:outline-none"
              value={filters.tipo}
              onChange={(e) => { setFilters((f) => ({ ...f, tipo: e.target.value })); setLogPage(1); }}
            >
              <option value="">Todos os tipos</option>
              <option value="aniversario">Aniversário</option>
              <option value="novo cadastro">Nova pessoa</option>
              <option value="projeto_amigo">Projeto Amigo</option>
              <option value="personalizada">Personalizada</option>
              <option value="oracao">Oração</option>
              <option value="novo_decidido">Novo decidido</option>
              <option value="visitante">Visitante</option>
            </select>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white focus:outline-none"
              value={filters.status}
              onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setLogPage(1); }}
            >
              <option value="">Todos os status</option>
              <option value="concluido">Concluído</option>
              <option value="enviando">Enviando</option>
              <option value="pendente">Pendente</option>
              <option value="erro">Erro</option>
            </select>
            <span className="text-xs text-slate-400 whitespace-nowrap">{filteredLog.length} mensagens</span>
          </div>

          <div className="divide-y divide-slate-50">
            {filteredLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <svg className="w-10 h-10 mb-3 text-slate-200" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p className="text-sm">Nenhuma mensagem encontrada</p>
              </div>
            ) : (
              filteredLog.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE).map((row) => {
                const progress = getRecipientProgress(row);
                return (
                <div
                  key={row._id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-4 hover:bg-slate-50 transition group cursor-pointer relative"
                  onClick={() => setShowMessage(row)}
                >
                  <div className="flex items-start gap-4 w-full overflow-hidden">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg shrink-0 mt-1">
                      {TIPO_ICON[row.tipo] || '💬'}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1 pr-6">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-slate-700 capitalize truncate">{normalizeTipo(row.tipo)}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[row.status] || 'bg-slate-100 text-slate-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[row.status] || 'bg-slate-400'}`} />
                          {row.status}
                        </span>
                        {progress.total === 1 && progress.recipients[0]?.nome && (
                          <span className="text-[10px] text-slate-400 font-medium">{progress.recipients[0].nome}</span>
                        )}
                        {progress.total > 1 && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            {progress.total} destinatários • {progress.sent} enviados • {progress.failed} falhas • {progress.pending + progress.sending} na fila
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">{row.conteudo || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-slate-100 sm:border-0 shrink-0">
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                      {new Date(row.criadoEm).toLocaleDateString('pt-BR')}
                      <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.5 rounded-md">
                        {new Date(row.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        disabled={sending || row.status === 'enviando'}
                        className="text-xs text-amber-600 font-semibold px-3 py-2 rounded-lg hover:bg-amber-50 active:bg-amber-100 transition border border-amber-200"
                        onClick={(e) => { e.stopPropagation(); resend(row._id); }}
                      >
                        Reenviar
                      </button>
                      <svg className="w-5 h-5 text-slate-300 group-hover:text-slate-400 transition hidden sm:block" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-slate-300 group-hover:text-slate-400 transition absolute top-5 right-4 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                );
              })
            )}
          </div>

          {logTotalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-stone-50">
              <p className="text-xs text-slate-500">Página {logPage} de {logTotalPages}</p>
              <div className="flex gap-1">
                <button
                  onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                  disabled={logPage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition text-sm"
                >‹</button>
                {Array.from({ length: Math.min(5, logTotalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(logPage - 2, logTotalPages - 4));
                  return start + i;
                }).map((p) => (
                  <button
                    key={p}
                    onClick={() => setLogPage(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition ${p === logPage
                        ? 'bg-ibbiNavy text-white'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                  >{p}</button>
                ))}
                <button
                  onClick={() => setLogPage((p) => Math.min(logTotalPages, p + 1))}
                  disabled={logPage === logTotalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition text-sm"
                >›</button>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Modal: Nova Mensagem ──────────────────────────── */}
      {showNewMessage && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center sm:p-4 z-50" onClick={() => setShowNewMessage(false)}>
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[85dvh] sm:max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Nova mensagem</h2>
                <p className="text-xs text-slate-400 mt-0.5">Enviar via WhatsApp</p>
              </div>
              <button onClick={() => setShowNewMessage(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5">
              <div className="flex gap-1.5 flex-wrap mb-4">
                <SendTab label="Por grupo" icon="👥" active={activeTab === 'grupo'} onClick={() => setActiveTab('grupo')} />
                <SendTab label="Congregação" icon="🏛️" active={activeTab === 'congregacao'} onClick={() => setActiveTab('congregacao')} />
                <SendTab label="Individual" icon="💬" active={activeTab === 'individual'} onClick={() => setActiveTab('individual')} />
                <SendTab label="Falhas" icon="⚠️" active={activeTab === 'falhas'} onClick={() => { setActiveTab('falhas'); setMensagemFalhas(`Shalom amado(a) irmão(ã) {nome}, encontramos uma pendência no seu cadastro.\n\n* PROBLEMA -> Cadastro sem foto *\n\nAcesse nosso portal:\n🔗 Portal: https://ibbi.issqa.com.br/login\n👤 Usuário: {login}\n🔑 Senha: {senha}\n\nE atualize seu cadastro! Escolha a foto que preferir, porém insira uma foto no estilo 3x4, evite fotos abertas de paisagem, na qual não consiga identificar seu rosto.\n\n_Igreja Batista Bíblica Israel_`); }} />
              </div>

              <div className="flex flex-col gap-3">
                {activeTab === 'grupo' && (
                  <>
                    <select className={inputClass} value={grupo} onChange={(e) => setGrupo(e.target.value)}>
                      <option value="">Selecione o grupo</option>
                      {grupos.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <textarea className={textareaClass} rows={10} placeholder="Mensagem... use {nome} e {congregacao}" value={mensagemGrupo} onChange={(e) => setMensagemGrupo(e.target.value)} />
                    <button
                      onClick={async () => { await handleByGroup(); setShowNewMessage(false); }}
                      disabled={sending || !grupo || !mensagemGrupo}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium py-3 rounded-lg transition flex items-center justify-center gap-2 min-h-[44px]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      Enviar para o grupo
                    </button>
                  </>
                )}
                {activeTab === 'congregacao' && (
                  <>
                    <select className={`${inputClass} disabled:bg-slate-100`} value={congregacao} onChange={(e) => setCongregacao(e.target.value)} disabled={Boolean(lockedCongregacao)}>
                      {CONGREGACOES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <textarea className={textareaClass} rows={10} placeholder="Mensagem... use {nome} e {congregacao}" value={mensagemCongregacao} onChange={(e) => setMensagemCongregacao(e.target.value)} />
                    <button
                      onClick={async () => { await handleByCongregation(); setShowNewMessage(false); }}
                      disabled={sending || !mensagemCongregacao}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium py-3 rounded-lg transition flex items-center justify-center gap-2 min-h-[44px]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      Enviar para a congregação
                    </button>
                  </>
                )}
                {activeTab === 'individual' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-[170px_minmax(0,1fr)] gap-3">
                      <select
                        className={inputClass}
                        value={personTypeFilter}
                        onChange={(e) => {
                          setPersonTypeFilter(e.target.value);
                          setPersonDropdownOpen(true);
                        }}
                      >
                        <option value="">Todos os tipos</option>
                        {personTypes.map((tipo) => (
                          <option key={tipo} value={tipo}>{tipo.toUpperCase()}</option>
                        ))}
                      </select>

                      <div ref={personComboboxRef} className="relative">
                        <input
                          className={inputClass}
                          placeholder="Buscar por nome ou celular"
                          value={individual.personId ? selectedPersonLabel : personSearch}
                          onFocus={() => setPersonDropdownOpen(true)}
                          onChange={(e) => {
                            setIndividual({ personId: '', celular: '', nome: '', congregacao: '' });
                            setPersonSearch(e.target.value);
                            setPersonDropdownOpen(true);
                          }}
                        />

                        {individual.personId && (
                          <button
                            type="button"
                            onClick={clearSelectedPerson}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            title="Limpar seleção"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}

                        {personDropdownOpen && (
                          <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                            {personLoading ? (
                              <p className="px-4 py-3 text-sm text-slate-400">Buscando pessoas...</p>
                            ) : personOptions.length === 0 ? (
                              <p className="px-4 py-3 text-sm text-slate-400">Nenhuma pessoa encontrada com celular cadastrado.</p>
                            ) : (
                              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                                {personOptions.map((person) => (
                                  <PersonOption
                                    key={person._id}
                                    person={person}
                                    selected={individual.personId === person._id}
                                    onSelect={handleSelectPerson}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {individual.personId && (
                      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Destinatário selecionado</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{individual.nome}</p>
                        <p className="text-xs text-slate-500">
                          {formatPhoneBR(individual.celular || '') || 'Sem celular'}{individual.congregacao ? ` • ${individual.congregacao}` : ''}
                        </p>
                      </div>
                    )}

                    <textarea className={textareaClass} rows={10} placeholder="Mensagem personalizada..." value={mensagemIndividual} onChange={(e) => setMensagemIndividual(e.target.value)} />
                    <button
                      onClick={async () => { await handleIndividual(); setShowNewMessage(false); }}
                      disabled={sending || !individual.personId || !mensagemIndividual}
                      className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-medium py-3 rounded-lg transition flex items-center justify-center gap-2 min-h-[44px]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      Enviar mensagem
                    </button>
                  </>
                )}
                {activeTab === 'falhas' && (
                  <>
                    <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">⚠️</span>
                        <p className="text-sm font-semibold text-red-800">{falhasCount} membros sem fotos</p>
                      </div>
                      <p className="text-xs text-red-600 mt-1">Ao enviar, a mensagem abaixo será disparada em segundo plano para todos os membros com pendência de foto. (Envios em lotes de 10, com pausas entre os lotes).</p>
                    </div>
                    <textarea className={textareaClass} rows={12} placeholder="Mensagem personalizada..." value={mensagemFalhas} onChange={(e) => setMensagemFalhas(e.target.value)} />
                    <button
                      onClick={async () => {
                        setSending(true);
                        await api.post('/messages/send-pending-photos', { mensagem: mensagemFalhas });
                        showToast('Envio para pendências de foto iniciado!');
                        setShowNewMessage(false);
                        setSending(false);
                      }}
                      disabled={sending || falhasCount === 0 || !mensagemFalhas}
                      className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-medium py-3 rounded-lg transition flex items-center justify-center gap-2 min-h-[44px]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      Disparar para todos
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Pedidos de Oração ─────────────────────── */}
      {showPrayerModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center sm:p-4 z-50" onClick={() => setShowPrayerModal(false)}>
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[85dvh] sm:max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">🙏</span>
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Pedidos de Oração</h2>
                  <p className="text-xs text-slate-400">{prayerLog.length} pedidos</p>
                </div>
              </div>
              <button onClick={() => setShowPrayerModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
              {prayerLog.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">Nenhum pedido registrado</p>
              ) : (
                prayerLog.map((row) => (
                  <button
                    key={row._id}
                    type="button"
                    onClick={() => { setShowPrayerModal(false); setShowPrayerMessage(row); }}
                    className="w-full px-5 py-4 text-left hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-700">{row.nome}{row.congregacao ? ` - ${row.congregacao}` : ''}</span>
                      <span className="text-[10px] text-slate-400">{new Date(row.data).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-3">{row.conteudo}</p>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-slate-100 px-6 py-3 shrink-0">
              <button
                onClick={() => setShowPrayerModal(false)}
                className="w-full px-4 py-3 sm:py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition min-h-[44px]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Detalhe da Mensagem ───────────────────── */}
      {showMessage && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center sm:p-4 z-50" onClick={() => setShowMessage(null)}>
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[85dvh] sm:max-h-[80vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg">
                  {TIPO_ICON[showMessage.tipo] || '💬'}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-800 capitalize">{normalizeTipo(showMessage.tipo)}</h3>
                  <p className="text-xs text-slate-400">{new Date(showMessage.criadoEm).toLocaleString('pt-BR')}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[showMessage.status] || 'bg-slate-100 text-slate-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[showMessage.status] || 'bg-slate-400'}`} />
                {showMessage.status}
              </span>
            </div>

            {renderMessageContent(showMessage)}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowMessage(null)}
                className="px-4 py-3 sm:py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition w-full sm:w-auto min-h-[44px]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Pedido de Oração Detalhe ──────────────── */}
      {showPrayerMessage && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50" onClick={() => setShowPrayerMessage(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg">🙏</div>
                <div>
                  <h3 className="text-base font-semibold text-slate-800">Pedido de oração</h3>
                  <p className="text-xs text-slate-400">{showPrayerMessage.nome}{showPrayerMessage.congregacao ? ` - ${showPrayerMessage.congregacao}` : ''}</p>
                </div>
              </div>
              <span className="text-xs text-slate-400">{new Date(showPrayerMessage.data).toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{showPrayerMessage.conteudo}</pre>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowPrayerMessage(null)} className="px-4 py-3 sm:py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition min-h-[44px]">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
