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
const relatorioSemanal = async (dados) => {
  const texto = await generateText({
    system: `${baseSystem()}\nAgora você escreve para a LIDERANÇA (pastores e líderes), não para membros.`,
    prompt: [
      'Escreva o resumo semanal de engajamento da igreja para ser enviado no WhatsApp da liderança.',
      'Estrutura: título com 📊, frequência da EBD por classe (presentes/total e %), tendência vs semana anterior,',
      'lista "⚠️ Quem precisa de um telefonema" (nome, faltas seguidas, sugestão: mensagem/ligação/visita pastoral),',
      'retornos a celebrar 🎉, aniversariantes da semana e 1 recomendação prática. Máximo de 1500 caracteres.',
      `Dados (JSON): ${JSON.stringify(dados)}`,
    ].join('\n'),
    maxTokens: 3000,
  });
  return texto || templates.relatorioSemanalPadrao(dados);
};

module.exports = { mensagemAusente, resumoAula, relatorioSemanal };
