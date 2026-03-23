const express = require('express');
const multer = require('multer');
const { body } = require('express-validator');
const auth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/person.controller');

const router = express.Router();
const upload = multer();

router.use(auth);

router.get('/', requireRole('admin', 'master'), controller.list);
router.get('/:id', requireRole('user', 'admin', 'master'), controller.getById);

router.post(
  '/',
  requireRole('admin', 'master'),
  body('nome').notEmpty().withMessage('nome é obrigatório'),
  controller.create
);

router.put('/:id', requireRole('user', 'admin', 'master'), controller.update);
router.delete('/:id', requireRole('master'), controller.remove);

router.post(
  '/import-csv',
  requireRole('master'),
  upload.single('file'),
  controller.importCsv
);

module.exports = router;
