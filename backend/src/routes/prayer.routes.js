const express = require('express');
const { body } = require('express-validator');
const auth = require('../middlewares/auth.middleware');
const controller = require('../controllers/prayer.controller');

const router = express.Router();

router.use(auth);
router.post('/send', body('mensagem').notEmpty(), controller.sendPrayer);

module.exports = router;
