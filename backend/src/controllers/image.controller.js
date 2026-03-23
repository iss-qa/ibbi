const Person = require('../models/Person.model');
const { generateBirthdayCard } = require('../services/image.service');

const renderBirthdayCard = async (req, res) => {
  try {
    const { id } = req.params;
    const { format } = req.query; // 'portrait' or 'landscape'

    const person = await Person.findById(id);
    if (!person) {
      return res.status(404).json({ message: 'Pessoa não encontrada' });
    }

    const origin = `${req.protocol}://${req.get('host')}`;
    const imageBuffer = await generateBirthdayCard(person, format || 'portrait', { origin });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.send(imageBuffer);
  } catch (error) {
    console.error('Erro ao gerar imagem:', error);
    res.status(500).json({ message: 'Erro ao gerar o cartão de aniversário' });
  }
};

module.exports = {
  renderBirthdayCard,
};
