const express = require('express');
const router = express.Router();
const { registerTable, loginTable } = require('../controllers/authController');

router.post('/register', registerTable);
router.post('/login', loginTable);

module.exports = router;