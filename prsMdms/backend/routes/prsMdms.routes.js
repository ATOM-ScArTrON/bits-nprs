import { Router } from 'express';
import { 
  getAllDiscrepancies, 
  getDiscrepancySummary, 
  getDetailedSummary,
  getDiscrepanciesByType, 
  getDiscrepanciesForCoachCode,
  exportToExcel,
  downloadExcel
} from '../controllers/discrepancyController';

const router = Router();

// Get summary of all discrepancies (counts only)
router.get('/summary', getDiscrepancySummary);

// Get detailed summary with analytics and insights
router.get('/detailed-summary', getDetailedSummary);

// Get all discrepancies with full details
router.get('/all', getAllDiscrepancies);

// Export discrepancies to Excel file
// Query param: ?detailed=true for detailed analysis sheet
router.get('/export/excel', exportToExcel);

// Download generated Excel file
router.get('/download/:fileName', downloadExcel);

// Get discrepancies by type
// Types: TYPE_MISMATCH, MISSING_IN_BERTHS, MISSING_IN_LAYOUTS
router.get('/type/:type', getDiscrepanciesByType);

// Get discrepancies for a specific coach code
router.get('/coach/:coachCode', getDiscrepanciesForCoachCode);

export default router;
