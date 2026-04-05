const whatsapp = require('./whatsapp.service');
const TriagemGrupo = require('../models/TriagemGrupo.model');
const Message = require('../models/Message.model');
const templates = require('../templates/whatsapp.templates');

const registrarComunicacao = async (data) => {
  try {
    await Message.create({
      tipo: data.tipo || 'novo cadastro',
      destinatarios: data.destinatarios || [],
      conteudo: data.conteudo || '',
      status: data.status || 'pendente',
      enviadoPor: data.enviadoPor,
      origemNome: data.origemNome,
      origemCongregacao: data.origemCongregacao,
      erros: data.erros || [],
    });
  } catch (err) {
    console.error('[TRIGGER] Erro ao registrar comunicação:', err.message);
  }
};

const triggerNovoDecididoWhatsApp = (person, userId) => {
  setImmediate(async () => {
    try {
      // 1. Send welcome to person
      if (person.celular) {
        const msg = templates.boasVindasNovoDecidido(
          person.nome,
          person.congregacao || 'Não informada'
        );
        try {
          await whatsapp.sendSingle(person.celular, msg);
          await registrarComunicacao({
            tipo: 'novo cadastro',
            destinatarios: [{ nome: person.nome, celular: person.celular }],
            conteudo: msg,
            status: 'concluido',
            enviadoPor: userId,
            origemNome: person.nome,
            origemCongregacao: person.congregacao,
          });
        } catch (err) {
          await registrarComunicacao({
            tipo: 'novo cadastro',
            destinatarios: [{ nome: person.nome, celular: person.celular }],
            conteudo: msg,
            status: 'erro',
            enviadoPor: userId,
            origemNome: person.nome,
            origemCongregacao: person.congregacao,
            erros: [{ celular: person.celular, motivo: err.message }],
          });
        }
      }

      // 2. Notify triagem groups (filtered by congregation)
      const grupoFilter = { tipo: 'novos_decididos', ativo: true };
      if (person.congregacao) grupoFilter.congregacao = person.congregacao;
      const grupos = await TriagemGrupo.find(grupoFilter);
      const msgGrupo = templates.notificacaoTriagemNovoDecidido({
        nome: person.nome,
        dataDecisao: person.dataDecisao,
        sexo: person.sexo,
        celular: person.celular,
        congregacao: person.congregacao,
      });

      for (const grupo of grupos) {
        // Add novo decidido to grupo.acompanhados
        const jaExiste = grupo.acompanhados?.some((a) => String(a.person_id) === String(person._id));
        if (!jaExiste) {
          grupo.acompanhados.push({
            person_id: person._id,
            nome: person.nome,
            celular: person.celular || '',
            tipo: 'novo decidido',
            data: person.dataDecisao || new Date(),
            congregacao: person.congregacao || '',
          });
          grupo.updated_at = new Date();
          await grupo.save();
        }

        const membrosAtivos = grupo.membros.filter((m) => m.ativo && m.whatsapp);
        for (const membro of membrosAtivos) {
          try {
            await whatsapp.sendSingle(membro.whatsapp, msgGrupo);
            await registrarComunicacao({
              tipo: 'novo cadastro',
              destinatarios: [{ nome: membro.nome, celular: membro.whatsapp }],
              conteudo: msgGrupo,
              status: 'concluido',
              enviadoPor: userId,
              origemNome: person.nome,
              origemCongregacao: person.congregacao,
            });
          } catch (err) {
            await registrarComunicacao({
              tipo: 'novo cadastro',
              destinatarios: [{ nome: membro.nome, celular: membro.whatsapp }],
              conteudo: msgGrupo,
              status: 'erro',
              enviadoPor: userId,
              origemNome: person.nome,
              origemCongregacao: person.congregacao,
              erros: [{ celular: membro.whatsapp, motivo: err.message }],
            });
          }
        }
      }
    } catch (err) {
      console.error('[TRIGGER] Erro no trigger novo decidido:', err);
    }
  });
};

const triggerVisitanteWhatsApp = (person, userId) => {
  setImmediate(async () => {
    try {
      // 1. Send welcome to person
      if (person.celular) {
        const msg = templates.boasVindasVisitante(
          person.nome,
          person.congregacao || 'Não informada'
        );
        try {
          await whatsapp.sendSingle(person.celular, msg);
          await registrarComunicacao({
            tipo: 'novo cadastro',
            destinatarios: [{ nome: person.nome, celular: person.celular }],
            conteudo: msg,
            status: 'concluido',
            enviadoPor: userId,
            origemNome: person.nome,
            origemCongregacao: person.congregacao,
          });
        } catch (err) {
          await registrarComunicacao({
            tipo: 'novo cadastro',
            destinatarios: [{ nome: person.nome, celular: person.celular }],
            conteudo: msg,
            status: 'erro',
            enviadoPor: userId,
            origemNome: person.nome,
            origemCongregacao: person.congregacao,
            erros: [{ celular: person.celular, motivo: err.message }],
          });
        }
      }

      // 2. Notify triagem groups (filtered by congregation)
      const grupoFilter = { tipo: 'visitantes', ativo: true };
      if (person.congregacao) grupoFilter.congregacao = person.congregacao;
      const grupos = await TriagemGrupo.find(grupoFilter);
      const msgGrupo = templates.notificacaoTriagemVisitante({
        nome: person.nome,
        dataVisita: person.dataVisita,
        sexo: person.sexo,
        celular: person.celular,
        congregacao: person.congregacao,
      });

      for (const grupo of grupos) {
        // Add visitante to grupo.acompanhados
        const jaExiste = grupo.acompanhados?.some((a) => String(a.person_id) === String(person._id));
        if (!jaExiste) {
          grupo.acompanhados.push({
            person_id: person._id,
            nome: person.nome,
            celular: person.celular || '',
            tipo: 'visitante',
            data: person.dataVisita || new Date(),
            congregacao: person.congregacao || '',
          });
          grupo.updated_at = new Date();
          await grupo.save();
        }

        const membrosAtivos = grupo.membros.filter((m) => m.ativo && m.whatsapp);
        for (const membro of membrosAtivos) {
          try {
            await whatsapp.sendSingle(membro.whatsapp, msgGrupo);
            await registrarComunicacao({
              tipo: 'novo cadastro',
              destinatarios: [{ nome: membro.nome, celular: membro.whatsapp }],
              conteudo: msgGrupo,
              status: 'concluido',
              enviadoPor: userId,
              origemNome: person.nome,
              origemCongregacao: person.congregacao,
            });
          } catch (err) {
            await registrarComunicacao({
              tipo: 'novo cadastro',
              destinatarios: [{ nome: membro.nome, celular: membro.whatsapp }],
              conteudo: msgGrupo,
              status: 'erro',
              enviadoPor: userId,
              origemNome: person.nome,
              origemCongregacao: person.congregacao,
              erros: [{ celular: membro.whatsapp, motivo: err.message }],
            });
          }
        }
      }
    } catch (err) {
      console.error('[TRIGGER] Erro no trigger visitante:', err);
    }
  });
};

module.exports = {
  triggerNovoDecididoWhatsApp,
  triggerVisitanteWhatsApp,
  registrarComunicacao,
};
