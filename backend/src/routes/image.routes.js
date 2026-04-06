const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const { renderBirthdayCard } = require('../controllers/image.controller');

router.get('/aniversariante/:id', auth, renderBirthdayCard);

module.exports = router;
