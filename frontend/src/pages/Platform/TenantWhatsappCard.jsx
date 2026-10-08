import { useEffect, useState } from 'react';
import platformApi from '../../services/platformApi';
import { Badge, Button, Card, Field, fmtDateTime, inputClass } from '../../components/ui';

// Instância de WhatsApp da igreja (configurada pela operação da plataforma no onboarding).
export default function TenantWhatsappCard({ tenant, onSaved }) {
  const wa = tenant.whatsapp || {};
  const [f, setF] = useState({
    provider: wa.provider === 'none' ? 'evolution' : wa.provider || 'evolution',
    instance: wa.evolution?.instance || '',
    numeroInstancia: wa.numeroInstancia || '',
    apiKey: '',
    url: wa.evolution?.url || '',
    numeroIgreja: wa.numeroIgreja || '',
  });
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const testar = async () => {
    setStatus({ carregando: true });
    try {
      const { data } = await platformApi.post(`/tenants/${tenant._id}/whatsapp/test`);
      setStatus(data);
    } catch (err) {
      setStatus({ online: false, error: err?.response?.data?.message || err.message });
    }
  };
  useEffect(() => { testar(); }, [tenant._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { data } = await platformApi.put(`/tenants/${tenant._id}/whatsapp`, {
        provider: f.provider,
        numeroInstancia: f.numeroInstancia,
        numeroIgreja: f.numeroIgreja,
        evolution: { instance: f.instance, url: f.url, ...(f.apiKey ? { apiKey: f.apiKey } : {}) },
      });
      setMsg({ ok: true, text: data.mudou ? 'Instância salva. Se estiver conectada, a liderança recebe a apresentação do número automaticamente.' : 'Nada mudou na conexão.' });
      setF((x) => ({ ...x, apiKey: '' }));
      await testar();
      onSaved?.();
    } catch (err) {
      setMsg({ ok: false, text: err?.response?.data?.message || 'Falha ao salvar' });
    } finally {
      setBusy(false);
    }
  };

  const apresentar = async () => {
    if (!window.confirm('Enviar a mensagem "salve nosso contato" (com o cartão de contato) para toda a liderança desta igreja?')) return;
    setBusy(true);
    try {
      const { data } = await platformApi.post(`/tenants/${tenant._id}/whatsapp/apresentar`, { forcar: true });
      setMsg({ ok: true, text: `Apresentação em fila para ${data.enviados} líder(es) — 1 mensagem a cada 45–90s.` });
      onSaved?.();
    } catch (err) {
      setMsg({ ok: false, text: err?.response?.data?.message || 'Falha ao enviar' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="WhatsApp da igreja"
      subtitle={wa.evolution?.origem === 'servidor (.env)' ? 'Hoje usa a instância padrão do servidor (.env). Preencha para usar uma instância própria.' : 'Instância que envia as mensagens desta igreja'}
      action={status && !status.carregando && (
        <Badge color={status.online ? 'green' : 'red'} icon={status.online ? '●' : '■'}>{status.online ? 'Conectado' : status.configurado === false ? 'Não configurado' : 'Desconectado'}</Badge>
      )}
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Igreja"><input className={inputClass} value={`${tenant.nome} (${tenant.slug})`} disabled /></Field>
        <Field label="Provedor">
          <select className={inputClass} value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}>
            <option value="evolution">Evolution API (QR Code)</option>
            <option value="cloud" disabled>API Oficial (configurar na igreja)</option>
          </select>
        </Field>
        <Field label="Nome da instância"><input className={inputClass} value={f.instance} onChange={(e) => setF({ ...f, instance: e.target.value })} placeholder="IBBI-Oficial" /></Field>
        <Field label="Número da instância" hint="O número conectado que envia as mensagens"><input className={inputClass} value={f.numeroInstancia} onChange={(e) => setF({ ...f, numeroInstancia: e.target.value })} placeholder="5571999998888" /></Field>
        <Field label="Código (API key da instância)" hint={wa.evolution?.configurada ? 'Já configurado — preencha só para trocar' : 'Guardado criptografado'}>
          <input type="password" autoComplete="off" className={inputClass} value={f.apiKey} onChange={(e) => setF({ ...f, apiKey: e.target.value })} />
        </Field>
        <Field label="URL da Evolution"><input className={inputClass} value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://evolution.suaempresa.com" /></Field>
        <Field label="Número que recebe pedidos de oração"><input className={inputClass} value={f.numeroIgreja} onChange={(e) => setF({ ...f, numeroIgreja: e.target.value })} /></Field>
      </div>
      {status?.error && <p className="text-xs text-red-600 mt-2">{status.error}</p>}
      <p className="text-xs text-slate-500 mt-3">
        Apresentação do número à liderança: {wa.apresentacaoEnviadaEm ? `enviada em ${fmtDateTime(wa.apresentacaoEnviadaEm)}` : 'ainda não enviada'}.
        Pedimos que salvem o contato — isso melhora a entrega e reduz risco de bloqueio.
      </p>
      {msg && <p className={`text-sm mt-2 ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}
      <div className="flex flex-wrap gap-2 justify-end mt-3">
        <Button variant="ghost" onClick={testar} disabled={busy}>Testar conexão</Button>
        <Button variant="outline" onClick={apresentar} disabled={busy || !status?.online}>Enviar apresentação à liderança</Button>
        <Button onClick={salvar} disabled={busy || !f.instance || !f.url}>Salvar instância</Button>
      </div>
    </Card>
  );
}
