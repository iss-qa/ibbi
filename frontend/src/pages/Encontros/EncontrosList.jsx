import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import api from '../../services/api';
import { Button, Card, Modal } from '../../components/ui';
import useCongregacaoScope from '../../hooks/useCongregacaoScope';
import GrupoForm from './GrupoForm';
import { DIAS } from './shared';

// Grupos que se reúnem (uniões, louvor, células) — frequência alimenta o Cuidado Pastoral.
export default function EncontrosList() {
  const navigate = useNavigate();
  const { options: congregacoes } = useCongregacaoScope();
  const [congregacao, setCongregacao] = useState('Todos');
  const [grupos, setGrupos] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const load = () => api.get('/encontros/grupos', { params: { congregacao } }).then((r) => setGrupos(r.data)).catch(() => setGrupos([]));
  useEffect(() => { load(); }, [congregacao]); // eslint-disable-line react-hooks/exhaustive-deps

  const criar = async (payload) => {
    const { data } = await api.post('/encontros/grupos', payload);
    setShowNew(false);
    navigate(`/encontros/grupos/${data._id}`);
  };

  return (
    <div>
      <Header
        title="Encontros"
        subtitle="Uniões, louvor e grupos que se reúnem durante a semana — frequência e cuidado com quem se afasta"
        action={(
          <div className="flex gap-2 w-full md:w-auto">
            {congregacoes.length > 1 && (
              <select className="border rounded-lg px-3 py-2 text-sm" value={congregacao} onChange={(e) => setCongregacao(e.target.value)} aria-label="Congregação">
                <option value="Todos">Todas</option>
                {congregacoes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <Button onClick={() => setShowNew(true)}>+ Novo grupo</Button>
          </div>
        )}
      />

      {grupos && grupos.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <p className="font-display text-xl text-ibbiNavy">Nenhum grupo cadastrado</p>
            <p className="text-sm text-slate-500 mt-1 mb-4">Comece pela União Feminina ou Masculina: os membros entram automaticamente pelos critérios (sexo e idade).</p>
            <Button onClick={() => setShowNew(true)}>Criar o primeiro grupo</Button>
          </div>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...(grupos || [])].sort((a, b) => (a.tipo === 'ebd') - (b.tipo === 'ebd')).map((g) => {
          const u = g.ultimoEncontro;
          const pct = u?.total ? Math.round((u.presentes / u.total) * 100) : null;
          return (
            <Link key={g._id} to={`/encontros/grupos/${g._id}`} className="bg-white rounded-2xl border border-stone-100 p-5 hover:shadow-soft transition block">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-display text-lg text-ibbiNavy truncate">{g.nome}</h3>
                  <p className="text-xs text-slate-500">{g.congregacao} · {DIAS[g.diaSemana]} {g.horario}{g.local ? ` · ${g.local}` : ''}</p>
                  {g.ebdClasses?.length > 0 && <p className="text-[11px] text-blue-700 mt-0.5">+ aulas da EBD {g.ebdClasses.join(', ')}</p>}
                </div>
                {g.tipo === 'ebd' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 shrink-0" title="Espelho automático das aulas da EBD">EBD</span>}
                {g.convocarChamada && g.tipo !== 'ebd' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 shrink-0" title="Chamada pedida no WhatsApp">WhatsApp</span>}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <div className="bg-slate-50 rounded-lg py-2"><p className="text-lg font-semibold text-ibbiNavy tabular-nums">{g.totalMembros}</p><p className="text-[10px] text-slate-500">membros</p></div>
                <div className="bg-slate-50 rounded-lg py-2"><p className="text-lg font-semibold text-ibbiNavy tabular-nums">{u?.encontros || 0}</p><p className="text-[10px] text-slate-500">encontros</p></div>
                <div className="bg-slate-50 rounded-lg py-2"><p className="text-lg font-semibold text-ibbiNavy tabular-nums">{pct === null ? '—' : `${pct}%`}</p><p className="text-[10px] text-slate-500">último</p></div>
              </div>
              <p className="text-xs text-slate-400 mt-3 truncate">
                {g.tipo === 'ebd' ? 'Aulas registradas no menu EBD' : g.lideres?.length ? `Liderança: ${g.lideres.map((l) => l.nome.split(' ')[0]).join(', ')}` : 'Sem líderes definidos'}
                {u ? ` · último em ${new Date(u.data).toLocaleDateString('pt-BR')}` : ''}
              </p>
            </Link>
          );
        })}
      </div>

      {showNew && (
        <Modal title="Novo grupo" onClose={() => setShowNew(false)} wide>
          <GrupoForm onSubmit={criar} submitLabel="Criar grupo" />
        </Modal>
      )}
    </div>
  );
}
