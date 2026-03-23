const express = require('express');
const multer = require('multer');
const auth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/upload.controller');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post('/person-photo', auth, requireRole('admin', 'master'), upload.single('file'), controller.uploadPersonPhoto);

module.exports = router;
