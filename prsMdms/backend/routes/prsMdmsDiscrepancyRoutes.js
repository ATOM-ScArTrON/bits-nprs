import { Router } from 'express';
import {
    // Discrepancy controllers only
    getAllDiscrepancies,
    getDiscrepancySummary,
    getDetailedSummary,
    getDiscrepanciesByType,
    getDiscrepanciesForCoachCode,
    exportDiscrepanciesToExcel,
    // Simulation controllers
    simulateChanges,
    restoreData,
    // Utility controllers
    downloadExcel
} from '../controllers/prsMdmsController.js';

const router = Router();

// Main API information endpoint
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'PRS vs MDMS Discrepancy Analysis API',
        version: '2.0.0',
        features: ['Discrepancy Analysis', 'Data Export', 'Simulation Testing'],
        availableEndpoints: {
            discrepancies: [
                'GET /api/discrepancies/summary',
                'GET /api/discrepancies/all',
                'GET /api/discrepancies/detailed-summary',
                'GET /api/discrepancies/type/:type',
                'GET /api/discrepancies/coach/:coachCode',
                'GET /api/discrepancies/export/excel'
            ],
            simulation: [
                'POST /api/discrepancies/simulate',
                'POST /api/discrepancies/restore'
            ],
            utility: [
                'GET /api/discrepancies/download/:fileName'
            ]
        }
    });
});

// ==================== DISCREPANCY ROUTES ONLY ====================
router.get('/summary', getDiscrepancySummary);
router.get('/detailed-summary', getDetailedSummary);
router.get('/all', getAllDiscrepancies);
router.get('/export/excel', exportDiscrepanciesToExcel);
router.get('/type/:type', getDiscrepanciesByType);
router.get('/coach/:coachCode', getDiscrepanciesForCoachCode);

// ==================== SIMULATION ROUTES ====================
router.post('/simulate', simulateChanges);
router.post('/restore', restoreData);

// ==================== UTILITY ROUTES ====================
router.get('/download/:fileName', downloadExcel);

export default router;
