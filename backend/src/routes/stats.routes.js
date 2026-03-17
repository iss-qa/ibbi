const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const controller = require('../controllers/stats.controller');

const router = express.Router();

router.use(auth, requireRole('admin', 'master'));

router.get('/growth', controller.growth);
router.get('/by-congregation', controller.byCongregation);
router.get('/by-group', controller.byGroup);
router.get('/retention', controller.retention);

module.exports = router;
