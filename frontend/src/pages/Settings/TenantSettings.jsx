import { useEffect, useState } from 'react';
import Header from '../../components/Header';
import api from '../../services/api';
import { useTenant } from '../../context/TenantContext';
import { CONGREGACOES } from '../../constants/congregacoes';
import { Badge, Button, Card, Field, Toggle, inputClass } from '../../components/ui';

const CLASSES = ['Crianças', 'Adolescentes', 'Jovens', 'Adultos 1', 'Adultos 2', 'Idosos', 'Anciãos'];
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const TABS = [
  { id: 'igreja', label: 'Igreja' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'automacoes', label: 'Automações' },
  { id: 'lideranca', label: 'Liderança' },
  { id: 'ebd', label: 'Líderes de EBD' },
  { id: 'ia', label: 'Assistente IA' },
];

const clone = (o) => JSON.parse(JSON.stringify(o || {}));

function Rows({ items, onChange, empty, render, novo }) {
  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-sm text-slate-400">{empty}</p>}
      {items.map((item, i) => (
        <div key={item._id || i} className="border border-slate-100 rounded-lg p-3 relative">
          <button
            type="button"
            className="absolute top-2 right-2 text-slate-400 hover:text-red-600 text-sm"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            aria-label="Remover"
          >
            ✕
          </button>
          {render(item, (patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it))))}
        </div>
      ))}
      <Button variant="outline" onClick={() => onChange([...items, novo()])}>+ Adicionar</Button>
    </div>
  );
}

