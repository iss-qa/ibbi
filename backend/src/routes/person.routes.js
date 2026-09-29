const express = require('express');
const multer = require('multer');
const { body } = require('express-validator');
const auth = require('../middlewares/auth.middleware');
const requirePasswordChanged = require('../middlewares/passwordChanged.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/person.controller');

const router = express.Router();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

router.use(auth, requirePasswordChanged);

router.get('/', requireRole('admin', 'master'), controller.list);
router.get('/import-template', requireRole('master'), controller.importTemplate); // antes de /:id
router.get('/:id', requireRole('user', 'admin', 'master'), controller.getById);

router.post(
  '/',
  requireRole('admin', 'master'),
  body('nome').notEmpty().withMessage('nome é obrigatório'),
  controller.create
);

router.put('/:id', requireRole('user', 'admin', 'master'), controller.update);
router.patch('/:id/health', requireRole('user', 'admin', 'master'), controller.updateHealth);
router.delete('/:id', requireRole('master'), controller.remove);

router.post(
  '/import-csv',
  requireRole('master'),
  upload.single('file'),
  controller.importCsv
);

module.exports = router;
