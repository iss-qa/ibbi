import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../../components/Header';
import api from '../../services/api';
import useAuth from '../../hooks/useAuth';
import useCongregacaoScope from '../../hooks/useCongregacaoScope';
import { Badge, Button, KpiCard, inputClass } from '../../components/ui';

const classes = ['Crianças', 'Adolescentes', 'Jovens', 'Adultos 1', 'Adultos 2', 'Idosos', 'Anciãos'];
const ordemClasse = (c) => { const i = classes.indexOf(c); return i < 0 ? 99 : i; };

// Datas das aulas ficam ao meio-dia UTC: formatar em UTC mantém o domingo certo.
const fmtDia = (d) => new Date(d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const fmtCurta = (d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const nomeMes = (key) => {
  const [y, m] = key.split('-').map(Number);
  const nome = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${y}`;
};
const corPct = (v) => (v === null || v === undefined ? 'text-slate-400' : v >= 75 ? 'text-emerald-600' : v >= 50 ? 'text-amber-600' : 'text-rose-600');
const barraPct = (v) => (v >= 75 ? 'bg-emerald-500' : v >= 50 ? 'bg-amber-500' : 'bg-rose-500');
const selectCompacto = 'bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ibbiBlue/40';
const fmtPct = (v) => (v === null || v === undefined ? '—' : `${v}%`);

function Tendencia({ valor }) {
  if (valor === null || valor === undefined || Math.abs(valor) < 3) return <span className="text-xs text-slate-400">estável</span>;
  return valor > 0
    ? <span className="text-xs font-medium text-emerald-600">▲ {valor} pts</span>
    : <span className="text-xs font-medium text-rose-600">▼ {Math.abs(valor)} pts</span>;
}

// Raiz: indicadores + um card por classe/congregação
function Painel({ congregacao, ano, onAno, onAbrir, congregacaoFiltro }) {
  const [dados, setDados] = useState(null);
  useEffect(() => {
    setDados(null);
    api.get('/ebd/painel', { params: { ano, ...(congregacao ? { congregacao } : {}) } }).then((r) => setDados(r.data)).catch(() => setDados({ erro: true }));
  }, [ano, congregacao]);

  if (!dados) return <p className="text-sm text-slate-500">Carregando…</p>;
  if (dados.erro) return <p className="text-sm text-red-600">Não foi possível carregar a EBD.</p>;
  const { kpis } = dados;
  const grupos = [...dados.grupos].sort((a, b) => ordemClasse(a.classe) - ordemClasse(b.classe) || a.congregacao.localeCompare(b.congregacao));

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Aulas neste mês" value={kpis.aulasMes} />
        <KpiCard label="Presença média no mês" value={fmtPct(kpis.mediaMes)} accent={corPct(kpis.mediaMes)} hint={kpis.mediaAno !== null ? `No ano: ${kpis.mediaAno}%` : undefined} />
        <KpiCard
          label="Último domingo"
          value={kpis.ultimoDomingo ? fmtPct(kpis.ultimoDomingo.pct) : '—'}
          accent={corPct(kpis.ultimoDomingo?.pct)}
          hint={kpis.ultimoDomingo ? `${kpis.ultimoDomingo.presentes} de ${kpis.ultimoDomingo.total} · ${fmtCurta(`${kpis.ultimoDomingo.data}T12:00:00Z`)}` : undefined}
        />
        <KpiCard label="Classes com aula" value={kpis.classes} hint={`em ${dados.ano}`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="font-display text-xl text-ibbiNavy">Classes</h2>
        <div className="flex flex-wrap gap-2">
          {congregacaoFiltro}
          <select className={selectCompacto} value={ano} onChange={(e) => onAno(Number(e.target.value))} aria-label="Ano">
            {dados.anosDisponiveis.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {!grupos.length && <p className="text-sm text-slate-500 bg-white rounded-2xl p-6 text-center">Nenhuma aula registrada em {dados.ano}.</p>}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {grupos.map((g) => (
          <button
            key={`${g.classe}|${g.congregacao}`}
            type="button"
            onClick={() => onAbrir(g)}
            className="text-left bg-white rounded-2xl border border-stone-200/60 shadow-[0_1px_2px_rgba(10,31,68,0.04)] p-4 sm:p-5 transition hover:shadow-soft hover:-translate-y-0.5 min-w-0"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display text-lg text-ibbiNavy truncate">{g.classe}</p>
                <p className="text-xs text-slate-500 truncate">{g.congregacao}</p>
              </div>
              <Badge color="navy">{g.aulas} aula{g.aulas === 1 ? '' : 's'}</Badge>
            </div>
            <div className="mt-4 flex items-end justify-between gap-2">
              <div>
                <p className="text-[11px] text-slate-500">Presença média</p>
                <p className={`text-3xl font-semibold tabular-nums ${corPct(g.media)}`}>{fmtPct(g.media)}</p>
              </div>
              <Tendencia valor={g.tendencia} />
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full ${barraPct(g.media ?? 0)}`} style={{ width: `${g.media ?? 0}%` }} />
            </div>
            {g.ultima && (
              <p className="mt-3 text-xs text-slate-500">
                Última: <span className="text-slate-700">{fmtDia(g.ultima.data)}</span> · {g.ultima.presentes} de {g.ultima.total} ({fmtPct(g.ultima.pct)})
              </p>
            )}
          </button>
        ))}
      </div>
    </>
  );
}

