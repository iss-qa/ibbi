// Seed da suíte E2E: recria do zero o banco de teste (NUNCA o de desenvolvimento) com 3 igrejas.
const path = require('path');
const E2E = require('./config');

const B = (p) => require(path.resolve(__dirname, '../../backend', p));

const seed = async () => {
  const mongoose = B('node_modules/mongoose');
  const uri = process.env.MONGO_URI || E2E.banco;
  // Trava de segurança: só apaga bancos de teste.
  if (!/\/[a-z0-9_]*_e2e(\?|$)/.test(uri)) throw new Error(`Recusado: o seed E2E só roda em banco *_e2e (recebido: ${uri})`);
  await mongoose.connect(uri);
  await mongoose.connection.db.dropDatabase();

  const Tenant = B('src/models/Tenant.model');
  const Person = B('src/models/Person.model');
  const User = B('src/models/User.model');
  const GrupoEncontro = B('src/models/GrupoEncontro.model');
  const { runWithTenant, runAsPlatform } = B('src/tenancy/context');
  const { TERMOS_VERSAO } = B('src/config/legal');
  const { fones, senha, igrejas, webhookToken } = E2E;

  const base = (slug, nome, plano, extra = {}) => ({
    nome, nomeCurto: nome.split(' ').slice(-1)[0], slug, plano, status: 'ativa', cidade: 'Salvador', uf: 'BA', email: `${slug}@e2e.test`, telefone: '0000000000',
    billing: { isento: true, ciclo: 'mensal' }, congregacoes: ['Sede', 'Norte'], timezone: 'America/Bahia',
    whatsapp: { provider: 'none', useEnvFallback: true, webhookToken: `${webhookToken}-${slug}`, numeroIgreja: `55${fones.igreja}`, numeroInstancia: `55${fones.bot}` },
    ia: { ativo: true, nomeAssistente: 'Barnabé' },
    ...extra,
  });

  const [a, b, semente] = await runAsPlatform(() => Tenant.create([
    base(igrejas.a, 'Igreja Teste E2E', 'multiplicar', {
      lideranca: [{ nome: 'Pastor Teste', celular: fones.lider, papel: 'Pastor' }],
      pix: { chave: 'pix@e2e.test', nome: 'Igreja Teste E2E', cidade: 'Salvador' },
      automacoes: { jornada: { ativo: true, hora: '10:00', avisarLideranca: true } },
    }),
    base(igrejas.b, 'Igreja B E2E', 'crescer', { termos: { versao: TERMOS_VERSAO, aceitoEm: new Date(), aceitoPor: 'seed' } }),
    base(igrejas.semente, 'Igreja Semente E2E', 'semente', { termos: { versao: TERMOS_VERSAO, aceitoEm: new Date(), aceitoPor: 'seed' } }),
  ]));

  const pessoa = (dados) => Person.create({ congregacao: 'Sede', status: 'ativo', tipo: 'membro', ...dados });
  const usuario = (dados) => User.create({ senha, ativo: true, mustChangePassword: false, ...dados });

  await runWithTenant(a, async () => {
    const lider = await pessoa({ nome: 'Pastor Teste', sexo: 'Masculino', celular: fones.lider, dataNascimento: new Date('1980-05-10T12:00:00Z'), batizado: true });
    const admin = await pessoa({ nome: 'Admin Teste', sexo: 'Feminino', celular: fones.admin, congregacao: 'Sede' });
    const membro = await pessoa({ nome: 'Membro Teste', sexo: 'Feminino', celular: fones.membro, dataNascimento: new Date('2000-03-03T12:00:00Z') });
    const vol = await pessoa({ nome: 'Voluntario Teste', sexo: 'Masculino', celular: fones.voluntario, ministerio: 'Vocais (Voz)' });
    const sub = await pessoa({ nome: 'Substituta Teste', sexo: 'Feminino', celular: fones.substituto, ministerio: 'Vocais (Voz)' });
    const extras = [];
    for (let i = 0; i < 12; i += 1) {
      extras.push(await pessoa({ nome: `Pessoa Extra ${String.fromCharCode(65 + i)} Teste`, sexo: i % 2 ? 'Masculino' : 'Feminino', celular: `000000002${String(i).padStart(2, '0')}`, dataNascimento: new Date(Date.UTC(1990 + i, 1, 10, 12)), congregacao: i % 4 === 0 ? 'Norte' : 'Sede' }));
    }
    await usuario({ nome: 'Pastor Teste', login: 'master', role: 'master', personId: lider._id });
    await usuario({ nome: 'Admin Teste', login: 'admin', role: 'admin', personId: admin._id });
    await usuario({ nome: 'Membro Teste', login: 'membro', role: 'user', personId: membro._id });
    await usuario({ nome: 'Bloqueio Teste', login: 'senhaerrada', role: 'user', personId: extras[0]._id });
    const ref = (p) => ({ personId: p._id, nome: p.nome, celular: p.celular });
    await GrupoEncontro.create({ nome: 'União de Jovens', tipo: 'uniao_jovens', congregacao: 'Sede', diaSemana: 6, horario: '19:00', membros: [membro, vol, sub, ...extras.slice(1, 6)].map(ref), lideres: [ref(lider)] });
    await GrupoEncontro.create({ nome: 'Célula Teste', tipo: 'celula', congregacao: 'Sede', diaSemana: 4, horario: '20:00', membros: [membro, ...extras.slice(6, 10)].map(ref), lideres: [ref(lider)] });
  });
  await runWithTenant(b, async () => {
    const p = await pessoa({ nome: 'Pastor Igreja B', celular: '00000000500' });
    await pessoa({ nome: 'Pessoa Secreta Igreja B', celular: '00000000501' });
    await usuario({ nome: 'Pastor Igreja B', login: 'master', role: 'master', personId: p._id });
  });
  await runWithTenant(semente, async () => {
    const p = await pessoa({ nome: 'Pastor Semente', celular: '00000000600' });
    await usuario({ nome: 'Pastor Semente', login: 'master', role: 'master', personId: p._id });
  });
  await mongoose.disconnect();
  console.log('[e2e] banco de teste recriado:', uri);
};

module.exports = { seed };
if (require.main === module) seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
