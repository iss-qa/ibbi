module.exports = {
  aniversario: (nome) => `🎂 *Feliz Aniversário, ${nome}!*\n\n_"Ensina-nos a contar os nossos dias..."_ (Sl 90:12)\n\nQue o Senhor continue a guiar seus passos! 🙏\n_Igreja Batista Bíblica Israel_`,

  aviso: (nome, texto) => `📢 *Aviso IBBI*\n\nOlá, ${nome}!\n\n${texto}\n\n_Igreja Batista Bíblica Israel_`,

  reuniao: (nome, data, local) => `📅 *Convite para Reunião*\n\nOlá, ${nome}!\n\nVocê está convidado(a) para nossa reunião:\n📆 Data: ${data}\n📍 Local: ${local}\n\nContamos com sua presença! 🙏\n_Igreja Batista Bíblica Israel_`,

  pedidoOracao: (remetente, mensagem, congregacao) => `🙏 *Pedido de Oração*\n\nDe: *${remetente}${congregacao ? ` - ${congregacao}` : ''}*\n\n${mensagem}\n\n_Recebido pelo sistema IBBI_`,

  personalizada: (nome, texto) => `Olá, ${nome}!\n\n${texto}\n\n_Igreja Batista Bíblica Israel_`,

  boasVindasCadastroPendente: () => `🙏 Bem-vindo(a) à Comunidade IBBI!

Que alegria ter você conosco! Recebemos seu cadastro e nossa secretaria fará a validação das informações com carinho.

Assim que a aprovação for concluída, enviaremos por aqui seus dados de acesso ao portal.

Qualquer dúvida, estamos aqui! 💙`,

  acessoCadastroLiberado: (userLogin, defaultPassword) => `🙏 Bem-vindo(a) à Comunidade IBBI!
Que alegria ter você conosco! Seus dados foram aprovados, aqui está seu acesso:
🔗 Portal: https://ibbi.issqa.com.br/login
👤 Usuário: ${userLogin}
🔑 Senha: ${defaultPassword}

Através do portal você pode:
✅ Realizar seu pedido de oração
✏️ Atualizar seus dados cadastrais, obter carteirinha de membro, certificado de batismo e muito mais
Qualquer dúvida, estamos aqui! 💙`,

  acessoCadastroImediato: (userLogin, defaultPassword) => `🙏 Bem-vindo(a) à Comunidade IBBI!
Que alegria ter você conosco! Seus dados de acesso estão prontos:
🔗 Portal: https://ibbi.issqa.com.br/login
👤 Usuário: ${userLogin}
🔑 Senha: ${defaultPassword}

Através do portal você pode:
✅ Realizar seu pedido de oração
✏️ Atualizar seus dados cadastrais, obter carteirinha de membro, certificado de batismo e muito mais
Qualquer dúvida, estamos aqui! 💙`,
};
