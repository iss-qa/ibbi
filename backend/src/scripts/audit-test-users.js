// Levanta usuários (e pessoas) criados por testes automatizados — SOMENTE LEITURA.
// Não usa os models/bootstrap (nada de migração ou índice): lê as collections direto.
//
// Uso: MONGO_URI="mongodb+srv://…/ibbi_prod" node backend/src/scripts/audit-test-users.js [saida.csv]
// Gera um resumo no terminal e um CSV com todos os suspeitos (classificação por linha).
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

// Nomes gerados pelas suítes de teste (tests/api, tests/e2e, tests/full).
const STRONG = [
  /\bteste\b/i,
  /\bautomatizado\b/i,
  /\be2e\b/i,
  /^invasor$/i,
  /^inscrito web$/i,
  /^pessoa (secreta|extra)\b/i,
  /^para deletar\b/i,
  /^duplicata\b/i,
  /\bmn[a-z0-9]{5,}$/i, // sufixo Date.now().toString(36) usado nos testes
];
// Nomes "reais" usados nos testes de cadastro: podem coincidir com membros de verdade.
const WEAK = [/^maria de souza silva$/i, /^jo[aã]o dos santos pereira$/i];
const TEST_LOGINS = /^(membro|admin)\.teste$|teste/i;

const classify = (doc, extra = {}) => {
  const nome = doc.nome || '';
  const motivos = [];
  if (STRONG.some((r) => r.test(nome))) motivos.push('nome de teste');
  if (doc.login && TEST_LOGINS.test(doc.login)) motivos.push('login de teste');
  if (doc.celular && String(doc.celular).startsWith('000')) motivos.push('telefone 000 (E2E)');
  if (extra.tenantTeste) motivos.push(`igreja de teste (${extra.tenantSlug})`);
  if (motivos.length) return { nivel: 'TESTE', motivos };
  if (WEAK.some((r) => r.test(nome))) return { nivel: 'REVISAR', motivos: ['nome usado nos testes de cadastro'] };
  if (extra.duplicado) return { nivel: 'REVISAR', motivos: ['nome repetido na mesma igreja'] };
  return { nivel: 'OK', motivos: [] };
};

const isTestTenant = (t) => /\b(teste|e2e)\b|^igreja (nova|indicada|com um nome)|^pastor (teste|semente|igreja b)/i.test(`${t.nome} ${t.responsavel || ''}`)
  || /e2e|teste|^t-|^test/i.test(t.slug || '');

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const main = async () => {
  if (!process.env.MONGO_URI) throw new Error('Defina MONGO_URI');
  await mongoose.connect(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  console.log(`Banco: ${db.databaseName} (somente leitura)\n`);

  const tenants = await db.collection('tenants').find({}, { projection: { nome: 1, slug: 1, responsavel: 1, status: 1, createdAt: 1, demo: 1 } }).toArray();
  const tById = new Map(tenants.map((t) => [String(t._id), { ...t, teste: isTestTenant(t) || t.slug === 'demo' }]));

  const users = await db.collection('users').find({}, { projection: { senha: 0 } }).toArray();
  const persons = await db.collection('people').find({}, { projection: { nome: 1, celular: 1, tenantId: 1, tipo: 1, status: 1, createdAt: 1 } }).toArray();
  const personById = new Map(persons.map((p) => [String(p._id), p]));

  // Nomes repetidos por igreja (os testes recriam o mesmo cadastro a cada execução).
  const countKey = (d) => `${d.tenantId}|${(d.nome || '').trim().toLowerCase()}`;
  const nomeCount = new Map();
  users.forEach((u) => nomeCount.set(countKey(u), (nomeCount.get(countKey(u)) || 0) + 1));

  console.log('Igrejas (tenants):');
  for (const t of tById.values()) {
    const nu = users.filter((u) => String(u.tenantId) === String(t._id)).length;
    const np = persons.filter((p) => String(p.tenantId) === String(t._id)).length;
    console.log(`  ${t.teste ? '⚠️ ' : '   '}${t.slug.padEnd(28)} ${String(nu).padStart(4)} usuários  ${String(np).padStart(5)} pessoas  ${t.nome}${t.teste ? '  ← igreja de teste/demo' : ''}`);
  }
  const semTenant = users.filter((u) => !tById.has(String(u.tenantId)));
  if (semTenant.length) console.log(`  (sem igreja válida)            ${semTenant.length} usuários`);

  const rows = users.map((u) => {
    const t = tById.get(String(u.tenantId));
    const p = u.personId ? personById.get(String(u.personId)) : null;
    const c = classify({ ...u, celular: p?.celular }, {
      tenantTeste: t?.teste,
      tenantSlug: t?.slug,
      duplicado: nomeCount.get(countKey(u)) > 1,
    });
    return {
      nivel: c.nivel,
      motivos: c.motivos.join('; '),
      igreja: t?.slug || '(sem igreja)',
      userId: String(u._id),
      nome: u.nome,
      login: u.login,
      role: u.role,
      ativo: u.ativo,
      criadoEm: (u.createdAt || u._id.getTimestamp()).toISOString?.() || '',
      personId: u.personId ? String(u.personId) : '',
      celular: p?.celular || '',
    };
  });

  const personRows = persons
    .filter((p) => !users.some((u) => String(u.personId) === String(p._id)))
    .map((p) => {
      const t = tById.get(String(p.tenantId));
      const c = classify(p, { tenantTeste: t?.teste, tenantSlug: t?.slug });
      return { ...c, p, t };
    })
    .filter((r) => r.nivel !== 'OK');

  const by = (n) => rows.filter((r) => r.nivel === n);
  console.log(`\nUsuários: ${users.length} no total · TESTE ${by('TESTE').length} · REVISAR ${by('REVISAR').length} · OK ${by('OK').length}`);
  console.log(`Pessoas sem usuário com cara de teste: ${personRows.length}`);
  const masters = rows.filter((r) => r.role === 'master');
  console.log('\nMasters por igreja:');
  masters.forEach((m) => console.log(`  ${m.igreja.padEnd(28)} ${m.login.padEnd(22)} ${m.nome}  [${m.nivel}]`));

  const out = process.argv[2] || path.join(process.cwd(), `audit-test-users-${db.databaseName}.csv`);
  const header = ['nivel', 'motivos', 'igreja', 'userId', 'nome', 'login', 'role', 'ativo', 'criadoEm', 'personId', 'celular'];
  const lines = [header.join(',')];
  rows.filter((r) => r.nivel !== 'OK')
    .sort((a, b) => a.nivel.localeCompare(b.nivel) || a.igreja.localeCompare(b.igreja) || a.nome.localeCompare(b.nome))
    .forEach((r) => lines.push(header.map((h) => csvCell(r[h])).join(',')));
  personRows.forEach(({ nivel, motivos, p, t }) => lines.push([
    `${nivel}-PESSOA`, motivos.join('; '), t?.slug || '(sem igreja)', '', p.nome, '', '', '', (p.createdAt || p._id.getTimestamp()).toISOString?.() || '', String(p._id), p.celular || '',
  ].map(csvCell).join(',')));
  fs.writeFileSync(out, `${lines.join('\n')}\n`);
  console.log(`\nLista detalhada: ${out}`);
  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
