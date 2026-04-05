import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import Header from '../components/Header';
import MemberForm from './Members/MemberForm';
import api from '../services/api';

export default function Profile() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [highlightPhotoField, setHighlightPhotoField] = useState(false);
  const [personData, setPersonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirm, setSenhaConfirm] = useState('');

  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

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

  useEffect(() => {
    if (!location.state?.openEdit || !personData) return;

    setHighlightPhotoField(Boolean(location.state?.highlightPhoto));
    setEditing(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, personData]);

  const handleSave = async (data) => {
    try {
      await api.put(`/persons/${user.personId}`, data);
      setHighlightPhotoField(false);
      setEditing(false);
      const res = await api.get(`/persons/${user.personId}`);
      setPersonData({ 
        ...res.data, 
        dataNascimento: res.data.dataNascimento?.substring(0, 10), 
        dataBatismo: res.data.dataBatismo?.substring(0, 10) 
      });
      showToast("Dados atualizados com sucesso!");
    } catch (err) {
      alert("Erro ao atualizar dados.");
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (senhaNova !== senhaConfirm) {
      alert("As senhas não coincidem!");
      return;
    }
    if (senhaNova.length < 6) {
      alert("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    try {
      await api.put('/users/me/password', { senhaNova });
      showToast("Senha alterada com sucesso!");
      setChangingPassword(false);
      setSenhaNova('');
      setSenhaConfirm('');
    } catch (err) {
      alert("Erro ao alterar senha. Verifique se o backend tem a rota correta.");
    }
  };

  return (
    <div className="min-h-screen">
      <Header title="Meu perfil" subtitle="Seus dados de acesso e cadastro" />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">{toast}</span>
        </div>
      )}

      {editing && personData ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 max-w-4xl mx-auto mt-6">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center rounded-t-2xl bg-white sticky top-0 z-10">
             <div>
               <h2 className="text-xl font-bold text-slate-800 tracking-tight">Editar meus dados</h2>
               <p className="text-sm text-slate-500 mt-1">Atualize e confira suas informações pessoais abaixo.</p>
             </div>
             <button
               onClick={() => {
                 setHighlightPhotoField(false);
                 setEditing(false);
               }}
               className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
             >
               <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
               </svg>
             </button>
          </div>
          <MemberForm 
            initialData={personData}
            onSubmit={handleSave}
            onCancel={() => {
              setHighlightPhotoField(false);
              setEditing(false);
            }}
            lockedCongregacao={user.role === 'user' ? personData.congregacao : undefined}
            isSelfEdit={user.role === 'user'}
            highlightPhoto={highlightPhotoField}
          />
        </div>
      ) : (
        <div className="space-y-6 max-w-4xl mx-auto mt-6 px-4">
          
          {/* Sessão Dados Pessoais (Agora Em Cima) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">Meus dados pessoais</h2>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                </div>
              ) : personData ? (
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-1">Congregação</span>
                      <span className="font-semibold text-slate-800">{personData.congregacao}</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-1">Celular</span>
                      <span className="font-semibold text-slate-800">{personData.celular || '-'}</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-1">Tipo / Grupo</span>
                      <span className="font-semibold text-slate-800 capitalize">{personData.tipo} {personData.grupo ? `- ${personData.grupo}` : ''}</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-1">Status</span>
                      <span className="font-semibold text-slate-800 capitalize">{personData.status}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setEditing(true)} 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition shadow-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Editar meus dados
                  </button>
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <span className="text-3xl mb-3 block">📄</span>
                  <p className="text-slate-500 font-medium text-sm">Nenhum dado cadastral vinculado encontrado.</p>
                </div>
              )}
            </div>
          </div>

          {/* Sessão Dados de Acesso (Agora Embaixo) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">Acesso ao Sistema</h2>
            </div>
            <div className="p-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6 flex flex-col sm:flex-row gap-3 items-start sm:items-center text-amber-800 text-sm">
                <span className="text-xl shrink-0">💡</span>
                <p>
                  A senha padrão inicial do sistema é <strong>IBBI2026</strong>. Recomendamos que os usuários a alterem assim que possível para uma senha de sua preferência.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-600">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Nome de Exibição</span>
                  <span className="font-bold text-slate-800 text-base">{user?.nome || '-'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Nome de Usuário (Login)</span>
                  <span className="font-bold text-blue-600 bg-blue-50 px-3 py-1.5 border border-blue-100 rounded-lg inline-block text-base tracking-wide">{user?.login || '-'}</span>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button 
                  onClick={() => setChangingPassword(!changingPassword)} 
                  className="bg-stone-800 text-white hover:bg-stone-900 px-5 py-2.5 rounded-xl font-medium transition shadow-sm text-sm"
                >
                  Mudar minha senha
                </button>
              </div>

              {changingPassword && (
                <form onSubmit={handlePasswordChange} className="mt-6 border border-slate-200 rounded-xl p-6 bg-slate-50/50 animate-fade-in">
                  <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Definir Nova Senha
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Nova Senha</label>
                      <input 
                        type="password" 
                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition" 
                        value={senhaNova}
                        onChange={(e) => setSenhaNova(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Confirmar Nova Senha</label>
                      <input 
                        type="password" 
                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition" 
                        value={senhaConfirm}
                        onChange={(e) => setSenhaConfirm(e.target.value)}
                        placeholder="Repita a nova senha"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                  <div className="mt-5 flex gap-3 pt-5 border-t border-slate-200">
                    <button type="submit" className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition shadow-sm">
                      Salvar Nova Senha
                    </button>
                    <button type="button" onClick={() => setChangingPassword(false)} className="px-4 py-2.5 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 font-medium text-sm transition">
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
