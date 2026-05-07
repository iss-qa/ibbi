const express = require('express');
const { sendBirthdayMessages } = require('../services/scheduler.service');

const router = express.Router();

router.get('/birthdays', async (req, res) => {
  try {
    console.log('[cron] Triggering automatic birthday check via endpoint...');
    await sendBirthdayMessages();
    res.json({ success: true, message: 'Birthday messages checked and sent successfully.' });
  } catch (err) {
    console.error('[cron] Error during birthday messages:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
