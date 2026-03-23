import { useState, useEffect } from 'react';
import useAuth from '../hooks/useAuth';
import Header from '../components/Header';
import MemberForm from './Members/MemberForm';
import api from '../services/api';

export default function Profile() {
  const { user, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [personData, setPersonData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.personId) {
      setLoading(true);
      api.get(`/persons/${user.personId}`)
        .then(res => setPersonData({ 
          ...res.data, 
          dataNascimento: res.data.dataNascimento?.substring(0, 10), 
          dataBatismo: res.data.dataBatismo?.substring(0, 10) 
        }))
        .catch(err => console.error("Erro ao carregar dados", err))
        .finally(() => setLoading(false));
    }
  }, [user]);

  const handleSave = async (data) => {
    try {
      await api.put(`/persons/${user.personId}`, data);
      setEditing(false);
      const res = await api.get(`/persons/${user.personId}`);
      setPersonData({ 
        ...res.data, 
        dataNascimento: res.data.dataNascimento?.substring(0, 10), 
        dataBatismo: res.data.dataBatismo?.substring(0, 10) 
      });
      alert("Dados atualizados com sucesso!");
    } catch (err) {
      alert("Erro ao atualizar dados.");
    }
  };

  return (
    <div>
      <Header title="Meu perfil" subtitle="Seus dados de acesso e cadastro" />

      {editing && personData ? (
        <div className="bg-white rounded-xl shadow-soft max-w-4xl mx-auto">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
             <h2 className="text-lg font-semibold text-slate-800">Editar meus dados</h2>
          </div>
          <MemberForm 
            initialData={personData}
            onSubmit={handleSave}
            onCancel={() => setEditing(false)}
            lockedCongregacao={user.role === 'user' ? personData.congregacao : undefined}
          />
        </div>
      ) : (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-soft p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Acesso ao Sistema</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-600">
              <div>
                <span className="block text-xs uppercase text-slate-400">Nome</span>
                <span className="font-medium text-slate-800">{user?.nome || '-'}</span>
              </div>
              <div>
                <span className="block text-xs uppercase text-slate-400">Login</span>
                <span className="font-medium text-slate-800">{user?.login || '-'}</span>
              </div>
              <div>
                <span className="block text-xs uppercase text-slate-400">Role</span>
                <span className="font-medium text-slate-800">{user?.role || '-'}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={logout} className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-4 py-2 rounded-lg font-medium transition">
                Sair da aplicação
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-soft p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Meus dados pessoais</h2>
            {loading ? (
              <p className="text-slate-500">Carregando...</p>
            ) : personData ? (
              <div>
                <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-600 mb-6">
                  <div>
                    <span className="block text-xs uppercase text-slate-400">Congregação</span>
                    <span className="font-medium text-slate-800">{personData.congregacao}</span>
                  </div>
                  <div>
                    <span className="block text-xs uppercase text-slate-400">Celular</span>
                    <span className="font-medium text-slate-800">{personData.celular || '-'}</span>
                  </div>
                  <div>
                    <span className="block text-xs uppercase text-slate-400">Tipo / Grupo</span>
                    <span className="font-medium text-slate-800 capitalize">{personData.tipo} {personData.grupo ? ` - ${personData.grupo}` : ''}</span>
                  </div>
                  <div>
                    <span className="block text-xs uppercase text-slate-400">Status</span>
                    <span className="font-medium text-slate-800 capitalize">{personData.status}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setEditing(true)} 
                  className="bg-ibbiBlue hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
                >
                  Editar meus dados
                </button>
              </div>
            ) : (
              <p className="text-slate-500">Nenhum dado cadastral vinculado encontrado.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
