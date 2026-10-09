import { useEffect, useRef, useState } from 'react';
import Header from '../../components/Header';
import api from '../../services/api';
import { useTenant } from '../../context/TenantContext';
import { CONGREGACOES } from '../../constants/congregacoes';
import { Badge, Button, Card, Field, Tabs, Toggle, inputClass } from '../../components/ui';
import ProgramacaoSemanalField from './ProgramacaoSemanalField';
import AgendaCultos from './AgendaCultos';
import EscalasResumo from './EscalasResumo';
import RelatorioPrevia from './RelatorioPrevia';
import GrupoSelect from './GrupoSelect';

const CLASSES = ['Crianças', 'Adolescentes', 'Jovens', 'Adultos 1', 'Adultos 2', 'Idosos', 'Anciãos'];
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const TABS = [
  { id: 'igreja', label: 'Igreja', icon: '⛪' },
  { id: 'aparencia', label: 'Aparência', icon: '🎨' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { id: 'antiban', label: 'Anti-bloqueio', icon: '🛡️' },
  { id: 'automacoes', label: 'Automações', icon: '⚙️' },
  { id: 'lideranca', label: 'Liderança', icon: '👥' },
  { id: 'ebd', label: 'Líderes de EBD', icon: '📖' },
  { id: 'ia', label: 'Assistente IA', icon: '✨' },
];

// Fundos claros sugeridos; o menu lateral continua azul-marinho em todos.
const FUNDOS = [
  { cor: '', nome: 'Creme (padrão)', amostra: '#f7f3ea' },
  { cor: '#f8fafc', nome: 'Branco gelo' },
  { cor: '#f1f5f9', nome: 'Cinza claro' },
  { cor: '#eef3fb', nome: 'Azul névoa' },
  { cor: '#eef6f1', nome: 'Verde sálvia' },
  { cor: '#fbf1ec', nome: 'Pêssego' },
  { cor: '#f4f1fa', nome: 'Lavanda' },
  { cor: '#fbf7e6', nome: 'Trigo' },
];
// Mesma regra do servidor: cor clara o bastante para o texto escuro.
const corClara = (hex) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return false;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b >= 0.75;
};