// Dentro do card: aulas da classe organizadas por mês
function AulasDaClasse({ classe, congregacao, ano, onAno, onEditar, onExcluir, podeExcluir, recarregar }) {
  const navigate = useNavigate();
  const [aulas, setAulas] = useState(null);
  const [busca, setBusca] = useState('');
  const [fechados, setFechados] = useState([]);

  useEffect(() => {
    setAulas(null);
    api.get('/ebd', { params: { classe, congregacao, ano, resumo: 1 } }).then((r) => setAulas(r.data)).catch(() => setAulas([]));
  }, [classe, congregacao, ano, recarregar]);

  const meses = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const mapa = new Map();
    (aulas || []).filter((a) => !termo || `${a.tema || ''} ${a.descricao || ''}`.toLowerCase().includes(termo)).forEach((a) => {
      const key = new Date(a.data).toISOString().slice(0, 7);
      if (!mapa.has(key)) mapa.set(key, []);
      mapa.get(key).push(a);
    });
    return [...mapa.entries()].map(([key, lista]) => {
      const pcts = lista.filter((a) => a.total).map((a) => Math.round((a.presentes / a.total) * 100));
      return { key, lista, media: pcts.length ? Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length) : null };
    });
  }, [aulas, busca]);

  const alternar = (key) => setFechados((f) => (f.includes(key) ? f.filter((k) => k !== key) : [...f, key]));

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input className={`${inputClass} sm:max-w-xs`} placeholder="Buscar por tema" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className={selectCompacto} value={ano} onChange={(e) => onAno(Number(e.target.value))} aria-label="Ano">
          {[new Date().getFullYear() + 1, new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {!aulas && <p className="text-sm text-slate-500">Carregando…</p>}
      {aulas && !meses.length && <p className="text-sm text-slate-500 bg-white rounded-2xl p-6 text-center">Nenhuma aula de {classe} em {ano}{busca ? ' com esse tema' : ''}.</p>}

      <div className="space-y-3">
        {meses.map((m) => {
          const aberto = !fechados.includes(m.key);
          return (
            <section key={m.key} className="bg-white rounded-2xl border border-stone-200/60 shadow-[0_1px_2px_rgba(10,31,68,0.04)] overflow-hidden">
              <button type="button" onClick={() => alternar(m.key)} aria-expanded={aberto} className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3 text-left hover:bg-stone-50">
                <span className="min-w-0">
                  <span className="font-display text-lg text-ibbiNavy">{nomeMes(m.key)}</span>
                  <span className="block text-xs text-slate-500">{m.lista.length} aula{m.lista.length === 1 ? '' : 's'} · média <span className={corPct(m.media)}>{fmtPct(m.media)}</span></span>
                </span>
                <svg className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${aberto ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" /></svg>
              </button>
              {aberto && (
                <ul className="ml-4 sm:ml-6 mr-3 sm:mr-5 mb-3 border-l-2 border-ibbiGold/40">
                  {m.lista.map((aula) => {
                    const p = aula.total ? Math.round((aula.presentes / aula.total) * 100) : null;
                    return (
                      <li key={aula._id} className="pl-3 sm:pl-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-50 last:border-0">
                        <button type="button" className="flex-1 min-w-[12rem] text-left" onClick={() => navigate(`/ebd/${aula._id}`)}>
                          <span className="block text-sm font-medium text-slate-800 capitalize">{fmtDia(aula.data)}</span>
                          <span className="block text-xs text-slate-500 break-words">{aula.tema || 'Sem tema'}</span>
                        </button>
                        <span className={`text-sm tabular-nums ${corPct(p)}`}>{aula.total ? `${aula.presentes}/${aula.total} · ${p}%` : 'sem chamada'}</span>
                        <span className="flex gap-3 text-sm">
                          <button type="button" className="text-ibbiBlue hover:underline" onClick={() => onEditar(aula)}>Editar</button>
                          {podeExcluir && <button type="button" className="text-red-600 hover:underline" onClick={() => onExcluir(aula)}>Excluir</button>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

export default function EbdList() {
  const { user } = useAuth();
  const { locked: lockedCongregacao, options: congregacaoOptions } = useCongregacaoScope();
  const [params, setParams] = useSearchParams();
  const classeSel = params.get('classe');
  const congSel = params.get('congregacao');
  const [ano, setAno] = useState(() => Number(params.get('ano')) || new Date().getFullYear());
  const [filtroCong, setFiltroCong] = useState(lockedCongregacao || '');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ data: '', classe: 'Jovens', congregacao: congregacaoOptions[0] || 'Sede', tema: '', descricao: '' });
  const [error, setError] = useState('');
  const [versao, setVersao] = useState(0);

  useEffect(() => { if (lockedCongregacao) setFiltroCong(lockedCongregacao); }, [lockedCongregacao]);

  const abrirClasse = (g) => setParams({ classe: g.classe, congregacao: g.congregacao, ano: String(ano) });
  const voltar = () => setParams(ano !== new Date().getFullYear() ? { ano: String(ano) } : {});

  const resetForm = useCallback(() => {
    setEditing(null);
    setForm({ data: '', classe: classeSel || 'Jovens', congregacao: lockedCongregacao || congSel || congregacaoOptions[0] || 'Sede', tema: '', descricao: '' });
    setError('');
  }, [classeSel, congSel, lockedCongregacao, congregacaoOptions]);

  const novaAula = () => { resetForm(); setShowForm(true); };

  const editar = (aula) => {
    setEditing(aula);
    setForm({
      data: new Date(aula.data).toISOString().slice(0, 10),
      classe: aula.classe,
      congregacao: lockedCongregacao || aula.congregacao || 'Sede',
      tema: aula.tema || '',
      descricao: aula.descricao || '',
    });
    setError('');
    setShowForm(true);
  };

  const saveAula = async () => {
    try {
      if (editing) {
        await api.put(`/ebd/${editing._id}`, form);
      } else {
        await api.post('/ebd', form);
      }
      setShowForm(false);
      resetForm();
      setVersao((v) => v + 1);
    } catch (err) {
      setError(err?.response?.data?.message || 'Erro ao salvar');
    }
  };

  const removeAula = async (aula) => {
    if (!confirm('Excluir esta aula?')) return;
    await api.delete(`/ebd/${aula._id}`);
    setVersao((v) => v + 1);
  };

  return (
    <div>
      {classeSel && (
        <button type="button" onClick={voltar} className="text-sm text-ibbiBlue hover:underline mb-2">← Todas as classes</button>
      )}
      <Header
        title={classeSel ? `EBD · ${classeSel}` : 'EBD'}
        subtitle={classeSel ? `${congSel} · aulas por mês` : 'Frequência por classe e congregação'}
        action={<Button onClick={novaAula}>+ Nova aula</Button>}
      />

      {classeSel ? (
        <AulasDaClasse
          classe={classeSel}
          congregacao={congSel}
          ano={ano}
          onAno={setAno}
          onEditar={editar}
          onExcluir={removeAula}
          podeExcluir={user?.role === 'master'}
          recarregar={versao}
        />
      ) : (
        <Painel
          key={versao}
          congregacao={filtroCong}
          ano={ano}
          onAno={setAno}
          onAbrir={abrirClasse}
          congregacaoFiltro={!lockedCongregacao && (
            <select className={selectCompacto} value={filtroCong} onChange={(e) => setFiltroCong(e.target.value)} aria-label="Congregação">
              <option value="">Todas as congregações</option>
              {congregacaoOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        />
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center sm:p-6 z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-soft w-full max-w-lg h-[90dvh] sm:h-auto flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10 sm:rounded-t-xl shrink-0">
              <h2 className="font-display text-xl text-ibbiNavy">{editing ? 'Editar Aula' : 'Nova Aula'}</h2>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Data da aula</label>
                <input type="date" className="w-full border rounded-lg px-3 py-2.5 sm:py-2 text-lg sm:text-base min-h-[44px] appearance-none" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Classe</label>
                <select className="w-full border rounded-lg px-3 py-2.5 sm:py-2 text-lg sm:text-base min-h-[44px] appearance-none" value={form.classe} onChange={(e) => setForm({ ...form, classe: e.target.value })}>
                  {classes.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Congregação</label>
                <select className="w-full border rounded-lg px-3 py-2.5 sm:py-2 text-lg sm:text-base min-h-[44px] appearance-none disabled:bg-slate-100 disabled:text-slate-500" value={lockedCongregacao || form.congregacao} onChange={(e) => setForm({ ...form, congregacao: e.target.value })} disabled={Boolean(lockedCongregacao)}>
                  {congregacaoOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Tema (Opcional)</label>
                <input className="w-full border rounded-lg px-3 py-2.5 sm:py-2 text-base sm:text-sm min-h-[44px] appearance-none" placeholder="Tema" value={form.tema} onChange={(e) => setForm({ ...form, tema: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Descrição (Opcional)</label>
                <textarea className="w-full border rounded-lg px-3 py-2.5 sm:py-2 text-base sm:text-sm min-h-[44px] resize-none" placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3 sticky bottom-0 bg-white z-10 w-full shrink-0 items-center">
              <button className="border rounded-lg px-4 py-3 sm:py-2 min-h-[44px] w-full sm:w-auto font-medium text-slate-600 hover:bg-slate-50 text-base sm:text-sm" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</button>
              <button className="bg-ibbiBlue hover:bg-ibbiNavy transition text-white rounded-lg px-4 py-3 sm:py-2 min-h-[44px] w-full sm:w-auto font-medium text-base sm:text-sm" onClick={saveAula}>Salvar aula</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
