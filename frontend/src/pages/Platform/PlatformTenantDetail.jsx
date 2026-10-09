import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import platformApi from '../../services/platformApi';
import { Badge, Button, Card, Field, KpiCard, Toggle, brl, fmtDate, inputClass } from '../../components/ui';
import { INVOICE_STATUS, PLAN_NAMES, TENANT_STATUS } from './constants';
import TenantWhatsappCard from './TenantWhatsappCard';

const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PlatformTenantDetail() {
  const { id } = useParams();
  const [t, setT] = useState(null);
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = () => platformApi.get(`/tenants/${id}`).then((r) => {
    setT(r.data);
    setForm({
      plano: r.data.plano,
      status: r.data.status,
      trialEndsAt: r.data.trialEndsAt ? r.data.trialEndsAt.slice(0, 10) : '',
      billing: { ciclo: r.data.billing?.ciclo || 'mensal', valorMensal: r.data.billing?.valorMensal ?? '', diaVencimento: r.data.billing?.diaVencimento || 10, isento: Boolean(r.data.billing?.isento) },
    });
  });
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    try {
      await platformApi.put(`/tenants/${id}`, {
        ...form,
        trialEndsAt: form.trialEndsAt || undefined,
        billing: { ...form.billing, valorMensal: form.billing.valorMensal === '' ? '' : Number(form.billing.valorMensal) },
      });
      setMsg({ ok: true, text: 'Salvo.' });
      load();
    } catch (err) {
      setMsg({ ok: false, text: err?.response?.data?.message || 'Falha ao salvar' });
    }
  };

  const gerarFatura = async () => {
    try {
      await platformApi.post(`/tenants/${id}/invoices`, {});
      load();
    } catch (err) {
      setMsg({ ok: false, text: err?.response?.data?.message || 'Falha ao gerar fatura' });
    }
  };

  const pagar = async (inv) => {
    const metodo = window.prompt('Forma de pagamento (pix, boleto, cartao, transferencia, dinheiro):', 'pix');
    if (!metodo) return;
    await platformApi.put(`/invoices/${inv._id}/pay`, { metodo });
    load();
  };

  if (!t || !form) return <p className="text-sm text-slate-500">Carregando...</p>;
  const st = TENANT_STATUS[t.status];

  return (
    <div className="space-y-4">
      <Link to="/platform/igrejas" className="text-sm text-ibbiBlue">← Igrejas</Link>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-ibbiNavy">{t.nome}</h1>
          <p className="text-sm text-slate-500">{t.slug} · {t.email || 'sem email'} · {t.responsavel || 'sem responsável'}</p>
        </div>
        <Badge color={st.color}>{st.label}</Badge>
      </header>
      {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="MRR" value={brl(t.mrr)} />
        <KpiCard label="Pessoas ativas" value={t.pessoasAtivas} />
        <KpiCard label="Usuários" value={t.usuarios} />
        <KpiCard label="Mensagens (30d)" value={t.mensagens30d} />
        <KpiCard label="WhatsApp" value={t.whatsapp?.provider === 'none' ? (t.whatsapp?.useEnvFallback ? 'Servidor' : 'Não config.') : t.whatsapp?.provider} />
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Assinatura" action={<Button onClick={save}>Salvar</Button>}>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Plano">
              <select className={inputClass} value={form.plano} onChange={(e) => setForm({ ...form, plano: e.target.value })}>
                {Object.entries(PLAN_NAMES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.entries(TENANT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <Field label="Ciclo">
              <select className={inputClass} value={form.billing.ciclo} onChange={(e) => setForm({ ...form, billing: { ...form.billing, ciclo: e.target.value } })}>
                <option value="mensal">Mensal</option><option value="anual">Anual</option>
              </select>
            </Field>
            <Field label="Valor mensal negociado" hint="Vazio = preço do plano">
              <input type="number" min="0" step="0.01" className={inputClass} value={form.billing.valorMensal} onChange={(e) => setForm({ ...form, billing: { ...form.billing, valorMensal: e.target.value } })} />
            </Field>
            <Field label="Dia de vencimento">
              <input type="number" min="1" max="28" className={inputClass} value={form.billing.diaVencimento} onChange={(e) => setForm({ ...form, billing: { ...form.billing, diaVencimento: Number(e.target.value) } })} />
            </Field>
            <Field label="Fim do trial">
              <input type="date" className={inputClass} value={form.trialEndsAt} onChange={(e) => setForm({ ...form, trialEndsAt: e.target.value })} />
            </Field>
            <div className="sm:col-span-2"><Toggle checked={form.billing.isento} onChange={(v) => setForm({ ...form, billing: { ...form.billing, isento: v } })} label="Isento de cobrança (cortesia / cliente fundador)" /></div>
          </div>
        </Card>

        <Card title="Consumo mensal" subtitle="Custo de IA: ~ = estimado pelos tokens (antes do registro por chamada)">
          {t.consumo[0] && (
            <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-2 mb-4 text-center">
              {[
                ['Custo IA no mês', `${t.consumo[0].iaCusto.estimado ? '~' : ''}${money(t.consumo[0].iaCusto.brl)}`],
                ['Por interação', money(t.consumo[0].iaCusto.porInteracaoBrl)],
                [t.billing?.isento ? 'Preço do plano (isento)' : 'Margem após IA', money((t.billing?.isento ? t.precoPlano : t.mrr) - (t.billing?.isento ? 0 : t.consumo[0].iaCusto.brl))],
              ].map(([label, v]) => (
                <div key={label} className="rounded-lg bg-slate-50 border border-slate-100 p-2">
                  <p className="text-lg font-semibold text-ibbiNavy tabular-nums">{v}</p>
                  <p className="text-[11px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          )}
          <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap [&_td+td]:pl-3 [&_th+th]:pl-3">
            <thead><tr className="text-left text-slate-500"><th className="py-1">Mês</th><th className="text-right">WhatsApp</th><th className="text-right">Recebidas</th><th className="text-right">IA</th><th className="text-right">Tokens (entrada)</th><th className="text-right">Cache</th><th className="text-right">Custo IA</th></tr></thead>
            <tbody className="tabular-nums">
              {t.consumo.map((c) => (
                <tr key={c.periodo} className="border-t border-slate-100">
                  <td className="py-1">{c.periodo}</td><td className="text-right">{c.whatsappEnviadas}</td><td className="text-right">{c.whatsappRecebidas || 0}</td><td className="text-right">{c.iaInteracoes}</td><td className="text-right">{(c.iaInputTokens || 0).toLocaleString('pt-BR')}</td>
                  <td className="text-right">{c.iaCusto.cachePct}%</td>
                  <td className="text-right" title={`US$ ${c.iaCusto.usd}`}>{c.iaCusto.estimado ? '~' : ''}{money(c.iaCusto.brl)}</td>
                </tr>
              ))}
              {!t.consumo.length && <tr><td colSpan={7} className="text-slate-400 py-2">Sem consumo registrado.</td></tr>}
            </tbody>
          </table>
          </div>
        </Card>
      </div>

      <TenantWhatsappCard tenant={t} onSaved={load} />

      <Card title="Faturas" action={<Button variant="outline" onClick={gerarFatura}>Gerar fatura do mês</Button>}>
        <ul className="divide-y divide-slate-100">
          {t.faturas.map((f) => {
            const s = INVOICE_STATUS[f.status];
            return (
              <li key={f._id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                <div>
                  <p>{f.descricao}</p>
                  <p className="text-xs text-slate-500">Vence {fmtDate(f.vencimento)}{f.pagoEm ? ` · pago ${fmtDate(f.pagoEm)} (${f.metodo})` : ''}{f.gateway?.id ? ` · ${f.gateway.provider} ${f.gateway.id}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums font-medium">{brl(f.valor)}</span>
                  <Badge color={s.color}>{s.label}</Badge>
                  {['pendente', 'vencido'].includes(f.status) && <Button variant="ghost" className="text-xs" onClick={() => pagar(f)}>Dar baixa</Button>}
                </div>
              </li>
            );
          })}
          {!t.faturas.length && <li className="text-sm text-slate-400 py-2">Nenhuma fatura.</li>}
        </ul>
      </Card>
    </div>
  );
}
