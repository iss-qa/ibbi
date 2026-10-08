import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import platformApi from '../../services/platformApi';
import { Badge, Button, Card, Field, Modal, Toggle, brl, fmtDate, inputClass } from '../../components/ui';
import { PLAN_NAMES, TENANT_STATUS } from './constants';

const slugify = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function NewTenantModal({ onClose, onCreated }) {
  const [f, setF] = useState({ nome: '', slug: '', email: '', telefone: '', documento: '', responsavel: '', cidade: '', uf: '', plano: 'crescer', ciclo: 'mensal', trial: true, congregacoes: 'Sede', masterNome: '', masterCelular: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v, ...(k === 'nome' && !x.slugTouched ? { slug: slugify(v) } : {}) }));

  const submit = async () => {
    setError('');
    try {
      const { data } = await platformApi.post('/tenants', {
        ...f,
        congregacoes: f.congregacoes.split('\n').map((c) => c.trim()).filter(Boolean),
        master: { nome: f.masterNome || f.responsavel, celular: f.masterCelular, email: f.email },
      });
      setResult(data);
      onCreated();
    } catch (err) {
      setError(err?.response?.data?.message || 'Falha ao criar');
    }
  };

  if (result) {
    return (
      <Modal title="Igreja criada ✅" onClose={onClose} footer={<Button onClick={onClose}>Fechar</Button>}>
        <p className="text-sm text-slate-600 mb-3">Envie ao responsável (a senha só aparece agora; troca obrigatória no 1º acesso):</p>
        <div className="bg-slate-50 rounded-lg p-3 text-sm font-mono space-y-1">
          <p>Código da igreja: <strong>{result.tenant.slug}</strong></p>
          <p>Login: <strong>{result.credenciais.login}</strong></p>
          <p>Senha temporária: <strong>{result.credenciais.senhaTemporaria}</strong></p>
          <p>Acesso: {window.location.origin}/login?igreja={result.tenant.slug}</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Nova igreja parceira" onClose={onClose} wide footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={!f.nome || !f.slug}>Criar igreja</Button></>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Nome da igreja"><input className={inputClass} value={f.nome} onChange={(e) => set('nome', e.target.value)} /></Field>
        <Field label="Código (slug)" hint="Usado no login e na URL"><input className={inputClass} value={f.slug} onChange={(e) => setF((x) => ({ ...x, slug: slugify(e.target.value), slugTouched: true }))} /></Field>
        <Field label="CNPJ"><input className={inputClass} value={f.documento} onChange={(e) => set('documento', e.target.value)} /></Field>
        <Field label="Email financeiro"><input className={inputClass} value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Telefone"><input className={inputClass} value={f.telefone} onChange={(e) => set('telefone', e.target.value)} /></Field>
        <Field label="Responsável"><input className={inputClass} value={f.responsavel} onChange={(e) => set('responsavel', e.target.value)} /></Field>
        <Field label="Cidade"><input className={inputClass} value={f.cidade} onChange={(e) => set('cidade', e.target.value)} /></Field>
        <Field label="UF"><input className={inputClass} maxLength={2} value={f.uf} onChange={(e) => set('uf', e.target.value.toUpperCase())} /></Field>
        <Field label="Plano">
          <select className={inputClass} value={f.plano} onChange={(e) => set('plano', e.target.value)}>
            {Object.entries(PLAN_NAMES).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        </Field>
        <Field label="Ciclo">
          <select className={inputClass} value={f.ciclo} onChange={(e) => set('ciclo', e.target.value)}>
            <option value="mensal">Mensal</option><option value="anual">Anual</option>
          </select>
        </Field>
        <Field label="Master inicial — nome"><input className={inputClass} value={f.masterNome} onChange={(e) => set('masterNome', e.target.value)} /></Field>
        <Field label="Master inicial — WhatsApp"><input className={inputClass} value={f.masterCelular} onChange={(e) => set('masterCelular', e.target.value)} /></Field>
        <Field label="Congregações (uma por linha)"><textarea className={`${inputClass} min-h-[90px]`} value={f.congregacoes} onChange={(e) => set('congregacoes', e.target.value)} /></Field>
        <div className="pt-6"><Toggle checked={f.trial} onChange={(v) => set('trial', v)} label="Começar com 14 dias de teste" /></div>
      </div>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </Modal>
  );
}

export default function PlatformTenants() {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const status = params.get('status') || '';

  const load = () => platformApi.get('/tenants', { params: { status: status || undefined, q: q || undefined } }).then((r) => setRows(r.data)).catch(() => {});
  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-ibbiNavy">Igrejas parceiras</h1>
          <p className="text-sm text-slate-500">{rows.length} igreja(s)</p>
        </div>
        <Button onClick={() => setShowNew(true)}>+ Nova igreja</Button>
      </header>
      <div className="flex flex-col sm:flex-row gap-2">
        <form className="flex gap-2 flex-1" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <input className={inputClass} placeholder="Buscar por nome ou código" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button type="submit" variant="outline">Buscar</Button>
        </form>
        <select className={`${inputClass} sm:w-48`} value={status} onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})} aria-label="Filtrar status">
          <option value="">Todos os status</option>
          {Object.entries(TENANT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-2 pr-3">Igreja</th><th className="pr-3">Status</th><th className="pr-3">Plano</th><th className="pr-3 text-right">MRR</th>
                <th className="pr-3 text-right">Pessoas</th><th className="pr-3 text-right">WhatsApp/mês</th><th className="pr-3 text-right">IA/mês</th><th className="pr-3 text-right" title="Custo de IA neste mês (~ = estimado pelos tokens)">Custo IA</th><th className="pr-3 text-right">Em atraso</th><th>Desde</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const st = TENANT_STATUS[t.status];
                return (
                  <tr key={t._id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 pr-3">
                      <Link to={`/platform/igrejas/${t._id}`} className="font-medium text-ibbiBlue hover:underline">{t.nome}</Link>
                      <p className="text-xs text-slate-400">{t.slug}{t.cidade ? ` · ${t.cidade}/${t.uf || ''}` : ''} · {t.congregacoes} congregação(ões)</p>
                    </td>
                    <td className="pr-3"><Badge color={st.color}>{st.label}</Badge></td>
                    <td className="pr-3">{PLAN_NAMES[t.plano]}{t.isento ? ' · isento' : ''}</td>
                    <td className="pr-3 text-right tabular-nums">{brl(t.mrr)}</td>
                    <td className="pr-3 text-right tabular-nums">{t.pessoasAtivas}</td>
                    <td className="pr-3 text-right tabular-nums">{t.whatsappMes}</td>
                    <td className="pr-3 text-right tabular-nums">{t.iaMes}</td>
                    <td className={`pr-3 text-right tabular-nums ${t.mrr && t.iaCustoMes?.brl > t.mrr * 0.3 ? 'text-red-600 font-semibold' : ''}`} title={t.iaCustoMes ? `US$ ${t.iaCustoMes.usd} · ${t.iaCustoMes.cachePct}% da entrada via cache` : ''}>
                      {t.iaCustoMes?.estimado ? '~' : ''}{Number(t.iaCustoMes?.brl || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className={`pr-3 text-right tabular-nums ${t.emAberto ? 'text-red-600' : ''}`}>{brl(t.emAberto)}</td>
                    <td className="text-xs text-slate-500">{fmtDate(t.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {showNew && <NewTenantModal onClose={() => setShowNew(false)} onCreated={load} />}
    </div>
  );
}
