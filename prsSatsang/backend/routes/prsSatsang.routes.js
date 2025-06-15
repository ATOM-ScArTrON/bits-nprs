const express = require('express');
const router = express.Router();
const prsController = require('../controllers/prsController');

// Define all API endpoints
router.get('/satsangs', prsController.getAllSatsangs);
router.get('/satsangs/:id', prsController.getSatsangById);
router.post('/satsangs', prsController.createSatsang);

module.exports = router;
