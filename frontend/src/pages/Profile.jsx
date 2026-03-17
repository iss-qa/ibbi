import useAuth from '../hooks/useAuth';
import Header from '../components/Header';

export default function Profile() {
  const { user, logout } = useAuth();

  return (
    <div>
      <Header title="Meu perfil" subtitle="Seus dados de acesso" />

      <div className="bg-white rounded-xl shadow-soft p-6 max-w-2xl">
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
          <div>
            <span className="block text-xs uppercase text-slate-400">Status</span>
            <span className="font-medium text-slate-800">{user?.ativo ? 'Ativo' : 'Inativo'}</span>
          </div>
        </div>

        <div className="mt-6">
          <button onClick={logout} className="bg-ibbiBlue text-white px-4 py-2 rounded-lg">
            Sair da aplicação
          </button>
        </div>
      </div>
    </div>
  );
}
