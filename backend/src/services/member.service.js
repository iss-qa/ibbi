const User = require('../models/User.model');
const Message = require('../models/Message.model');
const { buildUniqueLogin } = require('../utils/login');
const whatsapp = require('./whatsapp.service');
const { applyTempPassword } = require('../config/defaults');
const templates = require('../templates/messages.templates');

const sendAndLogMemberMessage = async ({ tipo, personLike, conteudo, authorId = null, bulk = false }) => {
  if (!personLike?.celular || !conteudo) return;

  try {
    // bulk: ritmo anti-ban (intervalo, janela de horário, limites, duplicadas)
    if (bulk) await whatsapp.sendText(personLike.celular, conteudo, { bulk: true });
    else await whatsapp.sendSingle(personLike.celular, conteudo);

    await Message.create({
      tipo,
      destinatarios: [{ nome: personLike.nome, celular: personLike.celular }],
      conteudo,
      status: 'concluido',
      enviadoPor: authorId,
      criadoEm: new Date(),
      concluidoEm: new Date(),
    });
  } catch (err) {
    await Message.create({
      tipo,
      destinatarios: [{ nome: personLike.nome, celular: personLike.celular }],
      conteudo,
      status: 'erro',
      enviadoPor: authorId,
      criadoEm: new Date(),
      concluidoEm: new Date(),
      erros: [{ celular: personLike.celular, motivo: err.message }],
    });
    throw err;
  }
};

const sendPendingRegistrationWelcome = async (personLike, authorId = null) => {
  if (!personLike?.celular) return false;

  const msgText = templates.boasVindasCadastroPendente();
  // Disparado por formulário público: sempre pelo anti-ban (senão vira canhão de spam no número da igreja)
  await sendAndLogMemberMessage({
    tipo: 'novo cadastro',
    personLike,
    conteudo: msgText,
    authorId,
    bulk: true,
  });

  return true;
};

/**
 * Registra um novo membro no sistema de usuários e envia mensagem de acesso.
 * Pode ser chamado via admin ou via cadastro externo.
 */
const onboardMember = async (person, authorId = null, options = {}) => {
  if (!person || !person.celular) return null;

  try {
    const existing = await User.findOne({ personId: person._id });
    if (existing) return null; // Já tem usuário

    const userLogin = await buildUniqueLogin(person.nome);
    // Senha provisória própria da conta (nunca uma senha compartilhada entre membros)
    const user = new User({
      nome: person.nome,
      login: userLogin,
      role: 'user',
      personId: person._id,
      ativo: true,
    });
    const defaultPassword = applyTempPassword(user);
    await user.save();

    const isApprovalFlow = options.context === 'approval';
    const msgText = isApprovalFlow
      ? templates.acessoCadastroLiberado(userLogin, defaultPassword)
      : templates.acessoCadastroImediato(userLogin, defaultPassword);

    try {
      await sendAndLogMemberMessage({
        tipo: 'aviso - novo membro',
        personLike: person,
        conteudo: msgText,
        authorId,
      });
    } catch (err) {
      console.error('Erro ao enviar mensagem de acesso do membro:', err.message);
    }

    return { login: userLogin, password: defaultPassword };
  } catch (err) {
    console.error('Erro no onboarding do membro:', err);
    return null;
  }
};

module.exports = { onboardMember, sendPendingRegistrationWelcome };
