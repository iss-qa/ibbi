import { useState } from 'react';
import Header from '../components/Header';
import api from '../services/api';

export default function PrayerRequest() {
  const [mensagem, setMensagem] = useState('');
  const [status, setStatus] = useState('');

  const handleSend = async (e) => {
    e.preventDefault();
    setStatus('enviando');
    try {
      await api.post('/prayer/send', { mensagem });
      setMensagem('');
      setStatus('ok');
    } catch (err) {
      setStatus('erro');
    }
  };

  return (
    <div>
      <Header title="Pedido de Oração" subtitle="Envie sua solicitação com segurança" />

      <div className="bg-white rounded-xl shadow-soft p-6 max-w-2xl">
        <form onSubmit={handleSend} className="space-y-4">
          <textarea
            className="w-full border rounded-lg p-3 min-h-[140px]"
            placeholder="Digite seu pedido de oração"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            required
          />
          <button className="bg-ibbiBlue text-white px-4 py-2 rounded-lg" type="submit">
            Enviar pedido
          </button>
          {status === 'ok' && <p className="text-sm text-green-600">Pedido enviado com sucesso.</p>}
          {status === 'erro' && <p className="text-sm text-red-600">Falha ao enviar.</p>}
        </form>
      </div>
    </div>
  );
}
