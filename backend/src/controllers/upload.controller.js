const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Magic bytes para validação real do tipo de arquivo
const MAGIC_BYTES = {
  'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4E, 0x47])],
  'image/gif': [Buffer.from('GIF87a'), Buffer.from('GIF89a')],
  'image/webp': [Buffer.from('RIFF')],
};

const validateMagicBytes = (buffer, mime) => {
  const signatures = MAGIC_BYTES[mime];
  if (!signatures) return false;
  return signatures.some((sig) => buffer.subarray(0, sig.length).equals(sig));
};

const uploadPersonPhoto = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Arquivo não enviado' });

  const mime = req.file.mimetype;
  if (!ALLOWED_MIMES.includes(mime)) {
    return res.status(400).json({ message: 'Tipo de arquivo não permitido. Envie JPEG, PNG, WebP ou GIF.' });
  }

  if (req.file.size > MAX_SIZE) {
    return res.status(400).json({ message: 'Arquivo muito grande. Máximo 5MB.' });
  }

  if (!validateMagicBytes(req.file.buffer, mime)) {
    return res.status(400).json({ message: 'Conteúdo do arquivo não corresponde ao tipo informado.' });
  }

  const url = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
  res.json({ url });
};

module.exports = { uploadPersonPhoto };
