import { useState, useEffect } from 'react';
import useAuth from '../hooks/useAuth';
import Header from '../components/Header';
import CarteirinhaModal from '../components/CarteirinhaModal';
import api from '../services/api';

export default function UserCarteirinha() {
  const { user } = useAuth();
  const [personData, setPersonData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.personId) return;
    setLoading(true);
    api.get(`/persons/${user.personId}`)
      .then(({ data }) => setPersonData(data))
      .catch((err) => console.error('Erro ao carregar dados:', err))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Carteirinha" subtitle="Sua carteirinha de membro" />
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!personData) {
    return (
      <div className="min-h-screen">
        <Header title="Carteirinha" subtitle="Sua carteirinha de membro" />
        <div className="text-center py-20 text-slate-500">Dados não encontrados.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Carteirinha" subtitle="Sua carteirinha de membro" />
      {/* Render the CarteirinhaModal directly — it shows as a modal overlay, which works well for viewing */}
      <CarteirinhaModal
        person={personData}
        onClose={() => window.history.back()}
        hideWhatsApp
        redirectToProfileOnMissingPhoto
      />
    </div>
  );
}
