const Person = require('../models/Person.model');
const { generateBirthdayCard } = require('../services/image.service');
const { assertPersonAccess } = require('../utils/access');

const renderBirthdayCard = async (req, res) => {
  try {
    const { id } = req.params;
    const { format } = req.query; // 'portrait' or 'landscape'

    const person = await Person.findById(id);
    if (!person) {
      return res.status(404).json({ message: 'Pessoa não encontrada' });
    }

    // user só gera o próprio card; admin, os das suas congregações
    await assertPersonAccess(req.user, person);
    const imageBuffer = await generateBirthdayCard(person, format === 'landscape' ? 'landscape' : 'portrait');

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.send(imageBuffer);
  } catch (error) {
    if (error.status === 403) return res.status(403).json({ message: error.message });
    console.error('Erro ao gerar imagem:', error);
    return res.status(500).json({ message: 'Erro ao gerar o cartão de aniversário' });
  }
};

module.exports = {
  renderBirthdayCard,
};
