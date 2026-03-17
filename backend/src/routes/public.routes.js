const express = require('express');
const controller = require('../controllers/invitation.controller');

const router = express.Router();

router.post('/invitations/:token/submit', controller.submitInvitation);

module.exports = router;
