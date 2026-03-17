const whatsapp = require('../services/whatsapp.service');

const testSend = async (req, res) => {
  const { number, text } = req.body || {};
  try {
    const data = await whatsapp.sendSingle(number || process.env.MOCK_WHATSAPP_NUMBER, text || 'Teste IBBI');
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

module.exports = { testSend };