function CorFundoField({ value, onChange }) {
  const [custom, setCustom] = useState(value || '#f7f3ea');
  const escura = custom && !corClara(custom);
  return (
    <div>
      <span className="text-sm font-medium text-slate-600">Cor de fundo das telas</span>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {FUNDOS.map((f) => {
          const ativo = (value || '') === f.cor;
          return (
            <button
              key={f.nome}
              type="button"
              onClick={() => onChange(f.cor)}
              aria-pressed={ativo}
              className={`group rounded-xl border p-2 text-left transition ${ativo ? 'border-ibbiBlue ring-2 ring-ibbiBlue/30' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <span className="flex h-10 rounded-lg overflow-hidden border border-black/5">
                <span className="w-3 bg-ibbiNavy" />
                <span className="flex-1" style={{ background: f.amostra || f.cor }} />
              </span>
              <span className="block text-xs text-slate-600 mt-1.5 truncate">{f.nome}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="color"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer bg-white p-0.5"
          aria-label="Escolher outra cor"
        />
        <Button variant="outline" disabled={escura} onClick={() => onChange(custom)}>Usar esta cor</Button>
        <span className="text-[11px] text-slate-400">{escura ? 'Muito escura: escolha um tom mais claro.' : 'Só tons claros, para o texto continuar legível.'}</span>
      </div>
    </div>
  );
}

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

// Logo: a imagem é reduzida no navegador (lado maior 256px) e salva junto da igreja.
const LOGO_MAX_LADO = 256;
const LOGO_MAX_BYTES = 300 * 1024;
const reduzLogo = (file) => new Promise((resolve, reject) => {
  const img = new Image();
  const src = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(src);
    const escala = Math.min(1, LOGO_MAX_LADO / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * escala));
    canvas.height = Math.max(1, Math.round(img.height * escala));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    // PNG mantém transparência; se passar do limite, WebP comprime mais.
    let url = canvas.toDataURL('image/png');
    if (url.length * 0.75 > LOGO_MAX_BYTES) url = canvas.toDataURL('image/webp', 0.9);
    if (url.length * 0.75 > LOGO_MAX_BYTES) reject(new Error('Imagem muito grande mesmo reduzida. Tente outra.'));
    else resolve(url);
  };
  img.onerror = () => { URL.revokeObjectURL(src); reject(new Error('Não foi possível ler a imagem.')); };
  img.src = src;
});

function LogoField({ value, onChange }) {
  const [erro, setErro] = useState('');
  const escolher = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErro('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setErro('Envie PNG, JPEG ou WebP.'); return; }
    try { onChange(await reduzLogo(file)); } catch (err) { setErro(err.message); }
  };
  return (
    // Não usa <Field>: ele é um <label> e o botão de arquivo já é outro.
    <div>
      <span className="text-sm font-medium text-slate-600">Logo</span>
      <div className="mt-1 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
          {value ? <img src={value} alt="Logo da igreja" className="w-full h-full object-cover" /> : <span className="text-[11px] text-slate-400">sem logo</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer inline-flex items-center px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
            {value ? 'Trocar imagem' : 'Enviar imagem'}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={escolher} />
          </label>
          {value && <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => onChange('')}>Remover</button>}
        </div>
      </div>
      <span className="block text-[11px] text-slate-400 mt-1">PNG, JPEG ou WebP. Quadrado com fundo transparente fica melhor. Clique em Salvar para aplicar.</span>
      {erro && <p className="text-xs text-red-600 mt-1">{erro}</p>}
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

// O que "Salvar alterações" envia (também usado para saber se há algo pendente).
const buildPayload = (f, secrets) => {
  const w = f.whatsapp || {};
  return {
    nome: f.nome,
    nomeCurto: f.nomeCurto,
    email: f.email,
    telefone: f.telefone,
    responsavel: f.responsavel,
    cidade: f.cidade,
    uf: f.uf,
    pix: f.pix,
    cultosProgramados: f.cultosProgramados,
    timezone: f.timezone,
    programacaoSemanal: f.programacaoSemanal,
    congregacoes: f.congregacoes,
    branding: f.branding,
    automacoes: f.automacoes,
    ia: f.ia,
    lideranca: f.lideranca,
    ebdLideres: f.ebdLideres,
    whatsapp: {
      provider: w.provider,
      numeroIgreja: w.numeroIgreja,
      numeroInstancia: w.numeroInstancia,
      grupoLideranca: w.grupoLideranca || null,
      liderancaEnvio: w.liderancaEnvio || 'individual',
      antiban: w.antiban,
      evolution: { url: w.evolution?.url, instance: w.evolution?.instance, ...(secrets?.evolutionApiKey ? { apiKey: secrets.evolutionApiKey } : {}) },
      cloud: { phoneNumberId: w.cloud?.phoneNumberId, wabaId: w.cloud?.wabaId, templates: w.cloud?.templates, ...(secrets?.cloudToken ? { accessToken: secrets.cloudToken } : {}) },
    },
  };
};

export default function TenantSettings() {
  const { tenant, refresh, hasFeature, previewCorFundo } = useTenant();
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

  // Interruptor do WhatsApp: vale na hora, sem "Salvar alterações".
  const alternarWhatsapp = async (ativo) => {
    if (!ativo && !window.confirm('Desligar o WhatsApp da igreja?\n\nNada será enviado nem respondido (automações, avisos, menu do líder) e a fila pendente será cancelada. A instância continua conectada na Evolution.')) return;
    setMsg(null);
    try {
      const { data } = await api.put('/tenant/whatsapp/ativo', { ativo });
      setForm((f) => ({ ...f, whatsapp: { ...f.whatsapp, ativo, desativadoEm: ativo ? null : new Date().toISOString() } }));
      refresh();
      api.get('/tenant/whatsapp/status').then((r) => setStatus(r.data)).catch(() => setStatus({ online: false }));
      setMsg({ ok: true, text: ativo ? 'WhatsApp ligado.' : `WhatsApp desligado.${data.filaCancelada ? ` ${data.filaCancelada} mensagem(ns) na fila cancelada(s).` : ''}` });
    } catch (err) {
      setMsg({ ok: false, text: err?.response?.data?.message || 'Não foi possível alterar o WhatsApp.' });
    }
  };

  useEffect(() => { if (tenant && !form) setForm(clone(tenant)); }, [tenant, form]);
  // Prévia ao vivo da cor de fundo; ao sair sem salvar, volta a cor gravada.
  const corFundo = form?.branding?.corFundo;
  useEffect(() => { if (form) previewCorFundo(corFundo); }, [corFundo]); // eslint-disable-line react-hooks/exhaustive-deps
  const corSalva = useRef();
  corSalva.current = tenant?.branding?.corFundo;
  useEffect(() => () => previewCorFundo(corSalva.current), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => setMsg(null), msg.ok ? 3500 : 7000);
    return () => clearTimeout(t);
  }, [msg]);
  useEffect(() => {
    if (!['whatsapp', 'antiban'].includes(tab)) return;
    api.get('/tenant/whatsapp/status').then((r) => setStatus(r.data)).catch(() => setStatus({ online: false }));
    api.get('/tenant/webhook-info').then((r) => setHooks(r.data)).catch(() => {});
  }, [tab]);

  if (!form) return <p className="text-sm text-slate-500">Carregando...</p>;
  const dirty = JSON.stringify(buildPayload(form, secrets)) !== JSON.stringify(buildPayload(clone(tenant)));

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
    const payload = buildPayload(form, secrets);
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
    <div className="pb-20">
      <Header
        title="Configurações"
        subtitle={`${form.nome} · código de acesso: ${form.slug}`}
        action={<Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar alterações'}</Button>}
      />
      <Tabs
        className="mb-5"
        tabs={TABS.filter((t) => t.id !== 'ia' || hasFeature('agenteWhatsApp'))}
        value={tab}
        onChange={(id) => {
          setTab(id);
          // Mantém a aba no endereço (recarregar ou compartilhar o link abre nela)
          const url = new URL(window.location.href);
          url.searchParams.set('aba', id);
          window.history.replaceState(null, '', url);
        }}
      />

      {(dirty || msg) && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none lg:pl-[19rem]">
          <div className="mx-auto max-w-xl pointer-events-auto flex items-center gap-3 rounded-2xl bg-ibbiNavy text-white shadow-soft pl-4 pr-2 py-2" role="status">
            <p className={`text-sm flex-1 min-w-0 ${msg ? (msg.ok ? 'text-emerald-300' : 'text-red-300') : 'text-white/80'}`}>
              {msg ? msg.text : 'Alterações não salvas'}
            </p>
            {dirty && (
              <>
                <button type="button" className="text-sm text-white/70 hover:text-white px-2 py-1.5 shrink-0" onClick={() => { setForm(null); setSecrets({ evolutionApiKey: '', cloudToken: '' }); }}>Descartar</button>
                <Button variant="gold" onClick={save} disabled={saving} className="shrink-0">{saving ? 'Salvando...' : 'Salvar'}</Button>
              </>
            )}
          </div>
        </div>
      )}

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
            <div className="space-y-3">
              <Field label="Chave Pix" hint="CNPJ, email, celular (+55…) ou chave aleatória"><input className={inputClass} value={form.pix?.chave || ''} onChange={(e) => set('pix.chave', e.target.value)} /></Field>
              <Field label="Nome do recebedor" hint="Nome completo da igreja. No código Pix vão até 25 letras (limite do Banco Central)"><input className={inputClass} maxLength={60} value={form.pix?.nome || ''} placeholder={form.nome || ''} onChange={(e) => set('pix.nome', e.target.value)} /></Field>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              A cidade do Pix é a dos Dados da igreja{form.cidade ? ` (${form.cidade})` : ': preencha o campo Cidade'}. O dinheiro cai direto na conta da igreja; a confirmação do pagamento é feita pela liderança em Eventos.
            </p>
          </Card>
          <Card title="Mensagens e portal" subtitle="Como a igreja assina e para onde os links levam">
            <div className="space-y-3">
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
            <ProgramacaoSemanalField value={form.programacaoSemanal || ''} onChange={(v) => set('programacaoSemanal', v)} />
          </Card>
        </div>
      )}

      {tab === 'aparencia' && (
        <div className="grid lg:grid-cols-5 gap-4 items-start">
          <Card title="Logo" subtitle="Aparece no menu, no login, na carteirinha e nas mensagens" className="lg:col-span-2">
            <LogoField value={form.branding?.logoUrl || ''} onChange={(v) => set('branding.logoUrl', v)} />
          </Card>
          <Card title="Fundo" subtitle="O menu lateral mantém o azul do PastorIA; o fundo das telas é da igreja. A prévia já aparece aqui — salve para aplicar a todos." className="lg:col-span-3">
            <CorFundoField value={form.branding?.corFundo || ''} onChange={(v) => set('branding.corFundo', v)} />
          </Card>
        </div>
      )}

      {tab === 'whatsapp' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card
            title="Conexão"
            action={status && (
              status.desativado ? <Badge color="gray" icon="⏸">Desligado</Badge> : (
                <Badge color={status.online ? 'green' : 'red'} icon={status.online ? '●' : '■'}>
                  {status.online ? 'Conectado' : status.configurado === false ? 'Não configurado' : 'Desconectado'}
                </Badge>
              )
            )}
          >
            <div className="space-y-3">
              <Toggle
                checked={w.ativo !== false}
                onChange={alternarWhatsapp}
                label={w.ativo !== false ? 'WhatsApp ligado' : 'WhatsApp desligado'}
                hint="Desligado, o sistema não envia nem responde nada, sem mexer na instância da Evolution. Vale na hora."
              />
              {w.ativo === false && (
                <p className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2">
                  ⏸ Desligado{w.desativadoEm ? ` desde ${new Date(w.desativadoEm).toLocaleString('pt-BR')}` : ''}. Automações, avisos e respostas do assistente estão parados.
                </p>
              )}
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
          <Card title="Teste e webhooks" subtitle="Para o assistente receber as mensagens da liderança">
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
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

      {tab === 'antiban' && (
        <div className="grid lg:grid-cols-3 gap-4 items-start">
          <div className="lg:col-span-2 space-y-4">
            <Card title="🛡️ Ritmo entre mensagens" subtitle="Vale para envios iniciados pela igreja (lotes e automações). Respostas a quem escreveu não esperam.">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Intervalo mínimo (s)" hint="Nunca menos de 30s"><input type="number" min="30" inputMode="numeric" className={inputClass} value={w.antiban?.intervaloMinSeg ?? 45} onChange={(e) => set('whatsapp.antiban.intervaloMinSeg', Number(e.target.value))} /></Field>
                <Field label="Intervalo máximo (s)" hint="Sorteado entre mín. e máx."><input type="number" min="30" inputMode="numeric" className={inputClass} value={w.antiban?.intervaloMaxSeg ?? 90} onChange={(e) => set('whatsapp.antiban.intervaloMaxSeg', Number(e.target.value))} /></Field>
                <Field label="Pausa longa a cada (mensagens)"><input type="number" min="0" inputMode="numeric" className={inputClass} value={w.antiban?.pausaACada ?? 20} onChange={(e) => set('whatsapp.antiban.pausaACada', Number(e.target.value))} /></Field>
                <Field label="Duração da pausa (min)"><input type="number" min="0" inputMode="numeric" className={inputClass} value={w.antiban?.pausaMin ?? 5} onChange={(e) => set('whatsapp.antiban.pausaMin', Number(e.target.value))} /></Field>
              </div>
              <div className="mt-3">
                <Toggle checked={w.antiban?.digitando !== false} onChange={(v) => set('whatsapp.antiban.digitando', v)} label='Mostrar "digitando…" antes de cada mensagem' hint="Simula digitação humana (Evolution)" />
              </div>
            </Card>
            <Card title="🕗 Horário e limites" subtitle="Fora do horário, os envios automáticos esperam a próxima janela">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Envios a partir de"><input type="time" className={inputClass} value={w.antiban?.horarioInicio || '08:00'} onChange={(e) => set('whatsapp.antiban.horarioInicio', e.target.value)} /></Field>
                <Field label="Envios até"><input type="time" className={inputClass} value={w.antiban?.horarioFim || '21:00'} onChange={(e) => set('whatsapp.antiban.horarioFim', e.target.value)} /></Field>
                <Field label="Limite por hora"><input type="number" min="1" inputMode="numeric" className={inputClass} value={w.antiban?.limitePorHora ?? 60} onChange={(e) => set('whatsapp.antiban.limitePorHora', Number(e.target.value))} /></Field>
                <Field label="Limite por dia"><input type="number" min="1" inputMode="numeric" className={inputClass} value={w.antiban?.limiteDiario ?? 400} onChange={(e) => set('whatsapp.antiban.limiteDiario', Number(e.target.value))} /></Field>
              </div>
            </Card>
          </div>
          <div className="space-y-4">
            <Card
              title="Agora"
              action={status?.antiban && <Badge color={status.antiban.dentroDoHorario ? 'green' : 'amber'}>{status.antiban.dentroDoHorario ? 'No horário' : 'Fora do horário'}</Badge>}
            >
              {status?.antiban ? (
                <div className="space-y-4">
                  {[
                    ['Última hora', status.antiban.ultimaHora, w.antiban?.limitePorHora ?? 60],
                    ['Últimas 24h', status.antiban.ultimas24h, w.antiban?.limiteDiario ?? 400],
                  ].map(([label, usado, limite]) => {
                    const pct = Math.min(100, Math.round((usado / Math.max(1, limite)) * 100));
                    return (
                      <div key={label}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="text-slate-600">{label}</span>
                          <span className="tabular-nums text-ibbiNavy font-medium">{usado} <span className="text-slate-400 font-normal">/ {limite}</span></span>
                        </div>
                        <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-sm text-slate-400">Carregando uso…</p>}
            </Card>
            <Card title="Boas práticas">
              <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
                <li>✅ Mensagem idêntica para o mesmo número não é reenviada em 24h.</li>
                <li>📱 Use um número dedicado e "aquecido" (conversas reais antes de lotes grandes).</li>
                <li>📇 Peça para os membros salvarem o contato da igreja.</li>
                <li>🔗 Evite links encurtados.</li>
                <li>🚀 Para volume alto, prefira a API Oficial.</li>
              </ul>
            </Card>
          </div>
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
          <Card title="🌱 Jornada do visitante" subtitle="30 dias de acolhimento: dias 1, 2, 3, 7, 14 e 21, e resumo à liderança no dia 30">
            <Toggle checked={a.jornada?.ativo !== false} onChange={(v) => set('automacoes.jornada.ativo', v)} label="Acompanhar visitantes e novos convertidos" hint="Começa sozinha em todo cadastro de visitante ou novo decidido" />
            <Toggle checked={a.jornada?.primeirosDias !== false} onChange={(v) => set('automacoes.jornada.primeirosDias', v)} label="Mensagens dos primeiros dias" hint="Dia 1: agradece a visita (ou celebra a decisão por Jesus). Dia 2: avisa que a igreja está orando e convida a mandar um pedido de oração. Dia 3: pergunta como foi." />
            <Toggle checked={a.jornada?.avisarLideranca !== false} onChange={(v) => set('automacoes.jornada.avisarLideranca', v)} label="No dia 30, avisar a liderança de quem ainda não voltou" />
            <Field label="Horário das mensagens"><input type="time" className={inputClass} value={a.jornada?.hora || '10:00'} onChange={(e) => set('automacoes.jornada.hora', e.target.value)} /></Field>
            {!hasFeature('jornadaVisitante') && <p className="text-xs text-amber-700 mt-2">Disponível a partir do plano Crescer.</p>}
          </Card>
          <Card title="⛪ Agenda de cultos e lembretes" subtitle='Quem envia "LEMBRETE" no WhatsApp recebe um aviso antes de cada culto (com o link da transmissão)'>
            <AgendaCultos cultos={form.cultosProgramados || []} onChange={(v) => set('cultosProgramados', v)} />
          </Card>
          <Card title="🗓️ Escalas de voluntários" subtitle="Convite, confirmação e lembrete pelo WhatsApp para quem serve em cada ministério">
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Ao montar uma escala em <strong>Escalas</strong>, cada voluntário recebe o convite para responder <em>1 Confirmo</em> ou <em>2 Não posso</em>. Quem recusa gera sugestões de substituto para o responsável. Na véspera, no horário abaixo, quem confirmou recebe um lembrete e o responsável recebe a lista de quem ainda não respondeu.
              </p>
              <Field label="Horário do lembrete (véspera)"><input type="time" className={inputClass} value={a.escalas?.lembreteHora || '18:00'} onChange={(e) => set('automacoes.escalas.lembreteHora', e.target.value)} /></Field>
              <EscalasResumo />
            </div>
          </Card>
          <Card title="💛 Reengajamento de ausentes" subtitle="Mensagem personalizada pela IA depois de cada chamada">
            <Toggle checked={Boolean(a.ausencia?.ativo)} onChange={(v) => set('automacoes.ausencia.ativo', v)} label="Ativar motor de reengajamento" hint="Depois de cada chamada, conta as faltas seguidas de cada pessoa, abre um alerta em Cuidado Pastoral e prepara uma mensagem carinhosa (escrita pela IA) para quem faltou. Quando a pessoa volta, o alerta fecha sozinho." />
            <Toggle checked={Boolean(a.ausencia?.autoEnviar)} onChange={(v) => set('automacoes.ausencia.autoEnviar', v)} label="Enviar sem aprovação" hint="Ligado: a mensagem vai direto para quem faltou. Desligado: o líder da classe recebe as mensagens prontas no WhatsApp e responde 'enviar' para aprovar." />
            <Toggle checked={a.ausencia?.mensagemPrimeiraFalta !== false} onChange={(v) => set('automacoes.ausencia.mensagemPrimeiraFalta', v)} label="Mandar já na primeira falta" hint="Ligado: a primeira falta já gera mensagem (com o tema da aula e a foto da turma, se houver). Desligado: só a partir da 2ª falta seguida." />
            <Toggle checked={a.ausencia?.enviarEmail !== false} onChange={(v) => set('automacoes.ausencia.enviarEmail', v)} label="Email para quem atingir o limite" hint="Quando a pessoa chega ao número de faltas seguidas definido abaixo, ela também recebe a mensagem por email (se tiver email no cadastro)." />
            <Toggle checked={a.ausencia?.incluirEncontros !== false} onChange={(v) => set('automacoes.ausencia.incluirEncontros', v)} label="Aplicar também aos Encontros (uniões, louvor…)" hint="Faltas seguidas nos encontros de cada grupo geram as mesmas mensagens e alertas" />
            <Field label="Alertar a liderança após (faltas seguidas)" hint="Esse é o limite: a liderança recebe um aviso para ligar ou visitar, e a pessoa recebe o email (se ligado acima).">
              <input type="number" min="2" max="12" className={inputClass} value={a.ausencia?.semanasAlerta || 4} onChange={(e) => set('automacoes.ausencia.semanasAlerta', Number(e.target.value))} />
            </Field>
            {!hasFeature('reengajamento') && <p className="text-xs text-amber-700 mt-2">Disponível a partir do plano Crescer.</p>}
          </Card>
          <Card title="📊 Relatório semanal" subtitle="Resumo da semana no WhatsApp (e email) da liderança">
            <Toggle checked={Boolean(a.relatorioSemanal?.ativo)} onChange={(v) => set('automacoes.relatorioSemanal.ativo', v)} label="Enviar relatório semanal" hint="Presença da EBD por classe (com a variação da semana anterior), quem precisa de contato, quem está esfriando, quem voltou, aniversariantes e uma sugestão prática da semana." />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Dia">
                <select className={inputClass} value={a.relatorioSemanal?.diaSemana ?? 1} onChange={(e) => set('automacoes.relatorioSemanal.diaSemana', Number(e.target.value))}>
                  {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </Field>
              <Field label="Hora"><input type="time" className={inputClass} value={a.relatorioSemanal?.hora || '08:00'} onChange={(e) => set('automacoes.relatorioSemanal.hora', e.target.value)} /></Field>
            </div>
            <div className="mt-3"><RelatorioPrevia /></div>
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
                <GrupoSelect
                  grupos={grupos}
                  onSelect={(g) => { set('whatsapp.grupoLideranca', { jid: g.jid, nome: g.nome }); setGrupos(null); }}
                />
              )}
              {grupoMsg && <p className="text-xs text-slate-600">{grupoMsg}</p>}
              {(w.liderancaEnvio || 'individual') !== 'individual' && !w.grupoLideranca?.jid && (
                <p className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2">Sem grupo escolhido, os avisos continuam indo no privado de cada contato.</p>
              )}
              <p className="text-[11px] text-slate-400">
                A lista mostra os grupos de que o número da igreja participa. Para enviar, basta ser participante; se o grupo só aceita mensagens de administradores, o número precisa ser admin. Clique em Salvar alterações depois de escolher.
              </p>
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
