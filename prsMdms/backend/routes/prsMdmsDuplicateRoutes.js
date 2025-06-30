import { Router } from 'express';
import {
    // Duplicate controllers
    getAllDuplicates,
    getDuplicateSummary,
    getDetailedDuplicateSummary,
    getDuplicatesByType,
    getDuplicatesForCoachCode,
    exportDuplicatesToExcel,
    // Utility controllers
    downloadExcel
} from '../controllers/prsMdmsController.js';

const router = Router();

// Main API information endpoint
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'PRS vs MDMS Duplicate Analysis API',
        version: '2.0.0',
        features: ['Duplicate Detection', 'Data Export'],
        availableEndpoints: {
            duplicates: [
                'GET /api/duplicates/summary',
                'GET /api/duplicates/all',
                'GET /api/duplicates/detailed-summary',
                'GET /api/duplicates/type/:type',
                'GET /api/duplicates/coach/:coachCode',
                'GET /api/duplicates/export/excel'
            ],
            utility: [
                'GET /api/duplicates/download/:fileName'
            ]
        }
    });
});

// ==================== DUPLICATE ROUTES ====================
router.get('/summary', getDuplicateSummary);
router.get('/detailed-summary', getDetailedDuplicateSummary);
router.get('/all', getAllDuplicates);
router.get('/export/excel', exportDuplicatesToExcel);
router.get('/type/:type', getDuplicatesByType);
router.get('/coach/:coachCode', getDuplicatesForCoachCode);

// ==================== UTILITY ROUTES ====================
router.get('/download/:fileName', downloadExcel);

export default router;
