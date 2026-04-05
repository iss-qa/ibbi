import { useState } from 'react';
import Header from '../components/Header';
import api from '../services/api';

export default function PrayerRequest() {
  const [mensagem, setMensagem] = useState('');
  const [status, setStatus] = useState(''); // '', 'enviando', 'ok', 'erro'
  const [feedback, setFeedback] = useState('');

  const handleSend = async (e) => {
    e.preventDefault();
    setStatus('enviando');
    setFeedback('');
    try {
      await api.post('/prayer/send', { mensagem });
      setMensagem('');
      setStatus('ok');
      setFeedback('Pedido enviado com sucesso! A equipe de intercessão estará orando por você.');
    } catch (err) {
      setStatus('erro');
      setFeedback(err.response?.data?.message || 'Falha ao enviar o pedido. Tente novamente mais tarde.');
    }
  };

  return (
    <div className="min-h-screen">
      <Header title="Pedido de Oração" subtitle="Envie sua solicitação com segurança" />

      <div className="max-w-2xl mx-auto px-4 mt-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
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
        </div>
      </div>
    </div>
  );
}
