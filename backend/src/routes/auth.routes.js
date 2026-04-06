const express = require('express');
const { body } = require('express-validator');
const auth = require('../middlewares/auth.middleware');
const verifyRecaptcha = require('../middlewares/recaptcha.middleware');
const controller = require('../controllers/auth.controller');

const router = express.Router();

router.post(
  '/login',
  body('login').notEmpty().withMessage('login é obrigatório'),
  body('senha').notEmpty().withMessage('senha é obrigatória'),
  verifyRecaptcha,
  controller.login
);

router.get('/me', auth, controller.me);

module.exports = router;
