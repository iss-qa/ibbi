const { generateText } = require('./ai/llm');

// Resumo do sermão: o pastor conta (texto ou áudio) e a IA organiza para a igreja.
// Só usa o que foi dito; sem relato suficiente, devolve o próprio texto.
const PUBLICO_TIPOS = ['membro', 'congregado', 'novo decidido', 'visitante'];

const organizarSermao = async (relato, { pregador, data } = {}) => {
  const texto = await generateText({
    system: [
      'Você transforma o relato de um pastor sobre o sermão de domingo em uma mensagem de WhatsApp para os membros da igreja (evangélica, Brasil).',
      'Use SOMENTE o que o pastor contou. Não invente versículos, histórias, nomes ou pontos que não foram ditos. Se ele citou uma referência bíblica, mantenha exatamente.',
      'Formato (omita a seção que não tiver conteúdo):',
      '*📖 Título do sermão* (curto)',
      '_Texto base: referência_',
      '*✨ O que aprendemos* com 2 a 4 marcadores "• "',
      '*🙌 Para viver nesta semana* (1 ou 2 frases práticas)',
      '*💭 Para refletir* com 2 ou 3 perguntas curtas',
      'Máximo de 1.100 caracteres. Tom pastoral, simples e caloroso, *negrito* do WhatsApp. Não cumprimente nem assine (isso é colocado depois).',
    ].join('\n'),
    prompt: `${pregador ? `Pregador: ${pregador}\n` : ''}${data ? `Data: ${data}\n` : ''}Relato do pastor:\n${relato}`,
    maxTokens: 900,
  }).catch(() => null);
  return (texto || relato).trim().slice(0, 3000);
};

module.exports = { organizarSermao, PUBLICO_TIPOS };
