const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant.model');
const { runWithTenant, runAsPlatform } = require('../tenancy/context');
const { invalidateTenant } = require('../tenancy/tenant.service');
const { TERMOS_VERSAO } = require('../config/legal');
const tenantPlugin = require('../tenancy/plugin');

/**
 * Igreja demonstração (slug "demo"): dados fictícios realistas para quem chega pela landing
 * explorar o sistema. Somente leitura (claim `demo` no JWT + middleware em server.js),
 * WhatsApp desligado (provider "none": nada é enviado), refeita a cada 7 dias com datas relativas.
 */
const SLUG = 'demo';
const REFAZER_APOS_MS = 7 * 864e5;

// Carrega todos os models para conseguir limpar cada coleção da igreja demo.
const carregarModels = () => fs.readdirSync(path.join(__dirname, '..', 'models'))
  .filter((f) => f.endsWith('.model.js')).forEach((f) => require(path.join(__dirname, '..', 'models', f)));

const NOMES_F = ['Ana', 'Beatriz', 'Carla', 'Débora', 'Elisa', 'Fernanda', 'Gabriela', 'Helena', 'Isabela', 'Joana', 'Lúcia', 'Marta', 'Noemi', 'Priscila', 'Raquel', 'Sara', 'Tânia', 'Vera', 'Rute', 'Ester', 'Lia', 'Miriã'];
const NOMES_M = ['André', 'Bruno', 'Caleb', 'Daniel', 'Elias', 'Felipe', 'Gabriel', 'Hugo', 'Isaque', 'João', 'Lucas', 'Marcos', 'Natan', 'Paulo', 'Rafael', 'Samuel', 'Tiago', 'Vinícius', 'Josué', 'Davi'];
const SOBRENOMES = ['Almeida', 'Barbosa', 'Cardoso', 'Dias', 'Esteves', 'Ferreira', 'Gomes', 'Lima', 'Moreira', 'Nascimento', 'Oliveira', 'Pereira', 'Ribeiro', 'Santos', 'Teixeira', 'Vieira'];

// Gerador determinístico (mesmos dados a cada recriação, só as datas mudam).
const rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

const DIA = 864e5;
const isoLocal = (d) => d.toISOString().slice(0, 10);
const domingosPassados = (n) => {
  const hoje = new Date();
  const ultimo = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() - hoje.getUTCDay(), 12));
  return Array.from({ length: n }, (_, i) => new Date(ultimo.getTime() - i * 7 * DIA));
};