// Nome do assistente: catálogo bíblico (cada um com sua apresentação) ou um nome próprio.
function AssistenteField({ value, onChange }) {
  const [catalogo, setCatalogo] = useState([]);
  useEffect(() => { api.get('/public/assistentes').then((r) => setCatalogo(r.data.assistentes || [])).catch(() => {}); }, []);
  const noCatalogo = catalogo.find((a) => a.nome === value);
  const [outro, setOutro] = useState(false);
  const custom = outro || (value && catalogo.length > 0 && !noCatalogo);
  return (
    <div className="sm:col-span-2 space-y-2">
      <Field label="Nome do assistente" hint="Cada nome se apresenta no WhatsApp com uma referência bíblica.">
        <select
          className={inputClass}
          value={custom ? '__outro' : value}
          onChange={(e) => {
            if (e.target.value === '__outro') { setOutro(true); onChange(''); } else { setOutro(false); onChange(e.target.value); }
          }}
        >
          {!value && !custom && <option value="">Selecione…</option>}
          {catalogo.map((a) => <option key={a.nome} value={a.nome}>{a.nome} ({a.significado})</option>)}
          <option value="__outro">Outro nome…</option>
        </select>
      </Field>
      {custom && <input className={inputClass} placeholder="Nome do assistente" value={value} onChange={(e) => onChange(e.target.value)} />}
      {noCatalogo && <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg p-3 leading-relaxed">{noCatalogo.exemplo.replace(/\*/g, '')}</p>}
      {custom && value && <p className="text-xs text-slate-400">Nomes fora da lista se apresentam com Lucas 15:4 (a ovelha perdida).</p>}
    </div>
  );
}

export default function TenantSettings() {
  const { tenant, refresh, hasFeature } = useTenant();
  // ?aba=whatsapp abre direto na aba (links do checklist de primeiros passos)
  const [tab, setTab] = useState(() => {
    const aba = new URLSearchParams(window.location.search).get('aba');
    return TABS.some((t) => t.id === aba) ? aba : 'igreja';
  });
  const [form, setForm] = useState(null);
  const [secrets, setSecrets] = useState({ evolutionApiKey: '', cloudToken: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [status, setStatus] = useState(null);
  const [hooks, setHooks] = useState(null);
  const [testNumber, setTestNumber] = useState('');
  const [grupos, setGrupos] = useState(null);
  const [grupoMsg, setGrupoMsg] = useState('');

  const carregarGrupos = async () => {
    setGrupoMsg('');
    try {
      const { data } = await api.get('/tenant/whatsapp/groups');
      setGrupos(data);
    } catch (err) {
      setGrupos([]);
      setGrupoMsg(err?.response?.data?.message || 'Não foi possível listar os grupos.');
    }
  };

  const criarGrupo = async () => {
    setGrupoMsg('');
    try {
      const { data } = await api.post('/tenant/whatsapp/groups', { nome: `Liderança ${form.nomeCurto || form.nome}` });
      setForm((f) => ({ ...f, whatsapp: { ...f.whatsapp, grupoLideranca: data, liderancaEnvio: f.whatsapp?.liderancaEnvio === 'individual' ? 'grupo' : f.whatsapp?.liderancaEnvio || 'grupo' } }));
      setGrupoMsg(`Grupo "${data.nome}" criado com a liderança cadastrada.`);
      refresh();
    } catch (err) {
      setGrupoMsg(err?.response?.data?.message || 'Falha ao criar o grupo.');
    }
  };

  useEffect(() => { if (tenant && !form) setForm(clone(tenant)); }, [tenant, form]);
  useEffect(() => {
    if (tab !== 'whatsapp') return;
    api.get('/tenant/whatsapp/status').then((r) => setStatus(r.data)).catch(() => setStatus({ online: false }));
    api.get('/tenant/webhook-info').then((r) => setHooks(r.data)).catch(() => {});
  }, [tab]);

  if (!form) return <p className="text-sm text-slate-500">Carregando...</p>;

  const set = (path, value) => setForm((f) => {
    const next = clone(f);
    const keys = path.split('.');
    let cur = next;
    keys.slice(0, -1).forEach((k) => { cur[k] = cur[k] ?? {}; cur = cur[k]; });
    cur[keys[keys.length - 1]] = value;
    return next;
  });

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const w = form.whatsapp || {};
    const payload = {
      nome: form.nome,
      nomeCurto: form.nomeCurto,
      email: form.email,
      telefone: form.telefone,
      responsavel: form.responsavel,
      cidade: form.cidade,
      uf: form.uf,
      pix: form.pix,
      cultosProgramados: form.cultosProgramados,
      timezone: form.timezone,
      programacaoSemanal: form.programacaoSemanal,
      congregacoes: form.congregacoes,
      branding: form.branding,
      automacoes: form.automacoes,
      ia: form.ia,
      lideranca: form.lideranca,
      ebdLideres: form.ebdLideres,
      whatsapp: {
        provider: w.provider,
        numeroIgreja: w.numeroIgreja,
        numeroInstancia: w.numeroInstancia,
        grupoLideranca: w.grupoLideranca || null,
        liderancaEnvio: w.liderancaEnvio || 'individual',
        antiban: w.antiban,
        evolution: { url: w.evolution?.url, instance: w.evolution?.instance, ...(secrets.evolutionApiKey ? { apiKey: secrets.evolutionApiKey } : {}) },
        cloud: { phoneNumberId: w.cloud?.phoneNumberId, wabaId: w.cloud?.wabaId, templates: w.cloud?.templates, ...(secrets.cloudToken ? { accessToken: secrets.cloudToken } : {}) },
      },
    };
    try {
      await api.put('/tenant/settings', payload);
      await refresh();
      setSecrets({ evolutionApiKey: '', cloudToken: '' });
      setForm(null);
      setMsg({ ok: true, text: 'Configurações salvas.' });
    } catch (err) {
      setMsg({ ok: false, text: err?.response?.data?.message || 'Falha ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  const testar = async () => {
    try {
      await api.post('/tenant/whatsapp/test', { numero: testNumber });
      setMsg({ ok: true, text: 'Mensagem de teste enviada.' });
    } catch (err) {
      setMsg({ ok: false, text: err?.response?.data?.message || 'Falha no teste' });
    }
  };

  const a = form.automacoes || {};
  const w = form.whatsapp || {};

  return (
    <div>
      <Header
        title="Configurações"
        subtitle={`${form.nome} · código de acesso: ${form.slug}`}
        action={<Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar alterações'}</Button>}
      />
      {msg && <p className={`text-sm mb-4 ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}

      <div className="flex gap-1 overflow-x-auto mb-4" role="tablist">
        {TABS.filter((t) => t.id !== 'ia' || hasFeature('agenteWhatsApp')).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${tab === t.id ? 'bg-ibbiNavy text-white' : 'bg-white text-slate-600 border border-stone-100 hover:bg-slate-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'igreja' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Dados da igreja">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Nome"><input className={inputClass} value={form.nome || ''} onChange={(e) => set('nome', e.target.value)} /></Field>
              <Field label="Nome curto / sigla"><input className={inputClass} value={form.nomeCurto || ''} onChange={(e) => set('nomeCurto', e.target.value)} /></Field>
              <Field label="Email"><input className={inputClass} value={form.email || ''} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label="Telefone"><input className={inputClass} value={form.telefone || ''} onChange={(e) => set('telefone', e.target.value)} /></Field>
              <Field label="Responsável"><input className={inputClass} value={form.responsavel || ''} onChange={(e) => set('responsavel', e.target.value)} /></Field>
              <Field label="Fuso horário"><input className={inputClass} value={form.timezone || ''} onChange={(e) => set('timezone', e.target.value)} placeholder="America/Bahia" /></Field>
              <Field label="Cidade"><input className={inputClass} value={form.cidade || ''} onChange={(e) => set('cidade', e.target.value)} /></Field>
              <Field label="UF"><input className={inputClass} maxLength={2} value={form.uf || ''} onChange={(e) => set('uf', e.target.value.toUpperCase())} /></Field>
            </div>
          </Card>
          <Card title="💰 Pix da igreja" subtitle="Para eventos pagos: cada inscrito recebe o Pix copia e cola com o valor e um QR Code">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><Field label="Chave Pix" hint="CNPJ, email, celular (+55…) ou chave aleatória"><input className={inputClass} value={form.pix?.chave || ''} onChange={(e) => set('pix.chave', e.target.value)} /></Field></div>
              <Field label="Nome do recebedor" hint="Como aparece no banco (até 25 letras)"><input className={inputClass} maxLength={25} value={form.pix?.nome || ''} onChange={(e) => set('pix.nome', e.target.value)} /></Field>
              <Field label="Cidade" hint="Até 15 letras"><input className={inputClass} maxLength={15} value={form.pix?.cidade || ''} onChange={(e) => set('pix.cidade', e.target.value)} /></Field>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">O dinheiro cai direto na conta da igreja. A confirmação do pagamento é feita pela liderança em Eventos.</p>
          </Card>
          <Card title="Identidade visual" subtitle="Aparece no login, menu e mensagens">
            <div className="space-y-3">
              <Field label="URL do logo"><input className={inputClass} value={form.branding?.logoUrl || ''} onChange={(e) => set('branding.logoUrl', e.target.value)} placeholder="https://..." /></Field>
              <Field label="Assinatura das mensagens" hint="Padrão: nome da igreja"><input className={inputClass} value={form.branding?.assinatura || ''} onChange={(e) => set('branding.assinatura', e.target.value)} /></Field>
              <Field label="URL do portal" hint="Usada nos links de acesso enviados aos membros"><input className={inputClass} value={form.branding?.portalUrl || ''} onChange={(e) => set('branding.portalUrl', e.target.value)} /></Field>
            </div>
          </Card>
          <Card title="Congregações" subtitle="Todas fazem parte da mesma assinatura">
            <textarea
              className={`${inputClass} min-h-[160px]`}
              value={(form.congregacoes || []).join('\n')}
              onChange={(e) => set('congregacoes', e.target.value.split('\n'))}
              aria-label="Uma congregação por linha"
            />
            <p className="text-[11px] text-slate-400 mt-1">Uma por linha. Renomear não altera cadastros existentes.</p>
          </Card>
          <Card title="Programação semanal" subtitle="Enviada nas boas-vindas de visitantes e novos decididos">
            <textarea
              className={`${inputClass} min-h-[160px]`}
              value={form.programacaoSemanal || ''}
              onChange={(e) => set('programacaoSemanal', e.target.value)}
              placeholder={'🟡 *Domingo — 09h | EBD*\n🟡 *Domingo — 19h | Culto*'}
            />
          </Card>
        </div>
      )}

      {tab === 'whatsapp' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card
            title="Conexão"
            action={status && (
              <Badge color={status.online ? 'green' : 'red'} icon={status.online ? '●' : '■'}>
                {status.online ? 'Conectado' : status.configurado === false ? 'Não configurado' : 'Desconectado'}
              </Badge>
            )}
          >
            <div className="space-y-3">
              <Field label="Provedor">
                <select className={inputClass} value={w.provider || 'none'} onChange={(e) => set('whatsapp.provider', e.target.value)}>
                  <option value="none">{w.useEnvFallback ? 'Padrão do servidor (.env)' : 'Não configurado'}</option>
                  <option value="evolution">Evolution API (QR Code, não oficial)</option>
                  <option value="cloud" disabled={!hasFeature('whatsappOficial')}>WhatsApp Oficial — Cloud API da Meta{!hasFeature('whatsappOficial') ? ' (plano Multiplicar)' : ''}</option>
                </select>
              </Field>
              {w.provider === 'evolution' && (
                <>
                  <Field label="URL da Evolution"><input className={inputClass} value={w.evolution?.url || ''} onChange={(e) => set('whatsapp.evolution.url', e.target.value)} placeholder="https://evo.suaigreja.com.br" /></Field>
                  <Field label="Instância"><input className={inputClass} value={w.evolution?.instance || ''} onChange={(e) => set('whatsapp.evolution.instance', e.target.value)} /></Field>
                  <Field label="API Key" hint={w.evolution?.configurada ? 'Já configurada — preencha só para trocar' : 'Guardada criptografada'}>
                    <input type="password" className={inputClass} value={secrets.evolutionApiKey} onChange={(e) => setSecrets({ ...secrets, evolutionApiKey: e.target.value })} autoComplete="off" />
                  </Field>
                </>
              )}
              {w.provider === 'cloud' && (
                <>
                  <Field label="Phone Number ID"><input className={inputClass} value={w.cloud?.phoneNumberId || ''} onChange={(e) => set('whatsapp.cloud.phoneNumberId', e.target.value)} /></Field>
                  <Field label="WhatsApp Business Account ID"><input className={inputClass} value={w.cloud?.wabaId || ''} onChange={(e) => set('whatsapp.cloud.wabaId', e.target.value)} /></Field>
                  <Field label="Access Token (permanente)" hint={w.cloud?.configurada ? 'Já configurado — preencha só para trocar' : 'Guardado criptografado'}>
                    <input type="password" className={inputClass} value={secrets.cloudToken} onChange={(e) => setSecrets({ ...secrets, cloudToken: e.target.value })} autoComplete="off" />
                  </Field>
                  <p className="text-xs text-slate-500">Templates aprovados pela Meta (usados fora da janela de 24h):</p>
                  <div className="grid grid-cols-2 gap-2">
                    {['aniversario', 'ausencia', 'aviso'].map((k) => (
                      <Field key={k} label={`Template ${k}`}>
                        <input className={inputClass} value={w.cloud?.templates?.[k] || ''} onChange={(e) => set(`whatsapp.cloud.templates.${k}`, e.target.value)} placeholder="nome_do_template" />
                      </Field>
                    ))}
                  </div>
                </>
              )}
              <Field label="Número da instância (que envia)" hint="Usado no cartão de contato enviado à liderança">
                <input className={inputClass} value={w.numeroInstancia || ''} onChange={(e) => set('whatsapp.numeroInstancia', e.target.value)} placeholder="5571999998888" />
              </Field>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <p className="text-emerald-900 font-medium">📇 Apresentar o número à liderança</p>
                <p className="text-xs text-emerald-800 mt-0.5">Envia uma mensagem pedindo para salvarem o contato da igreja (com o cartão de contato). É feito automaticamente quando o WhatsApp é configurado. {w.apresentacaoEnviadaEm ? `Última: ${new Date(w.apresentacaoEnviadaEm).toLocaleString('pt-BR')}.` : ''}</p>
                <Button variant="outline" className="mt-2 text-xs" onClick={async () => {
                  try {
                    const { data } = await api.post('/tenant/whatsapp/apresentar', { forcar: true });
                    setMsg({ ok: true, text: `Apresentação em fila para ${data.enviados} líder(es).` });
                  } catch (err) {
                    setMsg({ ok: false, text: err?.response?.data?.message || 'Falha ao enviar' });
                  }
                }}>Enviar apresentação agora</Button>
              </div>
              <Field label="Número que recebe pedidos de oração"><input className={inputClass} value={w.numeroIgreja || ''} onChange={(e) => set('whatsapp.numeroIgreja', e.target.value)} placeholder="5571999998888" /></Field>
            </div>
          </Card>
          <Card title="🛡️ Proteção anti-bloqueio" subtitle="Ritmo dos envios iniciados pela igreja (lotes e automações). Respostas a quem escreveu não esperam." className="lg:col-span-2">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Intervalo mínimo (s)" hint="Nunca menos de 30s"><input type="number" min="30" className={inputClass} value={w.antiban?.intervaloMinSeg ?? 45} onChange={(e) => set('whatsapp.antiban.intervaloMinSeg', Number(e.target.value))} /></Field>
              <Field label="Intervalo máximo (s)" hint="Sorteado entre mín. e máx."><input type="number" min="30" className={inputClass} value={w.antiban?.intervaloMaxSeg ?? 90} onChange={(e) => set('whatsapp.antiban.intervaloMaxSeg', Number(e.target.value))} /></Field>
              <Field label="Envios a partir de"><input type="time" className={inputClass} value={w.antiban?.horarioInicio || '08:00'} onChange={(e) => set('whatsapp.antiban.horarioInicio', e.target.value)} /></Field>
              <Field label="Envios até"><input type="time" className={inputClass} value={w.antiban?.horarioFim || '21:00'} onChange={(e) => set('whatsapp.antiban.horarioFim', e.target.value)} /></Field>
              <Field label="Limite por hora"><input type="number" min="1" className={inputClass} value={w.antiban?.limitePorHora ?? 60} onChange={(e) => set('whatsapp.antiban.limitePorHora', Number(e.target.value))} /></Field>
              <Field label="Limite por dia"><input type="number" min="1" className={inputClass} value={w.antiban?.limiteDiario ?? 400} onChange={(e) => set('whatsapp.antiban.limiteDiario', Number(e.target.value))} /></Field>
              <Field label="Pausa longa a cada (mensagens)"><input type="number" min="0" className={inputClass} value={w.antiban?.pausaACada ?? 20} onChange={(e) => set('whatsapp.antiban.pausaACada', Number(e.target.value))} /></Field>
              <Field label="Duração da pausa (min)"><input type="number" min="0" className={inputClass} value={w.antiban?.pausaMin ?? 5} onChange={(e) => set('whatsapp.antiban.pausaMin', Number(e.target.value))} /></Field>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-6">
              <Toggle checked={w.antiban?.digitando !== false} onChange={(v) => set('whatsapp.antiban.digitando', v)} label='Mostrar "digitando…" antes de cada mensagem' hint="Simula digitação humana (Evolution)" />
            </div>
            <ul className="mt-3 text-xs text-slate-500 list-disc pl-5 space-y-0.5">
              <li>Mensagem idêntica para o mesmo número não é reenviada em 24h.</li>
              <li>Fora do horário, os envios automáticos esperam a próxima janela.</li>
              <li>Dicas: use um número dedicado e "aquecido" (conversas reais antes de lotes grandes), peça para os membros salvarem o contato da igreja e evite links encurtados. Para volume alto, prefira a API Oficial.</li>
            </ul>
            {status?.antiban && <p className="text-xs text-slate-600 mt-2">Agora: {status.antiban.ultimaHora} envio(s) na última hora · {status.antiban.ultimas24h} em 24h · {status.antiban.dentroDoHorario ? 'dentro do horário' : 'fora do horário de envio'}</p>}
          </Card>
          <Card title="Teste e webhooks" subtitle="Para o assistente receber as mensagens da liderança">
            <div className="flex gap-2 mb-4">
              <input className={inputClass} value={testNumber} onChange={(e) => setTestNumber(e.target.value)} placeholder="Seu WhatsApp com DDD" />
              <Button variant="outline" onClick={testar} disabled={!testNumber}>Enviar teste</Button>
            </div>
            {hooks && (
              <div className="space-y-3 text-xs">
                <div>
                  <p className="font-medium text-slate-700">Evolution API → Webhook (evento MESSAGES_UPSERT, "Webhook Base64" ligado)</p>
                  <code className="block bg-slate-50 rounded p-2 mt-1 break-all">{hooks.evolution || 'salve as configurações para gerar'}</code>
                  {hooks.evolution && (
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline mt-1"
                      onClick={async () => {
                        if (!confirm('Gerar um novo token? A URL atual para de funcionar e precisa ser atualizada na Evolution API.')) return;
                        try {
                          const { data } = await api.post('/tenant/webhook-info/rotate');
                          setHooks(data);
                        } catch (err) {
                          alert(err?.response?.data?.message || 'Erro ao gerar novo token.');
                        }
                      }}
                    >
                      Gerar novo token
                    </button>
                  )}
                </div>
                <div>
                  <p className="font-medium text-slate-700">WhatsApp Cloud API → Callback URL (campo "messages")</p>
                  <code className="block bg-slate-50 rounded p-2 mt-1 break-all">{hooks.cloud}</code>
                  {!hooks.cloudVerifyTokenConfigurado && <p className="text-amber-700 mt-1">Servidor sem WHATSAPP_VERIFY_TOKEN configurado.</p>}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'automacoes' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="🎂 Aniversários" subtitle="Felicitação automática + aviso à liderança">
            <Toggle checked={a.aniversario?.ativo !== false} onChange={(v) => set('automacoes.aniversario.ativo', v)} label="Enviar felicitações (WhatsApp + cartão)" />
            <Toggle checked={a.aniversario?.enviarEmail !== false} onChange={(v) => set('automacoes.aniversario.enviarEmail', v)} label="Enviar também por email" />
            <Toggle checked={a.aniversario?.notificarLideranca !== false} onChange={(v) => set('automacoes.aniversario.notificarLideranca', v)} label="Avisar a liderança" hint='"Os irmãos A e B fazem aniversário hoje; as felicitações já foram enviadas."' />
            <Field label="A partir de"><input type="time" className={inputClass} value={a.aniversario?.hora || '08:00'} onChange={(e) => set('automacoes.aniversario.hora', e.target.value)} /></Field>
          </Card>
          <Card title="📋 Chamada da EBD pelo WhatsApp" subtitle="Domingo, o assistente pede a frequência a cada líder de EBD">
            <Toggle checked={Boolean(a.chamadaEbd?.ativo)} onChange={(v) => set('automacoes.chamadaEbd.ativo', v)} label="Convocar líderes para a chamada" hint="Eles respondem com números, nomes ou áudio" />
            <Field label="Horário (domingo)"><input type="time" className={inputClass} value={a.chamadaEbd?.hora || '11:30'} onChange={(e) => set('automacoes.chamadaEbd.hora', e.target.value)} /></Field>
            {!hasFeature('agenteWhatsApp') && <p className="text-xs text-amber-700 mt-2">Disponível a partir do plano Crescer.</p>}
          </Card>
          <Card title="🌱 Jornada do visitante" subtitle="30 dias de acolhimento: dia 3, 7, 14 e 21, e resumo à liderança no dia 30">
            <Toggle checked={a.jornada?.ativo !== false} onChange={(v) => set('automacoes.jornada.ativo', v)} label="Acompanhar visitantes e novos convertidos" hint="Começa sozinha em todo cadastro de visitante ou novo decidido" />
            <Toggle checked={a.jornada?.avisarLideranca !== false} onChange={(v) => set('automacoes.jornada.avisarLideranca', v)} label="No dia 30, avisar a liderança de quem ainda não voltou" />
            <Field label="Horário das mensagens"><input type="time" className={inputClass} value={a.jornada?.hora || '10:00'} onChange={(e) => set('automacoes.jornada.hora', e.target.value)} /></Field>
            {!hasFeature('jornadaVisitante') && <p className="text-xs text-amber-700 mt-2">Disponível a partir do plano Crescer.</p>}
          </Card>
          <Card title="⛪ Agenda de cultos e lembretes" subtitle='Quem envia "LEMBRETE" no WhatsApp recebe um aviso antes de cada culto (com o link da transmissão)'>
            <div className="space-y-3">
              {(form.cultosProgramados || []).map((c, i) => {
                const upd = (k, v) => set('cultosProgramados', (form.cultosProgramados || []).map((x, j) => (j === i ? { ...x, [k]: v } : x)));
                return (
                  <div key={c._id || i} className="rounded-lg border border-slate-100 p-3 grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
                    <div className="col-span-2"><Field label="Culto"><input className={inputClass} value={c.titulo || ''} onChange={(e) => upd('titulo', e.target.value)} /></Field></div>
                    <Field label="Dia"><select className={inputClass} value={c.diaSemana} onChange={(e) => upd('diaSemana', Number(e.target.value))}>{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, k) => <option key={d} value={k}>{d}</option>)}</select></Field>
                    <Field label="Horário"><input type="time" className={inputClass} value={c.horario || ''} onChange={(e) => upd('horario', e.target.value)} /></Field>
                    <Field label="Avisar antes"><select className={inputClass} value={c.lembreteMin || 180} onChange={(e) => upd('lembreteMin', Number(e.target.value))}>{[60, 120, 180, 240, 360, 720].map((m) => <option key={m} value={m}>{m / 60}h</option>)}</select></Field>
                    <Field label="Congregação"><select className={inputClass} value={c.congregacao || ''} onChange={(e) => upd('congregacao', e.target.value)}><option value="">Todas</option>{CONGREGACOES.map((x) => <option key={x}>{x}</option>)}</select></Field>
                    <div className="col-span-2 sm:col-span-5"><Field label="Link da transmissão (opcional)"><input className={inputClass} value={c.liveUrl || ''} onChange={(e) => upd('liveUrl', e.target.value)} placeholder="https://youtube.com/..." /></Field></div>
                    <button type="button" className="text-xs text-red-600 justify-self-end" onClick={() => set('cultosProgramados', (form.cultosProgramados || []).filter((_, j) => j !== i))}>remover</button>
                  </div>
                );
              })}
              <Button variant="outline" onClick={() => set('cultosProgramados', [...(form.cultosProgramados || []), { titulo: 'Culto', diaSemana: 0, horario: '19:00', lembreteMin: 180, ativo: true }])}>+ Adicionar culto</Button>
              <p className="text-[11px] text-slate-400">O envio é gradual (~50 por hora); com muitos inscritos, use 3h ou mais de antecedência.</p>
            </div>
          </Card>
          <Card title="🗓️ Escalas de voluntários" subtitle="Lembrete na véspera para quem confirmou; o responsável vê quem não respondeu">
            <Field label="Horário do lembrete (véspera)"><input type="time" className={inputClass} value={a.escalas?.lembreteHora || '18:00'} onChange={(e) => set('automacoes.escalas.lembreteHora', e.target.value)} /></Field>
          </Card>
          <Card title="💛 Reengajamento de ausentes" subtitle="Mensagem personalizada pela IA depois de cada chamada">
            <Toggle checked={Boolean(a.ausencia?.ativo)} onChange={(v) => set('automacoes.ausencia.ativo', v)} label="Ativar motor de reengajamento" />
            <Toggle checked={Boolean(a.ausencia?.autoEnviar)} onChange={(v) => set('automacoes.ausencia.autoEnviar', v)} label="Enviar sem aprovação" hint="Desligado: o líder da classe recebe as mensagens prontas e responde 'enviar'" />
            <Toggle checked={a.ausencia?.mensagemPrimeiraFalta !== false} onChange={(v) => set('automacoes.ausencia.mensagemPrimeiraFalta', v)} label="Mandar já na primeira falta" hint="Com o tema da aula e a foto da turma, se houver" />
            <Toggle checked={a.ausencia?.enviarEmail !== false} onChange={(v) => set('automacoes.ausencia.enviarEmail', v)} label="Email para quem atingir o limite" />
            <Toggle checked={a.ausencia?.incluirEncontros !== false} onChange={(v) => set('automacoes.ausencia.incluirEncontros', v)} label="Aplicar também aos Encontros (uniões, louvor…)" hint="Faltas seguidas nos encontros de cada grupo geram as mesmas mensagens e alertas" />
            <Field label="Alertar a liderança após (domingos seguidos)">
              <input type="number" min="2" max="12" className={inputClass} value={a.ausencia?.semanasAlerta || 4} onChange={(e) => set('automacoes.ausencia.semanasAlerta', Number(e.target.value))} />
            </Field>
            {!hasFeature('reengajamento') && <p className="text-xs text-amber-700 mt-2">Disponível a partir do plano Crescer.</p>}
          </Card>
          <Card title="📊 Relatório semanal" subtitle="Resumo gerado pela IA no WhatsApp da liderança">
            <Toggle checked={Boolean(a.relatorioSemanal?.ativo)} onChange={(v) => set('automacoes.relatorioSemanal.ativo', v)} label="Enviar relatório semanal" />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Dia">
                <select className={inputClass} value={a.relatorioSemanal?.diaSemana ?? 1} onChange={(e) => set('automacoes.relatorioSemanal.diaSemana', Number(e.target.value))}>
                  {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </Field>
              <Field label="Hora"><input type="time" className={inputClass} value={a.relatorioSemanal?.hora || '08:00'} onChange={(e) => set('automacoes.relatorioSemanal.hora', e.target.value)} /></Field>
            </div>
          </Card>
        </div>
      )}

      {tab === 'lideranca' && (
        <div className="space-y-4">
        <Card title="Grupo de WhatsApp da liderança" subtitle="Os avisos (aniversários, alertas de ausência, relatório semanal) podem ir para um grupo — só com Evolution API">
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-600">Como a liderança recebe os avisos</p>
              {[
                ['individual', 'Individual', 'Cada contato recebe no privado'],
                ['grupo', 'No grupo', 'Uma mensagem no grupo (líderes de classe/união continuam no privado)'],
                ['ambos', 'Grupo e individual', 'No grupo e também no privado'],
              ].map(([v, label, desc]) => (
                <label key={v} className={`flex gap-3 p-2.5 rounded-lg border cursor-pointer ${(w.liderancaEnvio || 'individual') === v ? 'border-ibbiBlue bg-blue-50/50' : 'border-slate-200'}`}>
                  <input type="radio" name="liderancaEnvio" checked={(w.liderancaEnvio || 'individual') === v} onChange={() => set('whatsapp.liderancaEnvio', v)} className="mt-1" />
                  <span><span className="block text-sm font-medium text-slate-800">{label}</span><span className="block text-xs text-slate-500">{desc}</span></span>
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-600">Grupo</p>
              {w.grupoLideranca?.jid ? (
                <div className="flex items-center justify-between gap-2 border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-emerald-900 truncate">👥 {w.grupoLideranca.nome}</p>
                    <p className="text-[11px] text-emerald-700 truncate">{w.grupoLideranca.jid}</p>
                  </div>
                  <button type="button" className="text-xs text-red-600" onClick={() => set('whatsapp.grupoLideranca', null)}>remover</button>
                </div>
              ) : <p className="text-sm text-slate-400">Nenhum grupo selecionado.</p>}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={carregarGrupos}>Escolher grupo existente</Button>
                <Button variant="outline" onClick={criarGrupo}>Criar grupo com a liderança</Button>
              </div>
              {grupos && (
                <select
                  className={inputClass}
                  value=""
                  onChange={(e) => {
                    const g = grupos.find((x) => x.jid === e.target.value);
                    if (g) set('whatsapp.grupoLideranca', { jid: g.jid, nome: g.nome });
                  }}
                >
                  <option value="">{grupos.length ? `Selecione (${grupos.length} grupos)` : 'Nenhum grupo encontrado'}</option>
                  {grupos.map((g) => <option key={g.jid} value={g.jid}>{g.nome}{g.participantes ? ` — ${g.participantes} participantes` : ''}</option>)}
                </select>
              )}
              {grupoMsg && <p className="text-xs text-slate-600">{grupoMsg}</p>}
              <p className="text-[11px] text-slate-400">O número conectado precisa ser administrador/participante do grupo. Salve as alterações depois de escolher.</p>
            </div>
          </div>
        </Card>
        <Card title="Liderança" subtitle="Quem recebe avisos de aniversário, alertas de ausência e o relatório semanal. Pode ser o JID de um grupo (…@g.us) na Evolution. Contatos aqui também são reconhecidos como líderes pelo assistente.">
          <Rows
            items={form.lideranca || []}
            onChange={(v) => set('lideranca', v)}
            empty="Sem contatos — os avisos vão para os usuários master com celular."
            novo={() => ({ nome: '', celular: '', email: '', papel: '', congregacao: '', recebeAniversarios: true, recebeAlertasAusencia: true, recebeRelatorioSemanal: true })}
            render={(item, patch) => (
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 pr-6">
                <input className={inputClass} placeholder="Nome" value={item.nome || ''} onChange={(e) => patch({ nome: e.target.value })} />
                <input className={inputClass} placeholder="WhatsApp" value={item.celular || ''} onChange={(e) => patch({ celular: e.target.value })} />
                <input className={inputClass} placeholder="Email" value={item.email || ''} onChange={(e) => patch({ email: e.target.value })} />
                <input className={inputClass} placeholder="Papel (Pastor…)" value={item.papel || ''} onChange={(e) => patch({ papel: e.target.value })} />
                <select className={inputClass} value={item.congregacao || ''} onChange={(e) => patch({ congregacao: e.target.value })}>
                  <option value="">Todas as congregações</option>
                  {CONGREGACOES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="sm:col-span-2 lg:col-span-5 flex flex-wrap gap-x-6">
                  <Toggle checked={item.recebeAniversarios !== false} onChange={(v) => patch({ recebeAniversarios: v })} label="Aniversários" />
                  <Toggle checked={item.recebeAlertasAusencia !== false} onChange={(v) => patch({ recebeAlertasAusencia: v })} label="Alertas de ausência" />
                  <Toggle checked={item.recebeRelatorioSemanal !== false} onChange={(v) => patch({ recebeRelatorioSemanal: v })} label="Relatório semanal" />
                </div>
              </div>
            )}
          />
        </Card>
        </div>
      )}

      {tab === 'ebd' && (
        <Card title="Líderes de EBD" subtitle="Recebem a chamada no domingo, aprovam mensagens aos ausentes e comemoram os retornos">
          <Rows
            items={form.ebdLideres || []}
            onChange={(v) => set('ebdLideres', v)}
            empty="Nenhum líder cadastrado."
            novo={() => ({ classe: 'Jovens', congregacao: CONGREGACOES[0], nome: '', celular: '' })}
            render={(item, patch) => (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 pr-6">
                <select className={inputClass} value={item.classe} onChange={(e) => patch({ classe: e.target.value })}>
                  {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className={inputClass} value={item.congregacao} onChange={(e) => patch({ congregacao: e.target.value })}>
                  {CONGREGACOES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input className={inputClass} placeholder="Nome do líder" value={item.nome || ''} onChange={(e) => patch({ nome: e.target.value })} />
                <input className={inputClass} placeholder="WhatsApp com DDD" value={item.celular || ''} onChange={(e) => patch({ celular: e.target.value })} />
              </div>
            )}
          />
        </Card>
      )}

      {tab === 'ia' && hasFeature('agenteWhatsApp') && (
        <Card title="Assistente de IA" subtitle="Atende a liderança e os membros no WhatsApp da igreja">
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Toggle checked={form.ia?.ativo !== false} onChange={(v) => set('ia.ativo', v)} label="Assistente ativo no WhatsApp" />
              <Toggle checked={form.ia?.cadastroPublico !== false} onChange={(v) => set('ia.cadastroPublico', v)} label="Visitantes podem se cadastrar conversando" hint="Números desconhecidos são recebidos e cadastrados como visitantes" />
              <AssistenteField value={form.ia?.nomeAssistente || ''} onChange={(v) => set('ia.nomeAssistente', v)} />
              <Field label="Tom de voz"><input className={inputClass} value={form.ia?.tom || ''} onChange={(e) => set('ia.tom', e.target.value)} /></Field>
            </div>
            <Field label="Orientações específicas da igreja" hint="Ex.: tratar por 'irmão/irmã', não usar emojis, horário da secretaria...">
              <textarea className={`${inputClass} min-h-[180px]`} maxLength={2000} value={form.ia?.instrucoesExtras || ''} onChange={(e) => set('ia.instrucoesExtras', e.target.value)} />
            </Field>
          </div>
          {!hasFeature('agenteWhatsApp') && <p className="text-xs text-amber-700 mt-3">O assistente no WhatsApp está disponível a partir do plano Crescer.</p>}
        </Card>
      )}
    </div>
  );
}
