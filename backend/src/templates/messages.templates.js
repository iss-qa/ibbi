const { churchName, churchShort, portalUrl } = require('../tenancy/brand');

// Nome da plataforma (produto) usado pelo assistente.
const PRODUTO = process.env.PRODUCT_NAME || 'PastorIA';
const { saudacaoAssistente } = require('../config/assistentes');
const { getTenant } = require('../tenancy/context');

const firstName = (nome) => String(nome || '').trim().split(/\s+/)[0] || '';
// Áudio e foto dependem do plano (feature multimodal): os textos só oferecem o que a igreja tem.
const temMidia = () => { const { hasFeature } = require('../config/plans'); return hasFeature(getTenant(), 'multimodal'); };
const ouAudio = () => (temMidia() ? ' ou áudio' : '');
const barra = (pct) => { const n = Math.round((pct || 0) / 10); return '🟩'.repeat(n) + '⬜'.repeat(10 - n); };
const nivelIcone = (nivel) => ({ critico: '🚨', risco: '🔴', atencao: '🟡', esfriando: '📉' }[nivel] || '⚪');
const avaliacaoCurta = (pct) => (pct >= 90 ? '👏' : pct >= 70 ? '🙌' : pct >= 50 ? '🟡' : '⚠️');
// Juízo de valor da presença: elogio quando cheia, preocupação em negrito quando baixa.
const avaliacaoPresenca = (pct) => {
  if (pct >= 90) return '👏 *Parabéns!* Presença excelente. Este grupo está sendo uma bênção para a igreja!';
  if (pct >= 75) return '🙌 Boa presença, continuem firmes!';
  if (pct >= 50) return '🟡 _Atenção:_ quase metade faltou. Vale um contato com os ausentes.';
  return `⚠️ *Presença muito baixa (${pct}%). Isso preocupa: é hora de ligar para cada ausente esta semana.*`;
};
const linhaRelatorio = (r) => `• *${r.nome}*${r.detalhe ? ` · ${r.detalhe}` : ''}: ${r.presentes}/${r.total} (${r.pct}%)${r.tema ? `\n  _Tema: ${r.tema}_` : ''}\n  ${avaliacaoPresenca(r.pct)}${r.ausentes?.length ? `\n  Ausentes: ${r.ausentes.slice(0, 8).join(', ')}${r.ausentes.length > 8 ? ` e mais ${r.ausentes.length - 8}` : ''}` : ''}`;
const lista = (itens) => itens.map((i) => `• ${i}`).join('\n');
module.exports = {
  avaliacaoPresenca,
  aniversario: (nome) => `🎂 *Feliz Aniversário, ${nome}!*\n\n_"Ensina-nos a contar os nossos dias..."_ (Sl 90:12)\n\nQue o Senhor continue a guiar seus passos! 🙏\n_${churchName()}_`,

  aviso: (nome, texto) => `📢 *Aviso ${churchShort()}*\n\nOlá, ${nome}!\n\n${texto}\n\n_${churchName()}_`,

  reuniao: (nome, data, local) => `📅 *Convite para Reunião*\n\nOlá, ${nome}!\n\nVocê está convidado(a) para nossa reunião:\n📆 Data: ${data}\n📍 Local: ${local}\n\nContamos com sua presença! 🙏\n_${churchName()}_`,

  pedidoOracao: (remetente, mensagem, congregacao) => `🙏 *Pedido de Oração*\n\nDe: *${remetente}${congregacao ? ` - ${congregacao}` : ''}*\n\n${mensagem}\n\n_Recebido pelo sistema IBBI_`,

  aniversarioCasamento: (nome, anos) => `💍 *Feliz aniversário de casamento, ${firstName(nome)}!*\n\n${anos ? `Hoje completam *${anos} ${anos === 1 ? 'ano' : 'anos'}* de aliança diante de Deus. ` : ''}Celebramos com vocês essa história de amor e fidelidade!\n\n_"Assim, já não são dois, mas uma só carne. Portanto, o que Deus ajuntou não o separe o homem."_ (Mt 19:6)\n\nQue o Senhor continue edificando o seu lar. 🙏\n_${churchName()}_`,

  aniversarioBatismo: (nome, anos) => `🕊️ *Feliz aniversário de batismo, ${firstName(nome)}!*\n\n${anos ? `Há *${anos} ${anos === 1 ? 'ano' : 'anos'}* você desceu às águas e declarou publicamente a sua fé em Cristo. ` : ''}Que alegria caminhar com você!\n\n_"Fomos, pois, sepultados com ele pelo batismo na morte, para que... andemos nós também em novidade de vida."_ (Rm 6:4)\n\nSiga firme! 🙌\n_${churchName()}_`,

  personalizada: (nome, texto) => `Olá, ${nome}!\n\n${texto}\n\n_${churchName()}_`,

  boasVindasCadastroPendente: () => `🙏 Bem-vindo(a) à Comunidade ${churchShort()}!

Que alegria ter você conosco! Recebemos seu cadastro e nossa secretaria fará a validação das informações com carinho.

Assim que a aprovação for concluída, enviaremos por aqui seus dados de acesso ao portal.

Qualquer dúvida, estamos aqui! 💙`,

  acessoCadastroLiberado: (userLogin, defaultPassword) => `🙏 Bem-vindo(a) à Comunidade ${churchShort()}!
Que alegria ter você conosco! Seus dados foram aprovados, aqui está seu acesso:
🔗 Portal: ${portalUrl()}/login
👤 Usuário: ${userLogin}
🔑 Senha: ${defaultPassword}

Através do portal você pode:
✅ Realizar seu pedido de oração
✏️ Atualizar seus dados cadastrais, obter carteirinha de membro, certificado de batismo e muito mais
Qualquer dúvida, estamos aqui! 💙`,

  acessoCadastroImediato: (userLogin, defaultPassword) => `🙏 Bem-vindo(a) à Comunidade ${churchShort()}!
Que alegria ter você conosco! Seus dados de acesso estão prontos:
🔗 Portal: ${portalUrl()}/login
👤 Usuário: ${userLogin}
🔑 Senha: ${defaultPassword}

Através do portal você pode:
✅ Realizar seu pedido de oração
✏️ Atualizar seus dados cadastrais, obter carteirinha de membro, certificado de batismo e muito mais
Qualquer dúvida, estamos aqui! 💙`,

  // ── Engajamento / IA (fallbacks quando a IA não está disponível) ──────────

  ausenciaMembro: (nome, { tema, faltas, onde } = {}) => `Oi, ${firstName(nome)}! 💛\n\nSentimos a sua falta ${onde || 'na EBD'}${faltas > 1 ? ' nas últimas semanas' : ''}!${tema ? `\nEstudamos sobre *${tema}*.` : ''}\n\nEstá tudo bem com você? Se quiser conversar ou precisar de oração, é só responder esta mensagem. 🙏\n\n${onde ? 'Esperamos você no próximo encontro!' : 'Domingo que vem esperamos você!'}\n_${churchName()}_`,

  liderancaAniversarios: (pessoas) => `🎂 *Aniversariantes de hoje — ${churchShort()}*\n\n${lista(pessoas.map((p) => `${p.nome}${p.congregacao ? ` (${p.congregacao})` : ''} — ${p.canais}`))}\n\nAs felicitações já foram enviadas automaticamente. Que tal mandar também uma palavra pessoal? 🙏`,

  liderancaAlertaAusencia: ({ nome, classe, congregacao, faltas, celular, motivo, unidade = 'domingos', onde = 'na EBD' }) => `⚠️ *Alerta de cuidado pastoral*\n\n*${nome}*${classe ? ` — ${classe}` : ''}${congregacao ? ` (${congregacao})` : ''}\nFaltou *${faltas} ${unidade} seguidos* ${onde}.${motivo ? `\nMotivo informado: _${motivo}_` : ''}\n${celular ? `📱 ${celular}\n` : ''}\nSugestão: uma ligação ou visita pastoral esta semana. Responda aqui com "liguei para ${firstName(nome)}" ou "visitei ${firstName(nome)}" para registrar.`,

  aprovacaoAusentes: (itens) => `📋 *Ausentes na EBD — mensagens prontas para envio*\n\n${itens.map((i, idx) => `*${idx + 1}. ${i.nome}* (${i.faltas}ª falta seguida)\n_${i.mensagem.split('\n')[0]}..._`).join('\n\n')}\n\nResponda *enviar* para mandar todas, *enviar 1 3* para escolher, ou *não enviar*.`,

  convocacaoChamadaEbd: (lider, classe, data, roster) => `Olá, ${firstName(lider)}! Tudo bem? 🙌\nVamos registrar a frequência da EBD de hoje (*${classe}* — ${data})?\n\n${roster.map((p, i) => `${i + 1}. ${p.nome}`).join('\n')}\n\nResponda com os *números* ou *nomes* de quem veio (ex.: "1 3 5"), ou mande um *áudio*. Visitantes: "visitante Samuel, 22 anos".`,

  retornoMembro: (nome, classe) => `🎉 *${nome}* voltou${classe ? ` (${classe})` : ''}! Obrigado pelo cuidado de vocês. 🙏`,

  convocacaoChamadaEncontro: (lider, grupo, data, roster) => `Olá, ${firstName(lider)}! 🙌\nComo foi o encontro da *${grupo}* hoje (${data})? Vamos registrar a frequência?\n\n${roster.map((p, i) => `${i + 1}. ${p.nome}`).join('\n')}\n\nResponda com os *números* ou *nomes* de quem veio (ex.: "1 3 5"), ou mande um *áudio*. Se quiser, diga também a atividade (culto, ensaio…) e o tema.`,

  relatorioSemanalPadrao: ({ periodo, presentes, total, percentual, alertas, aniversariantes }) => `📊 *Resumo semanal — ${churchShort()}*\n_${periodo}_\n\n• EBD: ${presentes}/${total} presenças (${percentual}%)\n• Membros em alerta: ${alertas.length}${alertas.length ? `\n${lista(alertas.slice(0, 10).map((a) => `${a.nome} — ${a.faltasConsecutivas} faltas`))}` : ''}\n• Aniversariantes da semana: ${aniversariantes}\n\nAcesse o painel para mais detalhes: ${portalUrl()}`,

  menuLider: (nome, assistente) => `${saudacaoAssistente({ nomeUsuario: nome, assistente, igreja: churchShort(), produto: PRODUTO })}\n\n*O que você quer fazer?*\n\n👥 *Pessoas*\n1️⃣ Pesquisar pessoa\n2️⃣ Cadastrar pessoa\n3️⃣ Editar dados de uma pessoa\n\n📋 *Encontros*\n4️⃣ Registrar presença (EBD ou uniões)\n5️⃣ Resumir um encontro (enviar aos membros)\n\n💛 *Cuidado*\n6️⃣ Grupos: frequência, ausentes e números\n7️⃣ Quem está faltando (ligar, visitar, orar)\n8️⃣ Enviar aviso para um grupo\n9️⃣ Aniversariantes\n🔟 Relatório da semana\n1️⃣1️⃣ Pedidos de oração\n1️⃣2️⃣ Visitantes e novos convertidos (jornada)\n\n🙋 *Serviço*\n1️⃣3️⃣ Escalas de voluntários\n\n_Criar ou editar grupos e adicionar ou remover membros: pela plataforma web._\n\nResponda com o *número* ou escreva do seu jeito.${temMidia() ? ' Também entendo *áudio* e *foto* de ficha.' : ''} Digite *menu* a qualquer momento.`,

  // ── Fluxos guiados do líder (menu numerado) ──────────────────────────
  opcoesNumeradas: (titulo, itens, rodape = '') => `${titulo}\n\n${itens.map((t, i) => `${i + 1}. ${t}`).join('\n')}${rodape ? `\n\n${rodape}` : ''}\n\n_Responda com o número. *menu* para voltar._`,

  pesquisarPessoaPergunta: () => `Qual é o *nome* (ou parte do nome) da pessoa? Pode mandar por texto${ouAudio()}. 🔎`,
  pesquisaSemResultado: (termo) => `Não encontrei ninguém com "${termo}". Confira a grafia ou mande só o primeiro nome. 🔎`,
  pesquisaVarios: (termo, pessoas) => `Encontrei *${pessoas.length}* pessoas com "${termo}":\n\n${pessoas.map((p, i) => `${i + 1}. ${p.nome}${p.congregacao ? ` — ${p.congregacao}` : ''}`).join('\n')}\n\n_Responda com o número para ver a ficha._`,

  fichaPessoa: (f) => [
    `👤 *${f.nome}*`,
    '',
    `• *Status:* ${f.status}${f.tipo ? ` (${f.tipo})` : ''}`,
    `• *Congregação:* ${f.congregacao || '—'}`,
    `• *Idade:* ${f.idade != null ? `${f.idade} anos` : '—'}${f.nascimento ? ` (${f.nascimento})` : ''}`,
    f.sexo ? `• *Sexo:* ${f.sexo}` : null,
    `• *Faixa etária:* ${f.grupo || '—'}`,
    f.estadoCivil ? `• *Estado civil:* ${f.estadoCivil}` : null,
    `• *Batizado:* ${f.batizado ? `sim${f.dataBatismo ? `, desde ${f.dataBatismo}` : ''}` : 'não'}`,
    `• *Grupos/uniões:* ${f.grupos?.length ? f.grupos.join(', ') : 'nenhum'}`,
    f.ministerio ? `• *Ministério:* ${f.ministerio}` : null,
    `• *WhatsApp:* ${f.celular || '—'}`,
    f.email ? `• *Email:* ${f.email}` : null,
    `• *Endereço:* ${f.endereco || '—'}`,
    f.foto ? null : '• *Foto:* sem foto (envie uma aqui para cadastrar)',
    '',
    '*O que deseja fazer?*',
    '1. Editar dados',
    '2. Registrar cuidado (ligação, visita, oração)',
    '3. Enviar mensagem',
    '4. Atualizar a foto',
    '',
    '_Responda com o número. *menu* para voltar._',
  ].filter((l) => l !== null).join('\n'),
  pedirFotoPessoa: (nome) => `Envie agora a *foto* de ${firstName(nome)} (de rosto, bem iluminada) que eu atualizo o cadastro. 📷`,
  fotoAtualizada: (nome) => `✅ Foto de *${nome}* atualizada no cadastro.`,

  presencaTipo: () => '📋 *Registrar presença*\n\nOnde foi o encontro?\n\n1. EBD (Escola Bíblica Dominical)\n2. Uniões e grupos\n3. Culto (check-in por QR Code)\n\n_Responda com o número. *menu* para voltar._',

  listaChamada: ({ titulo, data, lista, visitante = true }) => `${titulo} — *${data}*\n\n${lista.join('\n')}\n\nResponda com os *números* de quem estava *presente* (ex.: 1 3 5), os *nomes*${temMidia() ? ' ou um *áudio*' : ''}. Se preferir, diga quem *faltou*.${visitante ? '\n\n🙋 _Teve visitante? Mande o nome, a idade e o sexo (ex.: "visitante Samuel, 22 anos, masculino") que eu cadastro e já marco a presença._' : ''}`,

  grupoSubmenu: (grupo) => `🏷️ *${grupo.nome}*${grupo.congregacao ? ` (${grupo.congregacao})` : ''}\n${grupo.dia ? `🗓️ ${grupo.dia}${grupo.horario ? ` às ${grupo.horario}` : ''} · ` : ''}👥 ${grupo.membros} membros\n\n1. Novo encontro: registrar presença de hoje\n2. Encontros anteriores\n3. Resumir um encontro\n\n_Responda com o número. *menu* para voltar._`,

  encontrosAnteriores: (grupo, itens) => (itens.length
    ? `🗓️ *Encontros anteriores — ${grupo}*\n\n${itens.map((e, i) => `${i + 1}. ${e.data} · ${e.atividade} · ${e.presentes}/${e.total} presentes${e.resumo ? ' · 📝' : ''}`).join('\n')}\n\n_Responda com o número para ver os detalhes. 📝 = já tem resumo._`
    : `Ainda não há encontros registrados para *${grupo}*. Responda *1* para registrar o de hoje.`),

  encontroDetalhe: (e) => `🗓️ *${e.grupo}* — ${e.data} (${e.atividade})${e.tema ? `\nTema: _${e.tema}_` : ''}\n\n✅ *Presentes (${e.presentes.length}):* ${e.presentes.join(', ') || '—'}\n❌ *Ausentes (${e.ausentes.length}):* ${e.ausentes.join(', ') || '—'}${e.resumo ? `\n\n📝 *Resumo* (${e.resumoStatus}):\n${e.resumo}` : ''}\n\n1. Corrigir a presença\n2. ${e.resumo ? 'Refazer o resumo' : 'Resumir este encontro'}\n\n_Responda com o número. *menu* para voltar._`,

  gruposEscolher: (titulo, grupos) => `${titulo}\n\n${grupos.map((g, i) => `${i + 1}. *${g.nome}* (${g.congregacao})${g.dia ? `\n    🗓️ ${g.dia}${g.horario ? ` às ${g.horario}` : ''} · 👥 ${g.membros} membros` : ''}`).join('\n')}\n\n_Responda com o número. *menu* para voltar._`,

  grupoMembros: ({ grupo, congregacao, dia, horario, lideres, membros, criticos }) => `🏷️ *${grupo}* (${congregacao})\n${dia ? `🗓️ ${dia}${horario ? ` às ${horario}` : ''}\n` : ''}${lideres?.length ? `👤 Líder: ${lideres.join(', ')}\n` : ''}\n👥 *Membros (${membros.length})*\n${membros.map((m, i) => `${i + 1}. ${m}`).join('\n') || '—'}${criticos.length ? `\n\n⚠️ *Precisam de cuidado* (faltas seguidas neste grupo)\n${criticos.map((c) => `• *${c.nome}*: ${c.faltas} faltas seguidas · última presença ${c.ultima}`).join('\n')}` : '\n\n💚 Ninguém com faltas seguidas neste grupo.'}\n\n2. Frequência · 3. Ausentes 3+ · 4. Números\n_Adicionar ou remover membros: pela plataforma web. *menu* para voltar._`,

  resumoPedirRelato: (grupo, data) => `📝 *Resumo do encontro — ${grupo}* (${data})\n\nConte como foi, por *texto*${temMidia() ? ' ou *áudio de até 2 minutos*' : ''}: a pauta, o que foi ministrado, o que ficou decidido, próximos passos e avisos.\n\nEu organizo o texto, você aprova, e *1 hora depois* ele é enviado aos membros do grupo. 🙌`,
  resumoAudioLongo: (seg) => `O áudio tem ${Math.round(seg / 60)} min. Para o resumo, mande um áudio de *até 2 minutos* (ou o texto). 🙏`,
  resumoPrevia: (texto, destinatarios) => `Assim ficará o resumo que os membros vão receber:\n\n────────────\n${texto}\n────────────\n\n1. ✅ Aprovar (enviar em 1 hora para ${destinatarios} membro(s))\n2. ✏️ Refazer (mande outro texto ou áudio)\n3. ❌ Cancelar`,
  resumoAgendado: (grupo, hora, destinatarios) => `✅ Resumo de *${grupo}* agendado para *${hora}*: ${destinatarios} membro(s), em ordem aleatória e com intervalo entre as mensagens (proteção contra bloqueio).\n\nPara cancelar antes disso, abra o encontro em *4 → Uniões → Encontros anteriores*.`,
  resumoSemEncontro: (grupo) => `Ainda não há encontro registrado para *${grupo}*. Registre a presença primeiro (opção *4*) e depois faça o resumo. 🙏`,
  resumoMembro: (nome, { grupo, data, texto }) => `Olá, ${firstName(nome)}! 👋\n\n📝 *Resumo do encontro — ${grupo}* (${data})\n\n${texto}\n\n_${churchName()}_`,

  midiaForaDoPlano: (plano) => `🎙️ Áudio e foto não estão disponíveis no plano *${plano}* da sua igreja. No plano *Multiplicar* eu ouço áudios e leio fotos de fichas. A administração pode fazer o upgrade na plataforma, em *Assinatura*.\n\nPor enquanto, me mande por *texto*. 🙏`,
  midiaSoTexto: () => 'Por aqui consigo ler apenas mensagens de texto. Pode escrever para mim? 🙏',

  // ── Cuidado: grupos ──────────────────────────────────────────────────
  grupoCuidadoMenu: (g) => `🏷️ *${g.nome}* (${g.congregacao})\n${g.dia ? `🗓️ ${g.dia}${g.horario ? ` às ${g.horario}` : ''} · ` : ''}👥 ${g.membros} membros\n\n1. Ver membros\n2. Frequência dos últimos encontros\n3. Ausentes há 3 encontros ou mais\n4. Números do grupo\n\n_Adicionar ou remover membros: pela plataforma web._\n_Responda com o número. *menu* para voltar._`,

  frequenciaGrupo: (grupo, itens) => (itens.length
    ? `📈 *Frequência — ${grupo}*\n\n${itens.map((e) => `${e.data} · ${e.atividade}\n${barra(e.pct)} *${e.pct}%* (${e.presentes}/${e.total})`).join('\n\n')}\n\n_Responda *3* para ver quem está faltando ou *4* para os números do grupo._`
    : `Ainda não há encontros registrados para *${grupo}*.`),

  ausentesGrupo: (grupo, lista) => (lista.length
    ? `⚠️ *${grupo}: ausentes há 3 encontros ou mais*\n\n${lista.map((p, i) => `${i + 1}. *${p.nome}*: ${p.faltas} seguidas · última presença ${p.ultima}`).join('\n')}\n\n_Responda com o número para ligar, visitar, orar ou encaminhar a um obreiro._`
    : `💚 Ninguém em *${grupo}* está há 3 encontros ou mais sem vir. Glória a Deus!`),

  metricasGrupo: (m) => [
    `📊 *Números — ${m.grupo}*`,
    '',
    `👥 Membros: *${m.membros}* (${m.comCelular} com WhatsApp)`,
    `🗓️ Encontros nos últimos 60 dias: *${m.encontros}*`,
    m.media != null ? `✅ Presença média: *${m.media}%* ${avaliacaoCurta(m.media)}` : null,
    m.ultimo ? `🕐 Último encontro: ${m.ultimo.data}: *${m.ultimo.pct}%* (${m.ultimo.presentes}/${m.ultimo.total})` : null,
    m.tendencia != null ? `${m.tendencia >= 0 ? '📈' : '📉'} Tendência: ${m.tendencia >= 0 ? '+' : ''}${m.tendencia} pontos (últimos 4 × 4 anteriores)` : null,
    m.melhor ? `🏆 Melhor encontro: ${m.melhor.data} (${m.melhor.pct}%)` : null,
    `⚠️ Com 3+ faltas seguidas: *${m.criticos}*`,
    `💛 Em acompanhamento pastoral: *${m.emCuidado}*`,
    '',
    '_Responda *3* para ver os ausentes. *menu* para voltar._',
  ].filter((l) => l !== null).join('\n'),

  // ── Cuidado: quem está faltando ──────────────────────────────────────
  faltandoLista: (pessoas) => (pessoas.length
    ? `💛 *Quem está faltando* (🚨🔴🟡 faltas seguidas · 📉 esfriando: a frequência caiu)\n\n${pessoas.map((p, i) => `${i + 1}. ${nivelIcone(p.nivel)} *${p.nome}*${p.congregacao ? ` (${p.congregacao})` : ''}\n    ${p.onde.join(' · ')}${p.status ? `\n    _${p.status}_` : ''}`).join('\n')}\n\n_Responda com o número para cuidar: ligar, visitar, orar, enviar mensagem ou encaminhar a um obreiro._`
    : '💚 Ninguém com 2 ou mais faltas seguidas. Glória a Deus!'),

  cuidadoAcoes: (p) => `💛 *Cuidar de ${p.nome}*${p.onde?.length ? `\n${p.onde.join(' · ')}` : ''}${p.celular ? `\n📱 ${p.celular}` : ''}${p.ultimaAcao ? `\n_Última ação: ${p.ultimaAcao}_` : ''}\n\n1. 📞 Ligar\n2. 🏠 Visitar\n3. 🙏 Orar\n4. 💬 Enviar mensagem\n5. 🤝 Encaminhar a outro obreiro\n\n_Responda com o número. *menu* para voltar._`,
  ligacaoPergunta: (nome, celular) => `📞 Ligue para *${nome}*${celular ? `: ${celular}` : ''}\n\nA ligação foi feita?\n1. Sim\n2. Não, não consegui falar`,
  visitaPergunta: (nome) => `🏠 *Visita a ${nome}*\n\nA visita já foi feita?\n1. Sim\n2. Ainda não (vou agendar)`,
  oracaoPergunta: (nome) => `🙏 Registrar que você orou por *${nome}*?\n1. Sim, orei\n2. Não`,
  cuidadoComoFoi: (tipo, nome) => `Como foi ${tipo === 'visita' ? 'a visita' : 'a conversa'} com ${firstName(nome)}? Conte em poucas palavras (texto${ouAudio()}). Isso fica no histórico de cuidado.\n\n_Responda *0* para registrar sem comentário._`,
  visitaAgendar: (nome) => `Quando você pretende visitar ${firstName(nome)}? (ex.: "sábado de manhã"). Eu registro no acompanhamento.`,
  ligacaoNaoAtendeu: (nome) => `Tudo bem. Registrei a tentativa de contato com ${firstName(nome)}.\n\n1. 💬 Enviar uma mensagem\n2. 🤝 Encaminhar a outro obreiro\n3. ↩️ Voltar à lista`,
  cuidadoRegistrado: (acao, nome) => `✅ ${acao} de *${nome}* registrado(a) no *Cuidado Pastoral*. Obrigado por cuidar! 💛\n\n_Responda *7* para voltar à lista de quem está faltando ou *menu*._`,
  obreirosLista: (nome, obreiros) => `🤝 Encaminhar o cuidado de *${nome}* para qual obreiro?\n\n${obreiros.map((o, i) => `${i + 1}. ${o.nome}${o.papel ? ` (${o.papel})` : ''}`).join('\n')}\n\n_Responda com o número._`,
  semObreiros: () => 'Não encontrei outros obreiros cadastrados. Cadastre a liderança em *Configurações → Liderança* na plataforma web.',
  encaminhamentoObreiro: ({ obreiro, de, pessoa }) => `🤝 *Pedido de cuidado pastoral*\n\nOlá, ${firstName(obreiro)}! ${firstName(de)} pediu sua ajuda para cuidar de:\n\n👤 *${pessoa.nome}*${pessoa.congregacao ? ` (${pessoa.congregacao})` : ''}\n${pessoa.onde?.length ? `${pessoa.onde.join(' · ')}\n` : ''}${pessoa.celular ? `📱 ${pessoa.celular}\n` : ''}\nPode fazer uma ligação ou visita esta semana? Depois registre aqui respondendo *menu → 7*. 🙏\n_${churchName()}_`,
  encaminhado: (pessoa, obreiro) => `✅ Cuidado de *${pessoa}* encaminhado para *${obreiro}*. Ele(a) recebeu os dados no WhatsApp.`,

  // ── Aviso para um grupo ──────────────────────────────────────────────
  avisoPedirMensagem: (grupo, n) => `📣 *Aviso para ${grupo}* (${n} membro(s) com WhatsApp)\n\nQual é a mensagem? Pode escrever${temMidia() ? ' ou mandar um áudio' : ''}. Use *{nome}* para chamar cada um pelo nome.`,
  avisoPrevia: (grupo, previa, n) => `Assim ficará o aviso para *${grupo}*:\n\n────────────\n${previa}\n────────────\n\n1. ✅ Enviar para ${n} membro(s)\n2. ✏️ Refazer\n3. ❌ Cancelar`,
  avisoEnviando: (n, grupo) => `📤 Enviando para ${n} membro(s) de *${grupo}*, com intervalo entre as mensagens (proteção contra bloqueio).`,

  // ── Aniversariantes ──────────────────────────────────────────────────
  aniversariantesMenu: () => '🎂 *Aniversariantes*\n\n1. Da semana\n2. Do mês\n\n_Bodas de casamento e aniversário de batismo recebem parabéns automáticos no dia._\n_Responda com o número._',
  aniversariantesLista: ({ titulo, niver, casamento, batismo }) => [
    `🎂 *Aniversariantes ${titulo}*`,
    '',
    niver.length ? niver.map((p) => `• ${p}`).join('\n') : '_Nenhum aniversariante._',
    casamento.length ? `\n💍 *Bodas de casamento*\n${casamento.map((p) => `• ${p}`).join('\n')}` : null,
    batismo.length ? `\n🕊️ *Aniversário de batismo*\n${batismo.map((p) => `• ${p}`).join('\n')}` : null,
    '',
    '_Os parabéns são enviados automaticamente no dia. *menu* para voltar._',
  ].filter((l) => l !== null).join('\n'),

  // ── Relatório da semana (com avaliação) ──────────────────────────────
  relatorioSemana: ({ data, ebd, encontros, destaque, alerta, esfriando }) => [
    `📊 *Relatório da semana* (EBD de ${data} e encontros)`,
    '',
    '📖 *EBD*',
    ebd.length ? ebd.map(linhaRelatorio).join('\n\n') : '_Nenhuma chamada da EBD registrada no domingo._',
    '',
    '🤝 *Encontros das uniões e grupos*',
    encontros.length ? encontros.map(linhaRelatorio).join('\n\n') : '_Nenhum encontro registrado nos últimos 7 dias._',
    esfriando?.length ? `\n📉 *Esfriando* (a frequência caiu, ainda sem faltas seguidas): ${esfriando.slice(0, 6).join(', ')}${esfriando.length > 6 ? ` e mais ${esfriando.length - 6}` : ''}. Um contato agora evita a distância.` : null,
    destaque ? `\n🌟 *Destaque da semana:* ${destaque}` : null,
    alerta ? `\n🚨 *Atenção, pastor:* ${alerta}` : null,
    '',
    '_Responda *7* para cuidar de quem faltou ou *menu*._',
  ].filter((l) => l !== null).join('\n'),

  // ── Pedidos de oração ────────────────────────────────────────────────
  oracaoMenu: (novos) => `🙏 *Pedidos de oração*\n\n1. Fazer um pedido\n2. Ver pedidos${novos ? ` (${novos} novo${novos > 1 ? 's' : ''})` : ''}\n\n_Responda com o número._`,
  oracaoPedirTexto: () => `Qual é o pedido de oração? Pode escrever${temMidia() ? ' ou mandar um áudio' : ''}. 🙏`,
  oracaoRegistrada: () => '🙏 Pedido registrado! A liderança da igreja vai orar com você. _"Orai uns pelos outros."_ (Tg 5:16)',
  oracaoLista: (pedidos, dias) => (pedidos.length
    ? `🙏 *Pedidos de oração, últimos ${dias} dias* (${pedidos.length})\n\n${pedidos.map((p) => `${p.status === 'orado' ? '✅' : '🙏'} *${p.nome}*${p.congregacao ? ` (${p.congregacao})` : ''} · ${p.data}\n${p.texto}`).join('\n\n')}\n\n1. Marcar todos como orados\n2. Ver os últimos 30 dias\n\n_Responda com o número. *menu* para voltar._`
    : `Nenhum pedido de oração nos últimos ${dias} dias. 🙏\n\n2. Ver os últimos 30 dias`),
  oracaoMarcados: (n) => `✅ ${n} pedido(s) marcado(s) como orado(s). Que Deus responda cada um! 🙏`,

  // ── Jornada do visitante / novo convertido (30 dias) ─────────────────
  jornadaD3: (nome, tipo) => (tipo === 'novo decidido'
    ? `Oi, ${firstName(nome)}! 😊 Aqui é da *${churchShort()}*.\n\nComo está sendo esta primeira semana caminhando com Jesus? Ficou alguma dúvida sobre a fé, a Bíblia ou a igreja? Pode me perguntar por aqui.\n\nSe quiser, mande também um *pedido de oração*: vamos orar por você. 🙏`
    : `Oi, ${firstName(nome)}! 😊 Aqui é da *${churchShort()}*.\n\nFoi muito bom ter você conosco! Como foi a sua visita? Ficou alguma dúvida ou tem algo em que possamos ajudar?\n\nSe quiser, mande um *pedido de oração* por aqui. Vamos orar por você. 🙏`),
  jornadaD7: (nome, grupo) => (grupo
    ? `Oi, ${firstName(nome)}! 🙌\n\nNa ${churchShort()} ninguém caminha sozinho. Temos um grupo que é a sua cara: *${grupo.nome}*, ${grupo.dia}${grupo.horario ? ` às ${grupo.horario}` : ''}${grupo.local ? ` (${grupo.local})` : ''}.\n\nÉ um tempo de comunhão, Palavra e amizade. Quer participar? É só aparecer, vamos te receber com alegria! 💛\n\n_"Oh! quão bom e quão suave é que os irmãos vivam em união!"_ (Sl 133:1)`
    : `Oi, ${firstName(nome)}! 🙌\n\nNa ${churchShort()} ninguém caminha sozinho. Durante a semana temos encontros das uniões e grupos: um tempo de comunhão, Palavra e amizade. Quer que alguém te apresente ao grupo certo para você? Responda *sim*! 💛`),
  jornadaD14: (nome, tipo, classe) => (tipo === 'novo decidido'
    ? `Oi, ${firstName(nome)}! 📖\n\nQuem decide seguir a Jesus cresce firmando os pés na Palavra. Te convidamos para a *Escola Bíblica Dominical*${classe ? `, na classe *${classe}*` : ''}: aos domingos de manhã, com estudo simples e prático.\n\nÉ o melhor lugar para dar os primeiros passos (e fazer amigos na fé). Te esperamos! 🙏\n\n_"Desejai afetuosamente, como meninos novamente nascidos, o leite racional, não falsificado, para que por ele vades crescendo."_ (1Pe 2:2)`
    : `Oi, ${firstName(nome)}! 📖\n\nSabia que aos domingos de manhã temos a *Escola Bíblica Dominical*${classe ? `, com uma classe para a sua idade (*${classe}*)` : ''}? É um estudo leve e prático da Bíblia, cheio de gente acolhedora.\n\nQue tal vir neste domingo? Vai ser uma alegria te receber! 😊`),
  jornadaD21: (nome, tipo) => (tipo === 'novo decidido'
    ? `Oi, ${firstName(nome)}! 🕊️\n\nJá faz três semanas da sua decisão por Jesus. Que alegria! O próximo passo na caminhada é o *batismo*: o testemunho público da sua fé.\n\nQuer conversar com o pastor sobre isso? Responda *quero saber mais* e alguém da liderança fala com você. 🙌\n\n_"Quem crer e for batizado será salvo."_ (Mc 16:16)`
    : `Oi, ${firstName(nome)}! 💛\n\nSentimos a sua falta por aqui! A ${churchShort()} é a sua casa também, e domingo tem lugar guardado para você.\n\nSe estiver passando por algum momento difícil, conte com a gente: responda esta mensagem e vamos orar e caminhar com você. 🙏`),
  jornadaLideranca: (pessoas) => `🌱 *Jornada de 30 dias concluída*\n\n${pessoas.map((p) => `• *${p.nome}* (${p.tipo}${p.congregacao ? ` · ${p.congregacao}` : ''})${p.retornou ? ` ✅ voltou${p.onde ? `: ${p.onde}` : ''}` : ' ❌ *ainda não voltou*'}${p.celular ? `\n   📱 ${p.celular}` : ''}`).join('\n')}\n\n${pessoas.some((p) => !p.retornou) ? '*Quem ainda não voltou precisa de um contato pessoal esta semana: uma ligação faz toda a diferença.* Responda *menu → 12* para cuidar.' : 'Glória a Deus: todos voltaram! 🙌'}`,
  jornadaLista: (itens) => (itens.length
    ? `🌱 *Visitantes e novos convertidos* (jornada de 30 dias)\n\n${itens.map((j, i) => `${i + 1}. ${j.retornou ? '✅' : '⏳'} *${j.nome}* · ${j.tipo}\n    Dia ${j.dia}/30${j.retornou ? ` · voltou${j.onde ? ` (${j.onde})` : ''}` : ' · ainda não voltou'}${j.respondeu ? ' · 💬 respondeu' : ''}`).join('\n')}\n\n_Responda com o número para ligar, visitar, orar ou encaminhar a um obreiro._`
    : '🌱 Nenhum visitante ou novo convertido em jornada agora. Os novos cadastros entram automaticamente.'),

  // ── Presença no culto (check-in por QR Code) ─────────────────────────
  checkinOk: (nome, culto) => `✅ Presença confirmada, ${firstName(nome)}! Que bom ter você no *${culto}*. Bom culto! 🙏`,
  checkinRepetido: (nome) => `Sua presença já está registrada, ${firstName(nome)}. Bom culto! 🙌`,
  checkinInvalido: () => 'Não encontrei esse culto aberto para check-in. Confira o código no telão ou peça ajuda à recepção. 🙏',
  checkinPedirNome: () => `Seja muito bem-vindo(a) à *${churchName()}*! 🙌\n\nPara registrar a sua presença, qual é o seu *nome completo*?`,
  checkinVisitanteOk: (nome) => `Que alegria ter você aqui, ${firstName(nome)}! 💛 Sua presença está registrada.\n\nSalve este número: por aqui você recebe as novidades da igreja e pode mandar pedidos de oração. Bom culto! 🙏`,
  checkinQrLegenda: (culto, codigo) => `📲 *Check-in: ${culto}*\nAponte a câmera para o QR Code: o WhatsApp abre com a mensagem pronta. Ou envie *CHEGUEI ${codigo}* para este número.`,
  cultoLider: ({ titulo, congregacao, data, codigo, presentes, visitantes }) => `⛪ *${titulo}* (${congregacao}) · ${data}\n\nCódigo do check-in: *${codigo}*\nPresenças registradas: *${presentes}*${visitantes ? ` (🙋 ${visitantes} visitante(s))` : ''}\n\nEnviei o QR Code acima: projete no telão ou imprima na recepção.\n\n1. Ver quem fez check-in\n2. Encerrar o check-in\n\n_Responda com o número. *menu* para voltar._`,
  cultoPresentes: (titulo, presentes) => `⛪ *${titulo}*: ${presentes.length} presença(s)\n\n${presentes.map((p) => `• ${p.nome}${p.visitante ? ' 🙋 visitante' : ''}`).join('\n') || '_Ninguém fez check-in ainda._'}`,
  cultoEncerrado: (titulo, n) => `🔒 Check-in de *${titulo}* encerrado: ${n} presença(s) registrada(s).`,

  // ── Escala de voluntários ────────────────────────────────────────────
  escalaConvite: (nome, e) => `Olá, ${firstName(nome)}! 🙌\n\nVocê foi escalado(a) para servir:\n\n🎵 *${e.ministerio}* · ${e.funcao}\n🗓️ ${e.data}${e.horario ? ` às ${e.horario}` : ''} · ${e.evento}${e.congregacao ? ` (${e.congregacao})` : ''}${e.observacao ? `\n📝 ${e.observacao}` : ''}\n\nPode confirmar?\n1. ✅ Confirmo\n2. ❌ Não posso\n\n_"Servi uns aos outros, cada um conforme o dom que recebeu."_ (1Pe 4:10)`,
  escalaConfirmado: (nome) => `✅ Confirmado, ${firstName(nome)}! Obrigado por servir. Mando um lembrete na véspera. 🙏`,
  escalaRecusadoMembro: (nome) => `Tudo bem, ${firstName(nome)}. Já avisei o responsável para buscar um substituto. Obrigado por avisar com antecedência! 🙏`,
  escalaRecusaLider: (r) => `⚠️ *Escala: ${r.ministerio}* · ${r.data}\n\n*${r.nome}* não pode servir como *${r.funcao}*${r.motivo ? ` (_${r.motivo}_)` : ''}.\n\n${r.sugestoes.length ? `Sugestões de substituto (mesmo ministério, livres nessa data):\n${r.sugestoes.map((s, i) => `${i + 1}. ${s.nome}`).join('\n')}\n\n_Responda com o número para enviar o convite._` : '_Não encontrei substitutos livres no mesmo ministério. Escolha alguém pela plataforma web, em Escalas._'}`,
  escalaSubstitutoConvidado: (nome, funcao) => `📤 Convite enviado para *${nome}* (${funcao}). Te aviso quando responder.`,
  escalaRespostaLider: (r) => `${r.confirmou ? '✅' : '❌'} *${r.nome}* ${r.confirmou ? 'confirmou' : 'não pode'}: ${r.ministerio} · ${r.funcao} (${r.data}).`,
  escalaLembrete: (nome, e) => `⏰ Lembrete, ${firstName(nome)}: *amanhã* você serve em *${e.ministerio}* (${e.funcao}), ${e.evento}${e.horario ? ` às ${e.horario}` : ''}${e.congregacao ? `, ${e.congregacao}` : ''}. Deus abençoe o seu servir! 🙌`,
  escalasLider: (escalas) => (escalas.length
    ? `🗓️ *Próximas escalas*\n\n${escalas.map((e, i) => `${i + 1}. *${e.ministerio}* · ${e.data}${e.horario ? ` ${e.horario}` : ''} · ${e.evento}\n    ✅ ${e.confirmados} · ⏳ ${e.pendentes} · ❌ ${e.recusados}`).join('\n')}\n\n_Responda com o número para ver a escala. Montar escalas: pela plataforma web._`
    : '🗓️ Nenhuma escala nos próximos 14 dias. Monte as escalas pela plataforma web, em *Escalas*.'),
  escalaDetalhe: (e) => `🗓️ *${e.ministerio}* · ${e.evento}\n${e.data}${e.horario ? ` às ${e.horario}` : ''} · ${e.congregacao}\n\n${e.itens.map((it) => `${{ confirmado: '✅', recusado: '❌', pendente: '⏳' }[it.status]} ${it.funcao}: *${it.nome}*${it.substituiu ? ` (no lugar de ${it.substituiu})` : ''}`).join('\n')}\n\n1. Reenviar convite aos pendentes\n\n_Responda com o número. *menu* para voltar._`,
  escalaReenviado: (n) => (n ? `📤 Convite reenviado para ${n} pessoa(s).` : 'Não há convites pendentes nesta escala.'),

  cadastroConfirmar: (d) => `Confere os dados antes de eu cadastrar? 📋\n\n• *Nome:* ${d.nome}\n• *Tipo:* ${d.tipo}\n• *Sexo:* ${d.sexo || '—'}\n• *Nascimento/idade:* ${d.nascimento || '—'}\n• *Congregação:* ${d.congregacao}\n• *WhatsApp:* ${d.celular || '—'}${d.alertaCelular ? `\n\n⚠️ ${d.alertaCelular}` : ''}\n\nA mensagem de boas-vindas vai para o WhatsApp *${d.celular || '(sem número)'}*. Está certo? Responda *sim* ou me diga o que corrigir.`,

  menuMembro: (nome, assistente) => `${saudacaoAssistente({ nomeUsuario: nome, assistente, igreja: churchShort(), produto: PRODUTO })}\n\n1️⃣ Fazer um pedido de oração\n2️⃣ Ver meus dados cadastrais\n3️⃣ Atualizar meus dados\n\nResponda com o *número* ou escreva sua mensagem. Digite *menu* para ver as opções de novo.`,

  apresentacaoNumero: (nome, assistente, numero) => `Olá${nome ? `, ${firstName(nome)}` : ''}! 👋\n\nEste é o *número oficial da ${churchName()}* no WhatsApp${numero ? ` (${numero})` : ''}.\n\nPor aqui você vai receber os avisos automáticos da igreja — aniversariantes, chamada da EBD e dos encontros, cuidado com quem está faltando — e pode falar com *${assistente}*, o assistente da PastorIA.\n\n📌 *Salve este contato* como _${churchShort()} — PastorIA_ (o cartão de contato vem logo abaixo). Contato salvo garante que as mensagens cheguem e ajuda a evitar bloqueios do WhatsApp.\n\nResponda *menu* para ver tudo o que você pode fazer por aqui. 🙏`,

  agenteIndisponivel: () => `Olá! No momento o assistente de IA está indisponível. Sua mensagem foi registrada e a liderança da ${churchShort()} vai responder em breve. 🙏`,

  agenteLimitePlano: () => `O assistente atingiu o limite de interações deste mês no plano da ${churchShort()}. Fale com a administração da igreja. 🙏`,
};
