import { Router } from 'express';
import {
  getSeederStatus,
  forceSeeding,
  resetFileHashes,
  getSeederConfig,
  getSeedingHistory,
  stopSeeder,
  startSeeder,
  checkForChanges
} from '../controllers/prsMdmsController.js';

const router = Router();

// Main API information endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Smart Seeder API',
    version: '1.0.0',
    features: [
      'File Change Detection',
      'Automatic Seeding',
      'Whitespace Cleanup',
      'Manual Control',
      'Configuration Management',
      'Hash-based Change Detection'
    ],
    availableEndpoints: {
      status: 'GET /api/seeder/status',
      config: 'GET /api/seeder/config',
      history: 'GET /api/seeder/history',
      actions: {
        forceSeeding: 'POST /api/seeder/force',
        resetHashes: 'POST /api/seeder/reset',
        stop: 'POST /api/seeder/stop',
        start: 'POST /api/seeder/start',
        checkChanges: 'POST /api/seeder/check'
      }
    }
  });
});

// ==================== SMART SEEDER ROUTES ====================

// Get current status
router.get('/status', getSeederStatus);

// Get configuration
router.get('/config', getSeederConfig);

// Get seeding history
router.get('/history', getSeedingHistory);

// Force manual seeding
router.post('/force', forceSeeding);

// Reset file hash tracking
router.post('/reset', resetFileHashes);

// Stop seeder
router.post('/stop', stopSeeder);

// Start seeder
router.post('/start', startSeeder);

// Check for changes manually
router.post('/check', checkForChanges);

export default router;
