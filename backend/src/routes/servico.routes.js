const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requirePasswordChanged = require('../middlewares/passwordChanged.middleware');
const requireRole = require('../middlewares/role.middleware');
const culto = require('../controllers/culto.controller');
const escala = require('../controllers/escala.controller');
const jornada = require('../controllers/jornada.controller');

// Cultos (check-in por QR), escalas de voluntários e jornada do visitante — liderança.
// Montado em /api: a proteção vai em cada rota (um router.use aqui exigiria login de TODA rota /api
// registrada depois, como webhooks e rotas públicas).
const router = express.Router();
const lideranca = [auth, requirePasswordChanged, requireRole('admin', 'master')];

router.get('/cultos', lideranca, culto.list);
router.post('/cultos', lideranca, culto.abrir);
router.get('/cultos/:id', lideranca, culto.get);
router.post('/cultos/:id/encerrar', lideranca, culto.encerrar);
router.post('/cultos/:id/presencas', lideranca, culto.addPresenca);

router.get('/escalas', lideranca, escala.list);
router.post('/escalas', lideranca, escala.create);
router.post('/escalas/:id/convites', lideranca, escala.enviarConvites);
router.get('/escalas/:id/sugestoes', lideranca, escala.sugestoes);
router.post('/escalas/:id/itens', lideranca, escala.addItem);
router.delete('/escalas/:id/itens/:itemId', lideranca, escala.removeItem);
router.delete('/escalas/:id', lideranca, escala.cancelar);

router.get('/jornadas', lideranca, jornada.list);
router.put('/jornadas/:id/cancelar', lideranca, jornada.cancelar);

module.exports = router;
