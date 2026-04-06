const User = require('../models/User.model');
const Message = require('../models/Message.model');
const { buildUniqueLogin } = require('../utils/login');
const whatsapp = require('./whatsapp.service');
const { DEFAULT_USER_PASSWORD } = require('../config/defaults');

/**
 * Registra um novo membro no sistema de usuários e envia mensagem de boas-vindas.
 * Pode ser chamado via admin ou via cadastro externo.
 */
const onboardMember = async (person, authorId = null) => {
  if (!person || !person.celular) return null;

  try {
    const existing = await User.findOne({ personId: person._id });
    if (existing) return null; // Já tem usuário

    const userLogin = await buildUniqueLogin(person.nome);
    const defaultPassword = DEFAULT_USER_PASSWORD;
    
    await User.create({
      nome: person.nome,
      login: userLogin,
      senha: defaultPassword,
      role: 'user',
      personId: person._id,
      ativo: true,
      mustChangePassword: true,
    });

    const msgText = `🙏 Bem-vindo(a) à Comunidade IBBI!
Que alegria ter você conosco! Seus dados de acesso estão prontos:
🔗 Portal: https://ibbi.issqa.com.br/login
👤 Usuário: ${userLogin}
🔑 Senha: ${defaultPassword}

Através do portal você pode:
✅ Realizar seu pedido de oração
✏️ Atualizar seus dados cadastrais
Qualquer dúvida, estamos aqui! 💙`;

    await whatsapp.sendSingle(person.celular, msgText);

    await Message.create({
      tipo: 'novo cadastro',
      destinatarios: [{ nome: person.nome, celular: person.celular }],
      conteudo: msgText,
      status: 'concluido',
      enviadoPor: authorId,
      criadoEm: new Date(),
      concluidoEm: new Date(),
    });

    return { login: userLogin, password: defaultPassword };
  } catch (err) {
    console.error('Erro no onboarding do membro:', err);
    return null;
  }
};

module.exports = { onboardMember };
