const { ASSISTENTE_PADRAO } = require('../config/assistentes');
const Person = require('../models/Person.model');
const { buildTimeline } = require('../services/whatsapp-timeline.service');
const { getTenant } = require('../tenancy/context');

const igreja = () => {
  const tenant = getTenant();
  return { nome: tenant?.nome, nomeCurto: tenant?.nomeCurto, logoUrl: tenant?.branding?.logoUrl, slug: tenant?.slug };
};

// Espelho do WhatsApp do próprio usuário: cada pessoa vê apenas o que foi enviado para ela.
const whatsappMirror = async (req, res) => {
  const person = req.user.personId
    ? await Person.findById(req.user.personId).select('nome celular congregacao').lean()
    : null;
  if (!person?.celular) return res.json({ celular: null, itens: [] });
  const itens = await buildTimeline(person, { userId: req.user._id, incluirInternas: req.user.role !== 'user' });
  return res.json({ celular: person.celular, igreja: igreja(), assistente: getTenant()?.ia?.nomeAssistente || ASSISTENTE_PADRAO, itens });
};

module.exports = { whatsappMirror, igreja };
