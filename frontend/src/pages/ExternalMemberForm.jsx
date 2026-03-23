import { useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import MemberForm from './Members/MemberForm';

export default function ExternalMemberForm() {
  const { token } = useParams();
  const [status, setStatus] = useState('');

  const handleSubmit = async (payload) => {
    try {
      await api.post(`/public/invitations/${token}/submit`, payload);
      setStatus('ok');
    } catch (err) {
      setStatus(err?.response?.data?.message || 'Falha ao enviar');
    }
  };

  if (status === 'ok') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white shadow-soft rounded-xl p-6">
          <h1 className="font-display text-xl text-ibbiNavy">Cadastro enviado com sucesso</h1>
          <p className="text-sm text-slate-500">Obrigado! Seus dados foram recebidos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ibbiCream p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-soft p-6">
        <h1 className="font-display text-xl text-ibbiNavy mb-4">Cadastro de membro</h1>
        {status && <p className="text-sm text-red-600 mb-2">{status}</p>}
        <MemberForm onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