const popular = async (tenant) => {
  const r = rng(20261008);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const M = (n) => mongoose.model(n);
  const Person = M('Person'); const User = M('User'); const GrupoEncontro = M('GrupoEncontro'); const Encontro = M('Encontro');
  const EbdAula = M('EbdAula'); const CareAlert = M('CareAlert'); const Jornada = M('Jornada'); const PedidoOracao = M('PedidoOracao');
  const Culto = M('Culto'); const Escala = M('Escala'); const Evento = M('Evento'); const Campanha = M('Campanha'); const Message = M('Message');

  // ── Pessoas ──
  const pessoas = [];
  for (let i = 0; i < 64; i += 1) {
    const fem = r() < 0.55;
    const nome = `${pick(fem ? NOMES_F : NOMES_M)} ${pick(SOBRENOMES)} ${pick(SOBRENOMES)}`;
    const idade = i < 6 ? 6 + Math.floor(r() * 8) : 15 + Math.floor(r() * 60);
    const nasc = new Date(Date.UTC(new Date().getUTCFullYear() - idade, Math.floor(r() * 12), 1 + Math.floor(r() * 27), 12));
    const tipo = i < 6 ? 'criança' : i < 52 ? 'membro' : i < 58 ? 'congregado' : i < 62 ? 'visitante' : 'novo decidido';
    pessoas.push({
      nome, sexo: fem ? 'Feminino' : 'Masculino', dataNascimento: nasc, tipo, status: 'ativo',
      // celular claramente fictício (começa com 000: nunca é de alguém real)
      celular: `000${String(10000000 + i).slice(-8)}`, congregacao: i % 5 === 0 ? 'Vila Esperança' : 'Sede',
      batizado: tipo === 'membro', dataBatismo: tipo === 'membro' ? new Date(nasc.getTime() + (16 + r() * 20) * 365 * DIA) : undefined,
      estadoCivil: idade > 25 && r() < 0.6 ? 'casado(a)' : 'solteiro(a)',
      intercessor: i % 9 === 0, lembreteCulto: i % 3 === 0,
      ministerio: i % 7 === 0 ? 'Vocais (Voz)' : i % 11 === 0 ? 'Instrumentos (Músico)' : undefined,
      dataVisita: tipo === 'visitante' ? new Date(Date.now() - (3 + (i % 4) * 6) * DIA) : undefined,
      dataDecisao: tipo === 'novo decidido' ? new Date(Date.now() - (5 + (i % 2) * 12) * DIA) : undefined,
    });
  }
  const docs = await Person.insertMany(pessoas);
  const sede = docs.filter((p) => p.congregacao === 'Sede' && p.tipo !== 'criança');
  const idadeDe = (p) => new Date().getUTCFullYear() - p.dataNascimento.getUTCFullYear();

  // Usuário master da demo (o acesso é por token de demonstração, a senha não é usada)
  const lider = docs[10];
  await User.create({ nome: 'Pastor Demonstração', login: 'demo', senha: crypto.randomBytes(16).toString('hex'), role: 'master', personId: lider._id, ativo: true, mustChangePassword: false });

  // ── Grupos e encontros (8 semanas) ──
  const ref = (p) => ({ personId: p._id, nome: p.nome, celular: p.celular });
  const mulheres = sede.filter((p) => p.sexo === 'Feminino' && idadeDe(p) >= 18).slice(0, 18);
  const jovens = sede.filter((p) => idadeDe(p) >= 15 && idadeDe(p) <= 30).slice(0, 14);
  const celula = sede.slice(20, 33);
  const grupos = await GrupoEncontro.insertMany([
    { nome: 'União Feminina', tipo: 'uniao_feminina', congregacao: 'Sede', diaSemana: 3, horario: '19:30', membros: mulheres.map(ref), lideres: [ref(mulheres[0])] },
    { nome: 'União de Jovens', tipo: 'uniao_jovens', congregacao: 'Sede', diaSemana: 6, horario: '19:00', membros: jovens.map(ref), lideres: [ref(jovens[0])] },
    { nome: 'Célula Esperança', tipo: 'celula', congregacao: 'Sede', diaSemana: 4, horario: '20:00', local: 'Casa da família Lima', membros: celula.map(ref), lideres: [ref(celula[0])] },
  ]);
  const esfriando = new Set([String(mulheres[3]._id), String(jovens[4]._id), String(celula[5]._id)]);
  const sumido = new Set([String(mulheres[7]._id), String(jovens[8]._id)]);
  const presente = (p, semana) => {
    const id = String(p._id);
    if (sumido.has(id)) return semana >= 4; // faltou as 4 últimas
    if (esfriando.has(id)) return semana >= 4 ? true : semana % 2 === 1; // caiu de 100% para 50%
    return r() < 0.84;
  };
  const datasSemana = domingosPassados(8);
  const encontros = [];
  grupos.forEach((g) => datasSemana.forEach((dom, s) => {
    const data = new Date(dom.getTime() + g.diaSemana * DIA - 7 * DIA);
    if (data > new Date()) return;
    encontros.push({
      grupoId: g._id, grupoNome: g.nome, congregacao: g.congregacao, data, atividade: g.tipo === 'celula' ? 'estudo' : 'reuniao', origem: 'whatsapp',
      presencas: g.membros.map((m) => ({ personId: m.personId, nome: m.nome, presente: presente(m, s) })),
      ausenciasProcessadasEm: new Date(),
      ...(g.tipo === 'celula' ? { relatorio: { visitantes: Math.floor(r() * 3), decisoes: s === 1 ? 1 : 0 } } : {}),
      ...(s === 0 && g.tipo !== 'celula' ? { resumo: { texto: '*📖 Palavra:* Rute 1, a fidelidade que acolhe.\n*✅ Decisões:* visita às irmãs enfermas no sábado.', status: 'enviado', enviadoEm: new Date() } } : {}),
    });
  }));
  await Encontro.insertMany(encontros);

  // ── EBD (8 domingos, 3 classes) ──
  const porClasse = { Jovens: jovens, 'Adultos 1': sede.filter((p) => idadeDe(p) > 30 && idadeDe(p) <= 50).slice(0, 16), 'Adultos 2': sede.filter((p) => idadeDe(p) > 50).slice(0, 14) };
  const aulas = [];
  datasSemana.forEach((dom, s) => Object.entries(porClasse).forEach(([classe, lista]) => {
    if (!lista.length) return;
    aulas.push({ data: dom, classe, congregacao: 'Sede', tema: ['Fé que persevera', 'O bom pastor', 'Graça e verdade', 'Vida em comunhão', 'O fruto do Espírito', 'Servir com alegria', 'A oração que transforma', 'Esperança viva'][s], origem: 'whatsapp', ausenciasProcessadasEm: new Date(), presencas: lista.map((p) => ({ personId: p._id, nome: p.nome, presente: presente(p, s) })) });
  }));
  await EbdAula.insertMany(aulas);

  // ── Cuidado pastoral ──
  const alerta = (p, faltas, status, acoes) => ({ personId: p._id, nome: p.nome, celular: p.celular, congregacao: 'Sede', classe: 'União Feminina', origem: 'encontro', grupoId: grupos[0]._id, faltasConsecutivas: faltas, nivel: faltas >= 4 ? 'critico' : 'risco', status, acoes, ...(status === 'resolvido' ? { resolvidoEm: new Date(Date.now() - 3 * DIA) } : {}) });
  await CareAlert.insertMany([
    alerta(mulheres[7], 4, 'em_contato', [{ tipo: 'mensagem_ia', canal: 'whatsapp', descricao: 'Sentimos sua falta…', por: 'Assistente IA', em: new Date(Date.now() - 6 * DIA) }, { tipo: 'ligacao', canal: 'telefone', descricao: 'Mãe internada; pediu oração.', por: 'Pastor Demonstração', em: new Date(Date.now() - 2 * DIA) }]),
    alerta(jovens[8], 4, 'aberto', []),
    alerta(mulheres[12], 3, 'resolvido', [{ tipo: 'visita', canal: 'presencial', descricao: 'Visita feita; voltou no domingo.', por: 'Pastor Demonstração', em: new Date(Date.now() - 4 * DIA) }]),
  ]);

  // ── Jornada dos visitantes e novos convertidos ──
  const novos = docs.filter((p) => ['visitante', 'novo decidido'].includes(p.tipo));
  await Jornada.insertMany(novos.map((p, i) => {
    const inicio = p.dataVisita || p.dataDecisao;
    const dias = Math.floor((Date.now() - inicio) / DIA);
    return {
      personId: p._id, nome: p.nome, celular: p.celular, congregacao: p.congregacao, tipo: p.tipo, inicio, status: 'ativa',
      etapas: [3, 7, 14, 21, 30].map((d) => ({ chave: `d${d}`, dia: d, status: d <= dias ? 'enviada' : 'pendente', enviadaEm: d <= dias ? new Date(inicio.getTime() + d * DIA) : undefined })),
      retornou: i % 2 === 0, retornouEm: i % 2 === 0 ? new Date(Date.now() - DIA) : undefined, retornouOnde: i % 2 === 0 ? 'Culto de domingo' : undefined,
      respondeuEm: i === 1 ? new Date() : undefined,
    };
  }));

  // ── Oração, cultos, escalas, eventos, campanha ──
  const pedidos = ['Pela saúde da minha mãe, que fará uma cirurgia.', 'Agradecimento: consegui o emprego!', 'Pela restauração do meu casamento.', 'Pelos estudos dos meus filhos.', 'Pela viagem missionária da igreja.', 'Por paz na minha família.'];
  await PedidoOracao.insertMany(pedidos.map((texto, i) => ({ nome: docs[20 + i].nome, personId: docs[20 + i]._id, congregacao: 'Sede', texto, origem: i % 2 ? 'whatsapp' : 'web', status: i < 2 ? 'orado' : 'novo', oradoEm: i < 2 ? new Date() : undefined, oradoPor: i < 2 ? 'Pastor Demonstração' : undefined, confidencial: i === 2, intercessoresAvisados: i === 2 ? 0 : 7, createdAt: new Date(Date.now() - i * DIA) })));
  await Culto.insertMany(datasSemana.slice(0, 4).map((dom, s) => ({
    titulo: 'Culto de domingo', congregacao: 'Sede', data: dom, codigo: `DEM${s}${crypto.randomBytes(1).toString('hex').toUpperCase()}`.slice(0, 6), aberto: false,
    presencas: sede.slice(0, 26 + s * 2).filter(() => r() < 0.85).map((p) => ({ personId: p._id, nome: p.nome, via: 'qr', visitante: false, em: dom })),
  })));
  const proxDom = new Date(datasSemana[0].getTime() + 7 * DIA);
  const vocais = docs.filter((p) => p.ministerio);
  await Escala.insertMany([{
    ministerio: 'Louvor', evento: 'Culto de domingo', congregacao: 'Sede', data: proxDom, horario: '19:00', responsavelNome: lider.nome,
    itens: [
      { funcao: 'Vocal', ...ref(vocais[0]), status: 'confirmado', conviteEnviadoEm: new Date(), respondidoEm: new Date() },
      { funcao: 'Vocal', ...ref(vocais[1]), status: 'recusado', conviteEnviadoEm: new Date(), respondidoEm: new Date(), motivoRecusa: 'viagem a trabalho' },
      { funcao: 'Vocal', ...ref(vocais[2]), status: 'pendente', conviteEnviadoEm: new Date(), substituiu: vocais[1].nome },
      { funcao: 'Teclado', ...ref(vocais[3] || vocais[0]), status: 'confirmado', conviteEnviadoEm: new Date() },
    ],
  }]);
  await Evento.create({
    titulo: 'Retiro de Jovens', descricao: 'Três dias de Palavra, louvor e comunhão.', data: new Date(Date.now() + 20 * DIA), horario: '08:00', local: 'Sítio Bethel', congregacao: 'Sede',
    vagas: 40, valor: 120, codigo: 'RETIRO', inscricoes: jovens.slice(0, 12).map((p, i) => ({ personId: p._id, nome: p.nome, celular: p.celular, status: i < 5 ? 'pago' : 'inscrito', pagoEm: i < 5 ? new Date() : undefined })),
  });
  await Campanha.create({
    tipo: 'sermao', titulo: `Sermão de ${isoLocal(datasSemana[0]).split('-').reverse().join('/')}`, texto: 'Olá, {nome}! 👋\n\n*📖 O bom pastor*\n_Texto base: João 10:11_', status: 'concluida', concluidaEm: new Date(),
    publico: { descricao: 'toda a igreja' }, destinatarios: sede.slice(0, 40).map((p, i) => ({ personId: p._id, nome: p.nome, celular: p.celular, status: i === 7 ? 'bloqueado' : 'enviado', em: new Date() })),
    enviarApos: new Date(datasSemana[0].getTime() + DIA), criadoPorNome: lider.nome,
  });
  // Logs de mensagens do mês (alimentam o painel de impacto)
  const logs = [];
  for (let i = 0; i < 9; i += 1) logs.push({ tipo: 'aniversario', destinatarios: [{ nome: docs[i + 8].nome, celular: docs[i + 8].celular }], conteudo: '🎂', status: 'concluido', criadoEm: new Date(Date.now() - i * 2 * DIA) });
  for (let i = 0; i < 6; i += 1) logs.push({ tipo: 'ausencia', destinatarios: [{ nome: docs[i + 30].nome, celular: docs[i + 30].celular }], conteudo: '💛', status: 'concluido', criadoEm: new Date(Date.now() - i * 3 * DIA) });
  for (let i = 0; i < 10; i += 1) logs.push({ tipo: 'jornada', destinatarios: [{ nome: novos[i % novos.length].nome, celular: novos[i % novos.length].celular }], conteudo: '🌱', status: 'concluido', criadoEm: new Date(Date.now() - i * DIA) });
  await Message.insertMany(logs);
};

