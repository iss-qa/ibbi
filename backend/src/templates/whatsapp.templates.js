const { churchName, churchShort } = require('../tenancy/brand');
const { getTenant } = require('../tenancy/context');
const { DEFAULT_TENANT_SLUG } = require('../tenancy/tenant.service');

// Programação semanal da igreja do contexto. O texto padrão (argumento) é o da IBBI
// e só é usado para o tenant fundador; demais igrejas usam Tenant.programacaoSemanal.
const programacao = (padraoIbbi) => {
  const tenant = getTenant();
  if (tenant?.programacaoSemanal) return `📅 *Nossa Programação Semanal:*\n\n${tenant.programacaoSemanal}`;
  if (!tenant || tenant.slug === DEFAULT_TENANT_SLUG()) return padraoIbbi;
  return '';
};
const formatDate = (date) => {
  if (!date) return 'Não informada';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const boasVindasNovoDecidido = (nome, congregacao) =>
  `Shalom, ${nome}! 🙏

*Bem-vindo(a) à família de Deus!*

Que alegria imensa ter você tomando essa decisão tão importante — aceitar Jesus Cristo como seu Senhor e Salvador é o passo mais transformador da vida!

_"Portanto, se alguém está em Cristo, é nova criatura. As coisas antigas já passaram; eis que surgiram coisas novas."_
— 2 Coríntios 5:17

Queremos que você saiba que não está sozinho(a) nessa caminhada. A *${churchName()}* estará ao seu lado a cada passo!

${programacao(`📅 *Nossa Programação Semanal:*

🟡 *Domingo — 08h45 | EBD (Escola Bíblica Dominical)*
Aulas de ensino bíblico em grupos por faixa etária. É o momento de crescer no conhecimento da Palavra de Deus de forma prática e profunda. Venha aprender!

🟡 *Domingo — 19h00 | Culto de Louvor e Adoração*
Nosso culto dominical noturno, cheio de adoração, pregação da Palavra e comunhão.

🟡 *Terça-feira — 19h30 | Culto de Oração*
Um momento especial para buscar a Deus em oração, interceder uns pelos outros e fortalecer a fé. A oração move o coração de Deus!

🟡 *Quarta-feira — Reuniões das Uniões*
Encontros dos grupos: Jovens, Adolescentes, União Masculina, União Feminina e outros ministérios. Um espaço de comunhão, crescimento e missão junto com pessoas da sua faixa etária e interesses.

🟡 *Quinta-feira — 19h30 | Culto de Adoração*
Culto especial de adoração e edificação, com louvor e Palavra para fortalecer sua vida espiritual durante a semana.`)}

📍 *Congregação:* ${congregacao}

Você é muito especial para nós! Em breve, alguém de nossa equipe entrará em contato para apresentar nossa família e caminhar junto com você. 💛

_Que Deus te abençoe grandemente!_
*${churchName()} — ${churchShort()}* 🕊️`;

const notificacaoTriagemNovoDecidido = (decidido) =>
  `🕊️ *Shalom, amados!*

Segue um *Novo Decidido* para o cuidado pastoral:

*${decidido.nome}*
📅 Decisão: ${formatDate(decidido.dataDecisao)}
⚤ Sexo: ${decidido.sexo || 'Não informado'}
📱 Celular: ${decidido.celular || 'Não informado'}
🏛️ Congregação: ${decidido.congregacao || 'Não informada'}

---
🤝 *Projeto Amigo — ${churchShort()}*

✅ _Ligue para ele(a) e apresente-se_
✅ _Agende um acompanhamento ou visita_
✅ _Convide para o próximo culto_
✅ _Ore por essa pessoa pelo nome_

_"Assim, quem plantar e quem regar são um só; mas cada um receberá a sua recompensa segundo o seu trabalho."_ — 1 Co 3:8

*${churchName()} — ${churchShort()}* 🕊️`;

const boasVindasVisitante = (nome, congregacao) =>
  `Shalom, ${nome}! 😊

*Que alegria ter você conosco!*

Foi uma honra receber sua visita à *${churchName()}*! Esperamos que você tenha se sentido em casa, pois aqui você é sempre bem-vindo(a)!

_"Porque onde dois ou três estiverem reunidos em meu nome, ali estou no meio deles."_
— Mateus 18:20

Gostaríamos de te convidar para fazer parte da nossa programação:

${programacao(`📅 *Nossa Programação Semanal:*

🟡 *Domingo — 08h45 | EBD (Escola Bíblica Dominical)*
🟡 *Domingo — 19h00 | Culto de Louvor e Adoração*
🟡 *Terça-feira — 19h30 | Culto de Oração*
🟡 *Quarta-feira — Reuniões das Uniões*
🟡 *Quinta-feira — 19h30 | Culto de Adoração*`)}

📍 *Congregação:* ${congregacao}

Você fez nossa família ainda mais completa com sua presença! Esperamos você novamente em breve. 🤗

_Deus te abençoe com abundância!_
*${churchName()} — ${churchShort()}* 🕊️`;

const notificacaoTriagemVisitante = (visitante) =>
  `🕊️ *Shalom, amados!*

Segue um *Visitante* para o cuidado pastoral:

*${visitante.nome}*
📅 Visita: ${formatDate(visitante.dataVisita)}
⚤ Sexo: ${visitante.sexo || 'Não informado'}
📱 Celular: ${visitante.celular || 'Não informado'}
🏛️ Congregação: ${visitante.congregacao || 'Não informada'}

---
🤝 *Projeto Amigo — ${churchShort()}*

✅ _Ligue para ele(a) e agradeça a visita_
✅ _Convide para o próximo culto_
✅ _Apresente a programação da igreja_
✅ _Ore por essa pessoa pelo nome_

_"Acolhei uns aos outros, como também Cristo nos acolheu, para a glória de Deus."_ — Romanos 15:7

*${churchName()} — ${churchShort()}* 🕊️`;

module.exports = {
  boasVindasNovoDecidido,
  notificacaoTriagemNovoDecidido,
  boasVindasVisitante,
  notificacaoTriagemVisitante,
};

// Boas-vindas são o primeiro contato proativo: avisam como deixar de receber mensagens.
const RODAPE_SAIR = '\n\n_Para não receber mais mensagens, responda SAIR._';
['boasVindasNovoDecidido', 'boasVindasVisitante'].forEach((k) => {
  const original = module.exports[k];
  module.exports[k] = (...args) => `${original(...args)}${RODAPE_SAIR}`;
});
