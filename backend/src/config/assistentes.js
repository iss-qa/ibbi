// Catálogo de nomes para o assistente de IA de cada igreja (Tenant.ia.nomeAssistente).
// Cada nome tem uma apresentação com referência bíblica, usada no menu do WhatsApp e no prompt.
// Nome fora do catálogo: apresentação genérica com Lucas 15:4.

const ASSISTENTE_PADRAO = 'Barnabé';

const ASSISTENTES = {
  'Barnabé': {
    genero: 'm',
    significado: 'filho da consolação',
    apresentacao: 'acolhi Paulo quando todos tinham medo dele e fui buscar quem estava de fora (At 4:36; 9:27)',
  },
  'Eliézer': {
    genero: 'm',
    significado: 'Deus é o meu auxílio',
    apresentacao: 'fui o servo fiel que Abraão enviou em missão, orando por direção a cada passo (Gn 24)',
  },
  Ana: {
    genero: 'f',
    significado: 'graça',
    apresentacao: 'derramei meu coração em oração no templo e vi Deus responder (1Sm 1:10-20)',
  },
  Tabita: {
    genero: 'f',
    significado: 'gazela',
    apresentacao: 'era conhecida pelas boas obras e por cuidar de quem precisava (At 9:36)',
  },
  Priscila: {
    genero: 'f',
    significado: 'a venerável',
    apresentacao: 'abri minha casa para a igreja e ajudei a discipular quem chegava (At 18:26; Rm 16:3-5)',
  },
  'Timóteo': {
    genero: 'm',
    significado: 'aquele que honra a Deus',
    apresentacao: 'fui o discípulo que cuidava sinceramente das igrejas (Fp 2:20)',
  },
  Silas: {
    genero: 'm',
    significado: 'da floresta',
    apresentacao: 'fui companheiro fiel de Paulo e cantei louvores até na prisão (At 15:40; 16:25)',
  },
  'Lídia': {
    genero: 'f',
    significado: 'da Lídia',
    apresentacao: 'tive o coração aberto pelo Senhor e acolhi os irmãos em minha casa (At 16:14-15)',
  },
  'Débora': {
    genero: 'f',
    significado: 'abelha',
    apresentacao: 'liderei o povo com sabedoria e coragem em tempos difíceis (Jz 4:4-5)',
  },
  'Josué': {
    genero: 'm',
    significado: 'o Senhor é salvação',
    apresentacao: 'conduzi o povo adiante, sem deixar ninguém para trás (Js 1:9)',
  },
};

const normalize = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const assistenteInfo = (nome) => {
  const chave = Object.keys(ASSISTENTES).find((k) => normalize(k) === normalize(nome));
  if (chave) return { nome: chave, ...ASSISTENTES[chave] };
  return {
    nome: String(nome || ASSISTENTE_PADRAO).trim() || ASSISTENTE_PADRAO,
    genero: null,
    significado: null,
    apresentacao: 'estou aqui para ajudar a cuidar de cada ovelha, como o pastor que deixa as noventa e nove para buscar a que se perdeu (Lc 15:4)',
  };
};

// "Olá, Isaias! Sou *Barnabé*: acolhi Paulo… Aqui no PastorIA sou o seu assistente na IBBI…"
const saudacaoAssistente = ({ nomeUsuario, assistente, igreja, produto }) => {
  const info = assistenteInfo(assistente);
  const artigo = info.genero === 'f' ? 'a sua assistente' : info.genero === 'm' ? 'o seu assistente' : 'quem vai te ajudar';
  const primeiro = String(nomeUsuario || '').trim().split(/\s+/)[0];
  return `Olá${primeiro ? `, ${primeiro}` : ''}! Sou *${info.nome}*: ${info.apresentacao}. Aqui no *${produto}*, sou ${artigo} na ${igreja}. Conte comigo para acolher, cuidar e trazer de volta a ovelha que se afastou. 🙌`;
};

module.exports = { ASSISTENTE_PADRAO, ASSISTENTES, assistenteInfo, saudacaoAssistente };
