const express = require('express');
const router = express.Router();
const { renderBirthdayCard } = require('../controllers/image.controller');

router.get('/aniversariante/:id', renderBirthdayCard);

module.exports = router;
