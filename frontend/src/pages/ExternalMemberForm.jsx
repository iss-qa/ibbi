import { useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import MemberForm from './Members/MemberForm';

export default function ExternalMemberForm() {
  const { token } = useParams();
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedName, setSubmittedName] = useState('');

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setSubmittedName(payload.nome || '');
    try {
      await api.post(`/public/invitations/${token}/submit`, payload);
      setStatus('ok');
    } catch (err) {
      const data = err?.response?.data;
      setStatus(data?.message || 'Falha ao enviar');
      if (data?.code === 'DUPLICATE' || data?.code === 'DUPLICATE_REQUEST') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'ok') {
    return (
      <div className="min-h-screen bg-ibbiCream flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 text-center animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h1 className="font-display text-2xl text-ibbiNavy mb-2">Cadastro Recebido!</h1>
          <p className="text-slate-600 mb-6">
            Olá{submittedName ? `, ${submittedName.split(' ')[0]}` : ''}! Sua solicitação foi enviada com sucesso.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6 text-left">
            <h2 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3">Em Análise</h2>
            <p className="text-sm text-amber-800 leading-relaxed">
              Sua solicitação será analisada pela administração da igreja.
              Você receberá uma mensagem de confirmação no WhatsApp agora e, após a aprovação, enviaremos também seus dados de acesso ao portal.
            </p>
          </div>

          <p className="text-sm text-slate-500 leading-relaxed">
            Fique tranquilo(a), entraremos em contato assim que possível.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ibbiCream p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-soft p-6">
        <h1 className="font-display text-xl text-ibbiNavy mb-4">Cadastro de pessoa</h1>
        {status && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-shake">
            <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700 font-medium">{status}</p>
          </div>
        )}
        <MemberForm onSubmit={handleSubmit} isExternal={true} />
      </div>
    </div>
  );
}
