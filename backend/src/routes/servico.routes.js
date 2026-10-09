const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requirePasswordChanged = require('../middlewares/passwordChanged.middleware');
const requireRole = require('../middlewares/role.middleware');
const culto = require('../controllers/culto.controller');
const escala = require('../controllers/escala.controller');
const jornada = require('../controllers/jornada.controller');
const optout = require('../controllers/optout.controller');
const eng = require('../controllers/engajamento.controller');

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
router.post('/cultos/:id/lideranca', lideranca, culto.enviarLideranca);

router.get('/escalas', lideranca, escala.list);
router.post('/escalas', lideranca, escala.create);
router.post('/escalas/:id/convites', lideranca, escala.enviarConvites);
router.get('/escalas/:id/sugestoes', lideranca, escala.sugestoes);
router.post('/escalas/:id/itens', lideranca, escala.addItem);
router.delete('/escalas/:id/itens/:itemId', lideranca, escala.removeItem);
router.delete('/escalas/:id', lideranca, escala.cancelar);

router.get('/jornadas', lideranca, jornada.list);
router.put('/jornadas/:id/cancelar', lideranca, jornada.cancelar);

// Descadastro do WhatsApp (SAIR)
router.get('/optout', lideranca, optout.list);
router.post('/optout', lideranca, optout.registrar);
router.post('/optout/:id/reativar', lideranca, optout.reativar);

// Engajamento: campanhas (sermão, avisos), eventos, intercessores, células e impacto
router.get('/campanhas', lideranca, eng.listarCampanhas);
router.get('/campanhas/publico', lideranca, eng.previaPublico);
router.post('/campanhas', lideranca, eng.criarCampanha);
router.post('/campanhas/sermao/organizar', lideranca, eng.organizarSermao);
router.post('/campanhas/:id/cancelar', lideranca, eng.cancelarCampanha);
router.get('/eventos', lideranca, eng.listarEventos);
router.post('/eventos', lideranca, eng.criarEvento);
router.get('/eventos/:id', lideranca, eng.detalheEvento);
router.put('/eventos/:id', lideranca, eng.atualizarEvento);
router.post('/eventos/:id/inscricoes', lideranca, eng.inscreverWeb);
router.put('/eventos/:id/inscricoes/:iid', lideranca, eng.atualizarInscricao);
router.post('/eventos/:id/divulgar', lideranca, eng.divulgarEvento);
router.get('/eventos/:id/pix', lideranca, eng.pixPreview);
router.get('/intercessores', lideranca, eng.listarIntercessores);
router.put('/intercessores/:personId', lideranca, eng.marcarIntercessor);
router.get('/celulas/painel', lideranca, eng.painelCelulas);
router.get('/impacto', lideranca, eng.impacto);

module.exports = router;
