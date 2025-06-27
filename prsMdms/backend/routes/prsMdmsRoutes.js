import { Router } from 'express';
import {
  getAllDiscrepancies,
  getDiscrepancySummary,
  getDetailedSummary,
  getDiscrepanciesByType,
  getDiscrepanciesForCoachCode,
  exportToExcel,
  simulateChanges,
  restoreData
} from '../controllers/prsMdmsController.js';

const router = Router();

// Add this route at the top of your routes file
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'PRS vs MDMS Discrepancy API',
    availableEndpoints: [
      'GET /api/discrepancies/summary',
      'GET /api/discrepancies/all',
      'GET /api/discrepancies/detailed-summary',
      'GET /api/discrepancies/type/:type',
      'GET /api/discrepancies/coach/:coachCode',
      'GET /api/discrepancies/export/excel',
      'POST /api/discrepancies/simulate',
      'POST /api/discrepancies/restore'
    ]
  });
});

// Get summary of all discrepancies (counts only)
router.get('/summary', getDiscrepancySummary);

// Get detailed summary with analytics and insights
router.get('/detailed-summary', getDetailedSummary);

// Get all discrepancies with full details
router.get('/all', getAllDiscrepancies);

// Export discrepancies to Excel file
// Query param: ?detailed=true for detailed analysis sheet
router.get('/export/excel', exportToExcel);

// Get discrepancies by type
// Types: TYPE_MISMATCH, MISSING_IN_PRS, MISSING_IN_MDMS
router.get('/type/:type', getDiscrepanciesByType);

// Get discrepancies for a specific coach code
router.get('/coach/:coachCode', getDiscrepanciesForCoachCode);

// Simulation endpoints for testing
router.post('/simulate', simulateChanges);
router.post('/restore', restoreData);

export default router;
