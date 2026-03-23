const uploadPersonPhoto = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Arquivo não enviado' });

  const mime = req.file.mimetype || 'image/jpeg';
  if (!mime.startsWith('image/')) {
    return res.status(400).json({ message: 'Arquivo inválido. Envie uma imagem.' });
  }

  const url = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
  res.json({ url });
};

module.exports = { uploadPersonPhoto };
