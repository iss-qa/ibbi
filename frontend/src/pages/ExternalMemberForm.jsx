import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import MemberForm from './Members/MemberForm';

export default function ExternalMemberForm() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [successData, setSuccessData] = useState(null);
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedName, setSubmittedName] = useState('');

  // Deriva o login igual ao backend: primeiroNome + segundoNome (sem acento, lowercase)
  const deriveLogin = (nome) => {
    if (!nome) return '';
    const parts = nome.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    return parts.length > 1 ? `${parts[0]}${parts[1]}` : parts[0];
  };

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setSubmittedName(payload.nome || '');
    try {
      const response = await api.post(`/public/invitations/${token}/submit`, payload);
      setSuccessData(response.data);
      setStatus('ok');
    } catch (err) {
      const data = err?.response?.data;
      setStatus(data?.message || 'Falha ao enviar');
      if (data?.code === 'DUPLICATE') {
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
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h1 className="font-display text-2xl text-ibbiNavy mb-2">Bem-vindo(a)!</h1>
          <p className="text-slate-600 mb-8">Seu cadastro foi realizado com sucesso.</p>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 mb-8 text-left">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Dados de Acesso</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Portal</p>
                <a href="https://ibbi.issqa.com.br/login" className="text-ibbiGold font-medium hover:underline">
                  ibbi.issqa.com.br/login
                </a>
              </div>
              
              <div>
                <p className="text-xs text-slate-500 mb-1">Usuário</p>
                <p className="font-mono font-medium text-slate-800">{successData?.generatedUser?.login || deriveLogin(submittedName) || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Senha Padrão</p>
                <p className="font-mono font-medium text-slate-800">{successData?.generatedUser?.senha || 'IBBI2026'}</p>
              </div>
            </div>
          </div>

          <p className="text-sm text-slate-500 leading-relaxed mb-8">
            Agora você já pode acessar o portal para <strong>editar sua foto</strong>, 
            atualizar seu <strong>cadastro</strong> e enviar <strong>pedidos de oração</strong>.
          </p>

          <button
            onClick={() => navigate('/login', { state: { login: successData?.generatedUser?.login || deriveLogin(submittedName) || '', senha: successData?.generatedUser?.senha || 'IBBI2026' } })}
            className="block w-full bg-ibbiNavy text-white font-medium py-3 rounded-xl hover:bg-opacity-90 transition-all shadow-md"
          >
            Ir para o Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ibbiCream p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-soft p-6">
        <h1 className="font-display text-xl text-ibbiNavy mb-4">Cadastro de membro</h1>
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
