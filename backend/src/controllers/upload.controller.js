const path = require('path');

const uploadPersonPhoto = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Arquivo não enviado' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
};

module.exports = { uploadPersonPhoto };
