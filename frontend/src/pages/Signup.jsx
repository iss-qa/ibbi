import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Logo from '../components/landing/Logo';
import { refAtual, limparRef } from '../utils/indicacao';

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const PLANOS = [
  { id: 'semente', nome: 'Semente', hint: 'Aniversários e EBD' },
  { id: 'crescer', nome: 'Crescer', hint: 'IA + reengajamento', destaque: true },
  { id: 'multiplicar', nome: 'Multiplicar', hint: 'Áudio, foto e WhatsApp Oficial' },
];

const slugify = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const maskPhone = (v) => {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const input = 'mt-1 w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brandGold/60 focus:border-brandGold bg-white';

// Cadastro público de igreja → cria o tenant em trial e mostra as credenciais do master.
export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const planoInicial = new URLSearchParams(location.search).get('plano');
  const ref = refAtual(location.search); // indicação de outra igreja: +7 dias de teste

  const [form, setForm] = useState({
    nome: '', slug: '', responsavel: '', email: '', celular: '', cidade: '', uf: '',
    plano: PLANOS.some((p) => p.id === planoInicial) ? planoInicial : 'crescer',
    aceite: false, website: '',
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState(null); // { disponivel, sugestao }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const [copied, setCopied] = useState(false);
  const slugTimer = useRef();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  // Código sugerido a partir do nome, até o pastor editar manualmente.
  useEffect(() => {
    if (!slugTouched) setForm((f) => ({ ...f, slug: slugify(f.nome) }));
  }, [form.nome, slugTouched]);

  // Checa disponibilidade do código com debounce.
  useEffect(() => {
    clearTimeout(slugTimer.current);
    const slug = slugify(form.slug);
    if (slug.length < 2) { setSlugStatus(null); return undefined; }
    slugTimer.current = setTimeout(() => {
      api.get(`/public/signup/slug/${encodeURIComponent(slug)}`).then((r) => setSlugStatus(r.data)).catch(() => setSlugStatus(null));
    }, 350);
    return () => clearTimeout(slugTimer.current);
  }, [form.slug]);

  const canSubmit = useMemo(() => (
    form.nome.trim().length >= 3 && form.responsavel.trim().length >= 3 && /\S+@\S+\.\S+/.test(form.email)
    && form.celular.replace(/\D/g, '').length >= 10 && form.aceite && slugStatus?.disponivel !== false
  ), [form, slugStatus]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/public/signup', { ...form, ref: ref || undefined, slug: slugify(form.slug), celular: form.celular.replace(/\D/g, '') });
      limparRef();
      setDone(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const msg = err?.response?.data?.message || 'Não foi possível concluir o cadastro. Tente novamente.';
      const sugestao = err?.response?.data?.sugestao;
      setError(sugestao ? `${msg}. Sugestão de código: ${sugestao}` : msg);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Igreja: ${done.igreja.slug}\nLogin: ${done.login}\nSenha temporária: ${done.senhaTemporaria}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard indisponível */ }
  };

  const goLogin = () => {
    localStorage.setItem('ibbi_tenant', done.igreja.slug);
    navigate(`/login?igreja=${encodeURIComponent(done.igreja.slug)}`, { state: { login: done.login } });
  };

  return (
    <div className="min-h-screen bg-brandCream">
      <header className="bg-brandNavy text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition" aria-label="Voltar para a página inicial">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m6-6l-6 6 6 6" /></svg>
              <span className="hidden sm:inline">Voltar</span>
            </Link>
            <Link to="/" aria-label="PastorIA — início"><Logo light /></Link>
          </div>
          <Link to="/login" className="text-sm text-white/80 hover:text-white">Já tenho conta</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-10">
        <aside className="lg:sticky lg:top-10 self-start">
          <p className="text-brandGold text-sm font-semibold tracking-wider uppercase">Cadastro da igreja</p>
          {ref && !done && <p className="mt-3 inline-block text-sm bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg px-3 py-1.5">🎁 Indicação de <strong>{ref}</strong>: você ganhou <strong>+7 dias</strong> de teste (21 no total).</p>}
          <h1 className="font-display text-3xl sm:text-4xl text-brandNavy mt-3 leading-tight">
            {done ? 'Sua igreja está pronta.' : 'Comece a cuidar de quem está sumindo.'}
          </h1>
          <p className="text-slate-600 mt-4 leading-relaxed">
            {done
              ? 'Guarde as credenciais abaixo. No primeiro acesso você escolherá uma nova senha e poderá conectar o WhatsApp.'
              : `${ref ? '21' : '14'} dias grátis no plano escolhido, sem cartão de crédito. Em minutos sua igreja terá o Barnabé, assistente de IA, no WhatsApp da liderança.`}
          </p>
          <ul className="mt-6 space-y-3 text-sm text-slate-700">
            {['Congregações ilimitadas, uma cobrança só', 'Assistente de IA no WhatsApp da liderança', 'Chamada, ausências e reengajamento automáticos', 'Cancele quando quiser, seus dados são seus'].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-brandNavy text-brandGold grid place-items-center text-xs">✓</span>{t}
              </li>
            ))}
          </ul>
          <blockquote className="mt-8 border-l-2 border-brandGold pl-4 text-slate-500 text-sm italic">
            "Apascentai o rebanho de Deus que está entre vós, tendo cuidado dele." — 1 Pedro 5:2
          </blockquote>
        </aside>

        {done ? (
          <section className="bg-white rounded-2xl shadow-soft border border-stone-100 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center text-2xl">✓</span>
              <div>
                <p className="font-semibold text-brandNavy text-lg">{done.igreja.nome}</p>
                <p className="text-sm text-slate-500">Plano {done.plano} · teste grátis até {new Date(done.trialEndsAt).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>

            <dl className="mt-6 divide-y divide-stone-100 rounded-xl border border-stone-200 overflow-hidden text-sm">
              {[['Código da igreja', done.igreja.slug], ['Login', done.login], ['Senha temporária', done.senhaTemporaria]].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 px-4 py-3 bg-brandCream/60">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-mono font-semibold text-brandNavy tracking-wide">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-slate-500 mt-3">Também enviamos essas informações para <strong>{form.email}</strong>. Se o email não chegar, use os dados acima.</p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button type="button" onClick={goLogin} className="flex-1 bg-brandGold text-brandNavy font-bold px-6 py-3 rounded-full hover:brightness-95 transition">Entrar agora</button>
              <button type="button" onClick={copy} className="flex-1 border border-stone-200 text-brandNavy font-semibold px-6 py-3 rounded-full hover:bg-brandCream transition">{copied ? 'Copiado ✓' : 'Copiar credenciais'}</button>
            </div>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-soft border border-stone-100 p-6 sm:p-8 space-y-5" noValidate>
            <div>
              <label className="text-sm font-medium text-slate-700">Nome da igreja</label>
              <input className={input} value={form.nome} onChange={set('nome')} placeholder="Ex.: Igreja Batista da Paz" required />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Código da igreja <span className="text-slate-400 font-normal">(usado no login)</span></label>
              <div className="mt-1 flex items-center border border-stone-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brandGold/60">
                <span className="px-3 text-sm text-slate-400 bg-stone-50 py-2.5 border-r border-stone-200">igreja:</span>
                <input className="flex-1 min-w-0 px-3 py-2.5 text-sm focus:outline-none" value={form.slug} onChange={(e) => { setSlugTouched(true); setForm((f) => ({ ...f, slug: slugify(e.target.value) })); }} placeholder="batista-da-paz" />
              </div>
              {slugStatus && (
                <p className={`text-xs mt-1 ${slugStatus.disponivel ? 'text-emerald-600' : 'text-red-600'}`}>
                  {slugStatus.disponivel ? 'Código disponível ✓' : `Código já em uso. Sugestão: ${slugStatus.sugestao}`}
                </p>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Seu nome</label>
                <input className={input} value={form.responsavel} onChange={set('responsavel')} placeholder="Pastor(a) responsável" required />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Seu WhatsApp</label>
                <input className={input} inputMode="tel" value={form.celular} onChange={(e) => setForm((f) => ({ ...f, celular: maskPhone(e.target.value) }))} placeholder="(71) 99999-9999" required />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input className={input} type="email" value={form.email} onChange={set('email')} placeholder="voce@igreja.com.br" required />
            </div>

            <div className="grid sm:grid-cols-[1fr_120px] gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Cidade <span className="text-slate-400 font-normal">(opcional)</span></label>
                <input className={input} value={form.cidade} onChange={set('cidade')} placeholder="Salvador" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">UF</label>
                <select className={input} value={form.uf} onChange={set('uf')}>
                  <option value="">—</option>
                  {UFS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700">Plano para o teste grátis</p>
              <div className="mt-2 grid sm:grid-cols-3 gap-2">
                {PLANOS.map((p) => (
                  <label key={p.id} className={`cursor-pointer rounded-xl border px-3 py-2.5 text-sm transition ${form.plano === p.id ? 'border-brandGold bg-brandGold/10 ring-1 ring-brandGold' : 'border-stone-200 hover:border-stone-300'}`}>
                    <input type="radio" name="plano" value={p.id} checked={form.plano === p.id} onChange={set('plano')} className="sr-only" />
                    <span className="font-semibold text-brandNavy flex items-center justify-between">{p.nome}{p.destaque && <span className="text-[10px] uppercase tracking-wider text-brandGold">Popular</span>}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{p.hint}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Você pode mudar de plano a qualquer momento. <Link to="/planos" className="text-brandBlue">Comparar planos</Link></p>
            </div>

            {/* honeypot: invisível para pessoas */}
            <div className="hidden" aria-hidden="true">
              <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></label>
            </div>

            <label className="flex items-start gap-2.5 text-sm text-slate-600">
              <input type="checkbox" checked={form.aceite} onChange={set('aceite')} className="mt-1 accent-brandNavy" />
              <span>Li e aceito os <a href="/termos" target="_blank" rel="noreferrer" className="text-brandBlue underline">Termos de Uso</a> e a <a href="/privacidade" target="_blank" rel="noreferrer" className="text-brandBlue underline">Política de Privacidade</a>, e me comprometo a respeitar as políticas do WhatsApp e quem pedir para sair.</span>
            </label>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={!canSubmit || loading} className="w-full bg-brandGold text-brandNavy font-bold px-6 py-3.5 rounded-full hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Preparando sua igreja…' : 'Criar minha igreja grátis'}
            </button>
            <p className="text-center text-xs text-slate-400">Sem cartão de crédito. Sem fidelidade.</p>
            <p className="text-center text-xs"><Link to="/" className="text-slate-500 hover:text-ibbiNavy">← Voltar para a página inicial</Link></p>
          </form>
        )}
      </main>
    </div>
  );
}
