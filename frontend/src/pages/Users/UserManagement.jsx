import { useEffect, useState } from 'react';
import Header from '../../components/Header';
import api from '../../services/api';
import useAuth from '../../hooks/useAuth';

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);

  const totalPages = Math.ceil(total / limit);

  const load = async () => {
    const { data } = await api.get('/users', { params: { search, page, limit } });
    if (Array.isArray(data)) {
      setUsers(data);
      setTotal(data.length);
    } else {
      setUsers(data.items || []);
      setTotal(data.total || 0);
    }
  };

  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { load(); }, [search, page, limit]);

  const searchMembers = async (value) => {
    setMemberSearch(value);
    if (!value) return setMemberResults([]);
    const { data } = await api.get('/persons', { params: { search: value, limit: 10 } });
    setMemberResults(data.items || []);
  };

  const createUser = async () => {
    if (!selectedMember) return;
    await api.post('/users', { personId: selectedMember._id, role: 'admin' });
    setShowCreate(false);
    setSelectedMember(null);
    setMemberResults([]);
    setMemberSearch('');
    await load();
  };

  const updateRole = async (userId, role) => {
    await api.put(`/users/${userId}/role`, { role });
    await load();
  };

  const updateStatus = async (userId, ativo) => {
    await api.put(`/users/${userId}/status`, { ativo });
    await load();
  };

  const removeUser = async (userId) => {
    if (!confirm('Excluir usuário?')) return;
    await api.delete(`/users/${userId}`);
    await load();
  };

  const resetPassword = async (userId) => {
    if (!confirm('Tem certeza que deseja resetar a senha deste usuário para o padrão?')) return;
    try {
      await api.put(`/users/${userId}/reset-password`);
      alert('Senha resetada para o padrão com sucesso!');
    } catch (err) {
      alert('Erro ao resetar senha.');
    }
  };


  return (
    <div>
      <Header
        title="Usuários"
        subtitle="Gerenciamento de acessos"
        action={
          <button className="bg-ibbiBlue text-white px-4 py-3 sm:py-2 min-h-[44px] rounded-lg font-medium" onClick={() => setShowCreate(true)}>
            Novo usuário
          </button>
        }
      />

      <div className="bg-white rounded-xl shadow-soft p-4 mb-4">
        <input
          className="w-full border rounded-lg px-3 py-3 sm:py-2 min-h-[44px] appearance-none focus:ring-2 focus:ring-blue-100 outline-none"
          placeholder="Buscar por nome"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl flex flex-col overflow-hidden shadow-soft">
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left border-y border-slate-100">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Congregação</th>
                <th className="px-4 py-3">Login</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users
                .map((user) => (
                <tr key={user._id} className="border-b hover:bg-slate-50 transition">
                  <td className="px-4 py-3">{user.nome}</td>
                  <td className="px-4 py-3">{user.congregacao || '-'}</td>
                  <td className="px-4 py-3">{user.login}</td>
                  <td className="px-4 py-3">
                    <select
                      className="border rounded-lg px-2 py-1 bg-white cursor-pointer"
                      value={user.role}
                      onChange={(e) => updateRole(user._id, e.target.value)}
                      disabled={currentUser?.role !== 'master' && user.role === 'master'}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                      <option value="master">master</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="border rounded-lg px-2 py-1 bg-white cursor-pointer"
                      value={user.ativo ? 'ativo' : 'inativo'}
                      onChange={(e) => updateStatus(user._id, e.target.value === 'ativo')}
                      disabled={currentUser?.role !== 'master' && user.role === 'master'}
                    >
                      <option value="ativo">ativo</option>
                      <option value="inativo">inativo</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right flex justify-end gap-3">
                    <button className="text-orange-500 hover:text-orange-700 font-medium" onClick={() => resetPassword(user._id)}>
                      Resetar Senha
                    </button>
                    <button className="text-red-500 hover:text-red-700 font-medium" onClick={() => removeUser(user._id)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden flex flex-col gap-3">
          {users
            .map((user) => (
            <div key={user._id} className="border border-slate-200 rounded-xl p-4 flex flex-col gap-3 bg-white">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{user.nome}</p>
                  <p className="text-xs text-slate-500">{user.login}</p>
                  <p className="text-xs text-slate-400 mt-1">{user.congregacao || '-'}</p>
                </div>
                <div className="flex gap-2">
                  <button className="text-orange-500 bg-orange-50 px-3 py-2 rounded-lg text-sm font-medium hover:bg-orange-100 transition" onClick={() => resetPassword(user._id)}>
                    Resetar
                  </button>
                  <button className="text-red-500 bg-red-50 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition" onClick={() => removeUser(user._id)}>
                    Excluir
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-1 pt-3 border-t border-slate-50">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500 font-medium">Permissão (Role)</span>
                  <select
                    className="border rounded-lg px-3 py-2 text-lg sm:text-base bg-slate-50 min-h-[44px]"
                    value={user.role}
                    onChange={(e) => updateRole(user._id, e.target.value)}
                    disabled={currentUser?.role !== 'master' && user.role === 'master'}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                    <option value="master">master</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500 font-medium">Status</span>
                  <select
                    className="border rounded-lg px-3 py-2 text-lg sm:text-base bg-slate-50 min-h-[44px]"
                    value={user.ativo ? 'ativo' : 'inativo'}
                    onChange={(e) => updateStatus(user._id, e.target.value === 'ativo')}
                    disabled={currentUser?.role !== 'master' && user.role === 'master'}
                  >
                    <option value="ativo">ativo</option>
                    <option value="inativo">inativo</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>

        {total > 0 && (
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-sm bg-white gap-3">
            <span className="text-slate-500">
              Mostrando {users.length} de {total}
            </span>
            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </button>
              <button
                className="px-3 py-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || totalPages === 0}
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-6 z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-soft max-w-lg w-full h-[90dvh] sm:h-auto flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="font-display text-lg font-semibold text-ibbiNavy">Adicionar administrador</h2>
              <button className="text-slate-400 hover:text-slate-600 p-2 -mr-2" onClick={() => setShowCreate(false)}>X</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              <input
                className="w-full border rounded-lg px-4 py-3 text-lg sm:text-base min-h-[44px] appearance-none focus:ring-2 focus:ring-blue-100 outline-none"
                placeholder="Buscar membro pelo nome..."
                value={memberSearch}
                onChange={(e) => searchMembers(e.target.value)}
              />
              <div className="flex flex-col gap-2 flex-1">
                {memberResults.map((member) => (
                  <button
                    key={member._id}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition min-h-[44px] ${
                      selectedMember?._id === member._id ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-700'
                    }`}
                    onClick={() => setSelectedMember(member)}
                  >
                    <div className="font-medium">{member.nome}</div>
                    <div className="text-xs text-slate-500 mt-1">{member.congregacao || '-'}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3 sticky bottom-0 bg-white w-full">
              <button className="border rounded-lg px-4 py-3 sm:py-2 min-h-[44px] w-full sm:w-auto font-medium text-slate-600 hover:bg-slate-50" onClick={() => setShowCreate(false)}>
                Cancelar
              </button>
              <button className="bg-ibbiBlue text-white rounded-lg px-4 py-3 sm:py-2 min-h-[44px] w-full sm:w-auto font-medium" onClick={createUser} disabled={!selectedMember}>
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
