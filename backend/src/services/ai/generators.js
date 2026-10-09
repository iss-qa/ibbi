const { generateText } = require('./llm');
const templates = require('../../templates/messages.templates');
const { getTenant } = require('../../tenancy/context');
const { churchName } = require('../../tenancy/brand');

const baseSystem = () => {
  const tenant = getTenant();
  return [
    `Você escreve mensagens de WhatsApp em nome da ${churchName()}, uma igreja evangélica no Brasil.`,
    `Tom: ${tenant?.ia?.tom || 'pastoral, acolhedor e objetivo'}. Português do Brasil, frases curtas, no máximo 2 emojis.`,
    'Nunca invente fatos (datas, eventos, versículos citados de forma incorreta). Não use linguagem de cobrança ou culpa.',
    'Formatação do WhatsApp: *negrito* e _itálico_. Não use markdown de títulos nem listas longas.',
    'Responda somente com o texto final da mensagem, sem comentários antes ou depois.',
    tenant?.ia?.instrucoesExtras ? `Orientações da igreja: ${tenant.ia.instrucoesExtras}` : '',
  ].filter(Boolean).join('\n');
};

// Mensagem de "sentimos sua falta" personalizada. Fallback: template fixo.
const mensagemAusente = async ({ pessoa, aula, faltas, contexto }) => {
  const encontro = contexto?.origem === 'encontro';
  const prompt = [
    encontro
      ? `Escreva uma mensagem para um membro que faltou ao encontro do grupo "${contexto.label}" (${aula?.atividade || 'reunião'}).`
      : 'Escreva uma mensagem para um membro que faltou à Escola Bíblica Dominical (EBD).',
    encontro ? `Nome: ${pessoa.nome}.` : `Nome: ${pessoa.nome}. Classe: ${aula?.classe || 'não informada'}.`,
    `Faltas consecutivas: ${faltas}.`,
    aula?.data ? `Data da aula: ${new Date(aula.data).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: '2-digit' })} (não diga "hoje" — a mensagem pode ser enviada em outro dia; use "domingo" ou "no último domingo").` : '',
    aula?.tema ? `Tema da última aula: ${aula.tema}.` : '',
    aula?.descricao ? `Anotações do professor: ${aula.descricao}` : '',
    aula?.resumo ? `Resumo da aula: ${aula.resumo}` : '',
    'Se citar referência bíblica, copie exatamente como está nas anotações (livro, capítulo e versículos); não abrevie nem invente.',
    faltas >= 3
      ? 'A pessoa está afastada há algumas semanas: seja caloroso, pergunte se está tudo bem e ofereça oração/conversa, sem pressionar.'
      : `Foi uma falta pontual: mensagem leve, compartilhe em 1-2 frases o que foi ${encontro ? 'feito/estudado' : 'estudado'} e convide para o próximo ${encontro ? 'encontro' : 'domingo'}.`,
    'Termine assinando com o nome da igreja em itálico. Máximo de 600 caracteres.',
  ].filter(Boolean).join('\n');
  return (await generateText({ system: baseSystem(), prompt, maxTokens: 1500 }))
    || templates.ausenciaMembro(pessoa.nome, { tema: aula?.tema, faltas, onde: encontro ? `no encontro da ${contexto.label}` : null });
};

// Resumo curto da lição (a partir de tema/descrição) para compartilhar com ausentes.
const resumoAula = async (aula) => {
  if (!aula?.tema && !aula?.descricao) return null;
  return generateText({
    system: baseSystem(),
    prompt: `Resuma em até 3 frases, para quem não esteve presente, a lição da EBD.\nTema: ${aula.tema || ''}\nDescrição/anotações do professor: ${aula.descricao || ''}`,
    maxTokens: 800,
  });
};

// Relatório semanal para a liderança. `dados` já vem agregado pelo engagement.service.
// Sugestão sem IA (prévia nas configurações e reserva quando a IA falha).
const sugestaoPadrao = (d) => {
  if (d.alertas?.length) return `Divida os ${d.alertas.length} nomes de ⚠️ entre os líderes e façam os contatos até quarta-feira. Um telefonema faz toda a diferença.`;
  if (d.total && d.percentual < 60) return 'A presença está baixa: anuncie o tema do próximo domingo no culto e peça aos líderes de classe que convidem pessoalmente.';
  if (d.total) return 'Agradeça no próximo culto às classes com melhor presença: reconhecimento público anima a todos.';
  return 'Combine com os líderes de classe o registro da chamada no domingo para o relatório ficar completo.';
};

// Relatório semanal: estrutura fixa (template); a IA escreve só a sugestão da semana.
const relatorioSemanal = async (dados, { ia = true } = {}) => {
  let sugestao = null;
  if (ia) {
    sugestao = await generateText({
      system: `${baseSystem()}\nAgora você escreve para a LIDERANÇA (pastores e líderes), não para membros.`,
      prompt: [
        'Com base nos dados de frequência abaixo, escreva UMA recomendação prática para a liderança agir nesta semana.',
        'No máximo 2 frases (até 240 caracteres), sem saudação, sem título e sem listar os dados de novo.',
        `Dados (JSON): ${JSON.stringify(dados)}`,
      ].join('\n'),
      maxTokens: 300,
    }).catch(() => null);
  }
  const texto = String(sugestao || '').trim();
  return templates.relatorioSemanalLideranca(dados, texto && texto.length <= 400 ? texto : sugestaoPadrao(dados));
};

// Dados fictícios para mostrar o formato quando a igreja ainda não tem chamadas.
const EXEMPLO_RELATORIO = {
  periodo: '02/10/2026 a 09/10/2026', presentes: 156, total: 200, percentual: 78, percentualSemanaAnterior: 73,
  classes: [
    { classe: 'Adultos 1 (Sede)', presentes: 37, total: 40, percentual: 93 },
    { classe: 'Jovens (Sede)', presentes: 21, total: 28, percentual: 75 },
    { classe: 'Adolescentes (Periperi)', presentes: 9, total: 20, percentual: 45 },
  ],
  alertas: [
    { nome: 'Maria Souza', classe: 'Adultos 2', congregacao: 'Sede', faltasConsecutivas: 4 },
    { nome: 'João Lima', classe: 'Jovens', congregacao: 'Sede', faltasConsecutivas: 3 },
    { nome: 'Ana Costa', classe: 'Adolescentes', congregacao: 'Periperi', faltasConsecutivas: 2 },
  ],
  esfriando: ['Pedro Alves', 'Carla Dias'],
  retornos: ['Lucas Rocha'],
  aniversariantes: 5,
};
const relatorioSemanalPrevia = (dados) => {
  const vazio = !dados || (!dados.total && !dados.alertas?.length);
  const d = vazio ? EXEMPLO_RELATORIO : dados;
  return { texto: templates.relatorioSemanalLideranca(d, sugestaoPadrao(d)), origem: vazio ? 'exemplo' : 'dados' };
};

module.exports = { mensagemAusente, resumoAula, relatorioSemanal, relatorioSemanalPrevia };