// Apaga SOMENTE os dados da igreja demo. Dupla proteção (incidente: Invoice e UsageCounter têm
// tenantId mas não usam o tenantPlugin, e um deleteMany({}) neles apagou dados de todas as igrejas):
//  1) só models que usam o tenantPlugin (escopo automático por igreja);
//  2) filtro explícito { tenantId } em todo deleteMany — nunca {}.
const limpar = async (tenantId) => {
  if (!tenantId) throw new Error('limpar demo: tenantId obrigatório');
  carregarModels();
  for (const nome of mongoose.modelNames()) {
    const model = mongoose.model(nome);
    const comEscopo = model.schema.plugins.some((p) => p.fn === tenantPlugin);
    if (!comEscopo) continue; // Invoice, UsageCounter, Tenant, PlatformUser: nunca tocar
    await model.deleteMany({ tenantId });
  }
};

let emAndamento = null;
// Cria ou recria a igreja demo quando não existe ou tem mais de 7 dias.
// Desligada por padrão: só com DEMO_ENABLED=true (e nunca no boot — só pelo endpoint público).
const garantirDemo = async ({ forcar = false } = {}) => {
  if (process.env.DEMO_ENABLED !== 'true') return null;
  if (emAndamento) return emAndamento;
  emAndamento = (async () => {
    carregarModels();
    let tenant = await runAsPlatform(() => Tenant.findOne({ slug: SLUG }).lean());
    // Uma igreja real com o slug "demo" (anterior à reserva do slug) jamais é tocada.
    if (tenant && !tenant.demo) {
      console.error('[DEMO] Já existe uma igreja real com o slug "demo": demonstração desativada para não tocar nos dados dela.');
      return null;
    }
    const fresca = tenant?.demoAtualizadoEm && Date.now() - new Date(tenant.demoAtualizadoEm).getTime() < REFAZER_APOS_MS;
    if (tenant && fresca && !forcar) return tenant;
    if (!tenant) {
      tenant = (await runAsPlatform(() => Tenant.create({
        nome: 'Igreja Demonstração', nomeCurto: 'Demonstração', slug: SLUG, demo: true, plano: 'multiplicar', status: 'ativa',
        billing: { isento: true, ciclo: 'mensal' }, congregacoes: ['Sede', 'Vila Esperança'], cidade: 'Salvador', uf: 'BA', email: 'demo@pastoria.com.br',
        // WhatsApp desligado de verdade: sem provider, sem fallback do .env (instância da IBBI), sem webhook
        whatsapp: { provider: 'none', useEnvFallback: false }, ia: { ativo: false, nomeAssistente: 'Barnabé' },
        automacoes: {
          aniversario: { ativo: false }, chamadaEbd: { ativo: false }, ausencia: { ativo: false },
          relatorioSemanal: { ativo: false }, jornada: { ativo: false, avisarLideranca: false },
        },
        onboarding: { concluido: true, concluidoEm: new Date(), origem: 'demo' }, termos: { versao: TERMOS_VERSAO, aceitoEm: new Date(), aceitoPor: 'Demonstração' },
        lideranca: [{ nome: 'Pastor Demonstração', papel: 'Pastor', celular: '00000000000' }],
        cultosProgramados: [{ titulo: 'Culto de domingo', diaSemana: 0, horario: '19:00', lembreteMin: 180, liveUrl: 'https://youtube.com/@pastoria', ativo: true }],
        pix: { chave: 'demo@pastoria.com.br', nome: 'Igreja Demonstracao', cidade: 'Salvador' },
      }))).toObject();
    }
    await runWithTenant(tenant, async () => {
      await limpar(tenant._id);
      await popular(tenant);
    });
    // Reforça a cada recriação: demo nunca envia mensagens nem cobra.
    await runAsPlatform(() => Tenant.updateOne({ _id: tenant._id }, {
      $set: {
        demoAtualizadoEm: new Date(), demo: true, status: 'ativa', 'billing.isento': true,
        'whatsapp.provider': 'none', 'whatsapp.useEnvFallback': false,
        'automacoes.aniversario.ativo': false, 'automacoes.chamadaEbd.ativo': false, 'automacoes.ausencia.ativo': false,
        'automacoes.relatorioSemanal.ativo': false, 'automacoes.jornada.ativo': false, 'ia.ativo': false,
      },
      $unset: { 'whatsapp.webhookToken': 1, 'whatsapp.evolution': 1, 'whatsapp.cloud': 1 },
    }));
    invalidateTenant(tenant._id);
    console.log('[DEMO] Igreja demonstração pronta.');
    return tenant;
  })().finally(() => { emAndamento = null; });
  return emAndamento;
};

module.exports = { SLUG, garantirDemo };
