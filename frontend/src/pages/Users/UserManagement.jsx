import { useEffect, useState } from 'react';
import Header from '../../components/Header';
import api from '../../services/api';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    const { data } = await api.get('/users');
    setUsers(data);
  };

  useEffect(() => {
    load();
  }, []);

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

  return (
    <div>
      <Header
        title="Usuários"
        subtitle="Gerenciamento de acessos"
        action={
          <button className="bg-ibbiBlue text-white px-4 py-2 rounded-lg" onClick={() => setShowCreate(true)}>
            Novo usuário
          </button>
        }
      />

      <div className="bg-white rounded-xl shadow-soft p-4 mb-4">
        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Buscar por nome"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Login</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users
              .filter((user) => user.nome?.toLowerCase().includes(search.toLowerCase()))
              .map((user) => (
              <tr key={user._id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3">{user.nome}</td>
                <td className="px-4 py-3">{user.login}</td>
                <td className="px-4 py-3">
                  <select
                    className="border rounded-lg px-2 py-1"
                    value={user.role}
                    onChange={(e) => updateRole(user._id, e.target.value)}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                    <option value="master">master</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    className="border rounded-lg px-2 py-1"
                    value={user.ativo ? 'ativo' : 'inativo'}
                    onChange={(e) => updateStatus(user._id, e.target.value === 'ativo')}
                  >
                    <option value="ativo">ativo</option>
                    <option value="inativo">inativo</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button className="text-red-600" onClick={() => removeUser(user._id)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl shadow-soft p-6 max-w-lg w-full">
            <h2 className="font-display text-xl text-ibbiNavy mb-4">Adicionar administrador</h2>
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Buscar membro"
              value={memberSearch}
              onChange={(e) => searchMembers(e.target.value)}
            />
            <div className="mt-3 max-h-40 overflow-y-auto">
              {memberResults.map((member) => (
                <button
                  key={member._id}
                  className={`w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 ${
                    selectedMember?._id === member._id ? 'bg-slate-100' : ''
                  }`}
                  onClick={() => setSelectedMember(member)}
                >
                  {member.nome}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="border rounded-lg px-4 py-2" onClick={() => setShowCreate(false)}>
                Cancelar
              </button>
              <button className="bg-ibbiBlue text-white rounded-lg px-4 py-2" onClick={createUser}>
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
