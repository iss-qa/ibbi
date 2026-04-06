import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Header from '../components/Header';

const STATUS_LABELS = { pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado' };
const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function RegistrationApprovals() {
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [toast, setToast] = useState('');
  const limit = 20;

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit, status: statusFilter });
      if (search) params.set('search', search);
      const { data } = await api.get(`/registrations?${params}`);
      setRequests(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error('Erro ao carregar solicitações:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id) => {
    if (!confirm('Confirma a aprovação desta solicitação? Será criado um cadastro de membro e usuário.')) return;
    setActionLoading(true);
    try {
      const { data } = await api.put(`/registrations/${id}/approve`);
      showToast(`Aprovado! Login criado: ${data.credentials?.login || 'N/A'}`);
      setSelected(null);
      load();
    } catch (err) {
      alert(err?.response?.data?.message || 'Erro ao aprovar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) { alert('Informe o motivo da rejeição.'); return; }
    setActionLoading(true);
    try {
      await api.put(`/registrations/${showRejectModal}/reject`, { reviewNote: rejectNote });
      showToast('Solicitação rejeitada.');
      setShowRejectModal(false);
      setRejectNote('');
      setSelected(null);
      load();
    } catch (err) {
      alert(err?.response?.data?.message || 'Erro ao rejeitar');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div>
      <Header title="Aprovação de Cadastros" subtitle="Gerencie as solicitações de novos membros" />

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {toast}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-2">
          {['pending', 'approved', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${statusFilter === s ? 'bg-ibbiNavy text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <input
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm flex-1 max-w-xs focus:outline-none focus:ring-2 focus:ring-ibbiBlue"
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-slate-500 text-sm">Carregando...</p>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg font-medium">Nenhuma solicitação {STATUS_LABELS[statusFilter]?.toLowerCase()}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req._id}
              onClick={() => setSelected(selected?._id === req._id ? null : req)}
              className={`bg-white border rounded-xl p-4 cursor-pointer transition hover:shadow-md ${selected?._id === req._id ? 'border-ibbiBlue ring-2 ring-ibbiBlue/20' : 'border-slate-200'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {req.fotoUrl ? (
                    <img src={req.fotoUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-sm font-bold">
                      {req.nome?.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-slate-800">{req.nome}</p>
                    <p className="text-xs text-slate-500">{req.celular || '-'} | {req.congregacao || '-'} | {formatDate(req.submittedAt)}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[req.status]}`}>
                  {STATUS_LABELS[req.status]}
                </span>
              </div>

              {/* Detalhes expandidos */}
              {selected?._id === req._id && (
                <div className="mt-4 pt-4 border-t border-slate-100 animate-fade-in">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    {req.submittedData && Object.entries(req.submittedData)
                      .filter(([k]) => !['fotoUrl', '__v', '_id'].includes(k))
                      .map(([key, val]) => (
                        <div key={key}>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{key}</span>
                          <p className="text-slate-700">{val instanceof Object ? JSON.stringify(val) : String(val || '-')}</p>
                        </div>
                      ))
                    }
                  </div>
                  {req.reviewNote && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nota da revisão</span>
                      <p className="text-sm text-slate-700">{req.reviewNote}</p>
                      {req.reviewedBy && <p className="text-xs text-slate-400 mt-1">por {req.reviewedBy.nome} em {formatDate(req.reviewedAt)}</p>}
                    </div>
                  )}
                  {req.status === 'pending' && (
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApprove(req._id); }}
                        disabled={actionLoading}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowRejectModal(req._id); setRejectNote(''); }}
                        disabled={actionLoading}
                        className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-100 transition border border-red-200 disabled:opacity-50"
                      >
                        Rejeitar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Paginação */}
          {total > limit && (
            <div className="flex justify-center gap-2 pt-4">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded-lg text-sm border disabled:opacity-40">Anterior</button>
              <span className="px-3 py-1.5 text-sm text-slate-500">{page} de {Math.ceil(total / limit)}</span>
              <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded-lg text-sm border disabled:opacity-40">Próximo</button>
            </div>
          )}
        </div>
      )}

      {/* Modal de Rejeição */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Rejeitar Solicitação</h3>
            <textarea
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
              rows={3}
              placeholder="Motivo da rejeição (obrigatório)..."
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100">Cancelar</button>
              <button onClick={handleReject} disabled={actionLoading} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50">
                Confirmar Rejeição
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
