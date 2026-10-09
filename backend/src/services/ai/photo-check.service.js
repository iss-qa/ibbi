const { isAiConfigured, createMessage, textOf } = require('./llm');

// Confere se a foto do cadastro é uma foto real da pessoa (vai para a ficha, a carteirinha e o
// certificado) e não um card de "bom dia", flor, paisagem, desenho, print ou figurinha.
// Falha aberta: sem IA configurada, com erro ou recusa, a foto passa (nunca trava o cadastro).

const MOTIVOS = {
  sem_pessoa: 'A imagem não mostra uma pessoa. Envie uma foto sua, com o rosto aparecendo.',
  montagem_ou_texto: 'Parece um card, montagem ou imagem com mensagem. Envie uma foto real sua, sem textos ou enfeites.',
  desenho_ou_ilustracao: 'Parece um desenho, avatar ou figurinha. Envie uma foto real sua.',
  print_de_tela: 'Parece um print de tela. Envie a foto original, tirada com a câmera.',
  varias_pessoas: 'A foto tem várias pessoas. Envie uma foto só sua, para identificarmos você.',
  rosto_nao_visivel: 'Não dá para ver o rosto. Envie uma foto de frente, com o rosto visível e boa luz.',
};

const SCHEMA = {
  type: 'object',
  properties: {
    aprovada: { type: 'boolean' },
    motivo: { type: 'string', enum: ['ok', ...Object.keys(MOTIVOS)] },
  },
  required: ['aprovada', 'motivo'],
  additionalProperties: false,
};

const SYSTEM = `Você valida a foto de cadastro de uma pessoa numa igreja. A foto vai para a ficha de membro e a carteirinha, então precisa ser uma FOTOGRAFIA REAL da própria pessoa.

Aprove (aprovada: true, motivo "ok"):
- selfie ou retrato de uma pessoa real, de qualquer idade, com o rosto visível (mesmo que a foto esteja simples, um pouco escura, com fundo bagunçado, de perfil leve ou com óculos);
- foto com outras pessoas ao fundo, desde que uma pessoa esteja claramente em destaque.

Recuse (aprovada: false) e escolha o motivo:
- "montagem_ou_texto": cards de bom dia/boa noite, mensagens, versículos, molduras, colagens, imagens com texto sobreposto;
- "sem_pessoa": flores, paisagens, objetos, animais, logotipos, imagens sem pessoa;
- "desenho_ou_ilustracao": desenho, caricatura, avatar, figurinha, imagem gerada com aparência artificial;
- "print_de_tela": captura de tela de celular ou computador;
- "varias_pessoas": duas ou mais pessoas com o mesmo destaque, sem dar para saber quem é o cadastrado;
- "rosto_nao_visivel": pessoa de costas, rosto coberto, muito distante, borrado ou escuro a ponto de não reconhecer.

Na dúvida entre aprovar e recusar uma foto real de pessoa, aprove. Responda só com o JSON: {"aprovada": boolean, "motivo": string}.`;

// Gemini não aplica o schema: pega o primeiro objeto JSON do texto.
const parseResultado = (texto) => {
  const match = String(texto || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const out = JSON.parse(match[0]);
    return typeof out.aprovada === 'boolean' ? out : null;
  } catch {
    return null;
  }
};

/**
 * @returns {Promise<{ verificada: boolean, aprovada: boolean, motivo?: string, mensagem?: string }>}
 */
const checkPersonPhoto = async ({ base64, mimetype }) => {
  if (process.env.PHOTO_CHECK_DISABLED === 'true' || !isAiConfigured()) return { verificada: false, aprovada: true };
  try {
    const response = await createMessage({
      max_tokens: 2048,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimetype, data: base64 } },
          { type: 'text', text: 'Esta foto serve para o cadastro?' },
        ],
      }],
    }, { countInteraction: false }); // conta tokens/custo da igreja, mas não gasta interação do plano
    if (response.stop_reason === 'refusal') return { verificada: false, aprovada: true };

    const resultado = parseResultado(textOf(response));
    if (!resultado) return { verificada: false, aprovada: true };
    if (resultado.aprovada) return { verificada: true, aprovada: true, motivo: 'ok' };
    const motivo = MOTIVOS[resultado.motivo] ? resultado.motivo : 'sem_pessoa';
    return { verificada: true, aprovada: false, motivo, mensagem: MOTIVOS[motivo] };
  } catch (err) {
    console.error('[FOTO] Verificação indisponível, foto aceita:', err.message);
    return { verificada: false, aprovada: true };
  }
};

module.exports = { checkPersonPhoto, MOTIVOS };
