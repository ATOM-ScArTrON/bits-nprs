import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from '../database/config/db.js';
import discrepancyRoutes from './routes/prsMdmsDiscrepancyRoutes.js';
import duplicateRoutes from './routes/prsMdmsDuplicateRoutes.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/discrepancies', discrepancyRoutes);
app.use('/api/duplicates', duplicateRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'PRS vs MDMS Analysis API is running',
    version: '2.0.0',
    features: [
      'Discrepancy Detection',
      'Duplicate Analysis', 
      'Excel Export',
      'Data Simulation'
    ],
    timestamp: new Date().toISOString()
  });
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'PRS vs MDMS Analysis API Documentation',
    version: '2.0.0',
    baseUrl: `http://localhost:${PORT}`,
    endpoints: {
      health: 'GET /health',
      documentation: 'GET /api',
      discrepancies: {
        main: 'GET /api/discrepancies/',
        summary: 'GET /api/discrepancies/summary',
        all: 'GET /api/discrepancies/all',
        detailedSummary: 'GET /api/discrepancies/detailed-summary',
        byType: 'GET /api/discrepancies/type/{TYPE_MISMATCH|MISSING_IN_PRS|MISSING_IN_MDMS}',
        byCoach: 'GET /api/discrepancies/coach/{coachCode}',
        export: 'GET /api/discrepancies/export/excel?detailed=true',
        download: `GET /api/discrepancies/download/${fileName}`,
        simulate: 'POST /api/discrepancies/simulate',
        restore: 'POST /api/discrepancies/restore'
      },
      duplicates: {
        main: 'GET /api/duplicates/',
        summary: 'GET /api/duplicates/summary',
        all: 'GET /api/duplicates/all',
        detailedSummary: 'GET /api/duplicates/detailed-summary',
        byType: 'GET /api/duplicates/type/{WITHIN_PRS|WITHIN_MDMS|CROSS_TABLE}',
        byCoach: 'GET /api/duplicates/coach/{coachCode}',
        export: 'GET /api/duplicates/export/excel',
        download: 'GET /api/duplicates/download/{fileName}'
      }
    },
    examples: {
      getDiscrepancySummary: `curl ${req.protocol}://${req.get('host')}/api/discrepancies/summary`,
      getDuplicateSummary: `curl ${req.protocol}://${req.get('host')}/api/duplicates/summary`,
      exportDiscrepancies: `curl ${req.protocol}://${req.get('host')}/api/discrepancies/export/excel`,
      exportDuplicates: `curl ${req.protocol}://${req.get('host')}/api/duplicates/export/excel`
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*checkall', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      '/health',
      '/api',
      '/api/discrepancies/*',
      '/api/duplicates/*'
    ],
    timestamp: new Date().toISOString()
  });
});

// ✅ INITIALIZE DATABASE BEFORE STARTING SERVER
(async () => {
  try {
    console.log('🔧 Initializing database...');
    await initDb();
    console.log('✅ Database initialized successfully');
    
    // Start server only after database is initialized
    app.listen(PORT, () => {
      console.log(`🚀 PRS vs MDMS Analysis API running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`📚 API documentation: http://localhost:${PORT}/api`);
      console.log(`🔍 Discrepancy endpoints: http://localhost:${PORT}/api/discrepancies/`);
      console.log(`🔄 Duplicate endpoints: http://localhost:${PORT}/api/duplicates/`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    console.error('💡 Make sure PostgreSQL is running and your .env file has correct database credentials');
    process.exit(1);
  }
})();

export default app;