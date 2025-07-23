import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from '../database/config/db.js';
import { SmartSeeder } from './services/smartSeeder.js';
import discrepancyRoutes from './routes/prsMdmsDiscrepancyRoutes.js';
import duplicateRoutes from './routes/prsMdmsDuplicateRoutes.js';
import smartSeederRoutes from './routes/smartSeederRoutes.js';
import { setSmartSeederInstance } from './controllers/prsMdmsController.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize smart seeder with corrected path
const smartSeeder = new SmartSeeder({
  watchDirectory: './database/excel', // Fixed to match your actual file location
  seederPath: 'database/ingestion/prsMdmsDataSeeder.js',
  filePattern: /\.(xlsx|xls)$/i,
  debounceTime: 3000
});

// Routes
app.use('/api/discrepancies', discrepancyRoutes);
app.use('/api/duplicates', duplicateRoutes);
app.use('/api/seeder', smartSeederRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'PRS vs MDMS Analysis API with Smart Seeder is running',
    version: '4.0.0',
    features: [
      'Smart File Watching',
      'Automatic Whitespace Cleanup',
      'Intelligent Seeding',
      'Discrepancy Detection',
      'Duplicate Analysis',
      'Excel Export',
      'Manual Seeder Control'
    ],
    timestamp: new Date().toISOString()
  });
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'PRS vs MDMS Analysis API Documentation',
    version: '4.0.0',
    baseUrl: `http://localhost:${PORT}`,
    endpoints: {
      health: 'GET /health',
      documentation: 'GET /api',
      smartSeeder: {
        main: 'GET /api/seeder/',
        status: 'GET /api/seeder/status',
        config: 'GET /api/seeder/config',
        history: 'GET /api/seeder/history',
        forceSeeding: 'POST /api/seeder/force',
        resetHashes: 'POST /api/seeder/reset',
        stop: 'POST /api/seeder/stop',
        start: 'POST /api/seeder/start'
      },
      discrepancies: {
        main: 'GET /api/discrepancies/',
        summary: 'GET /api/discrepancies/summary',
        all: 'GET /api/discrepancies/all',
        detailedSummary: 'GET /api/discrepancies/detailed-summary',
        byType: 'GET /api/discrepancies/type/{TYPE_MISMATCH|MISSING_IN_PRS|MISSING_IN_MDMS}',
        byCoach: 'GET /api/discrepancies/coach/{coachCode}',
        export: 'GET /api/discrepancies/export/excel?detailed=true',
        download: 'GET /api/discrepancies/download/{fileName}',
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

// 404 handler - Fixed the route pattern
app.use('*checkall', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      '/health',
      '/api',
      '/api/seeder/*',
      '/api/discrepancies/*',
      '/api/duplicates/*'
    ],
    timestamp: new Date().toISOString()
  });
});

// Initialize application
(async () => {
  try {
    console.log('🔧 Initializing database...');
    await initDb();
    console.log('✅ Database initialized successfully');
    
    console.log('🤖 Initializing smart seeder...');
    await smartSeeder.initialize();
    console.log('✅ Smart seeder initialized successfully');
    
    // Set the smart seeder instance for the controller
    setSmartSeederInstance(smartSeeder);
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 PRS vs MDMS Analysis API running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🤖 Smart Seeder API: http://localhost:${PORT}/api/seeder/`);
      console.log(`📚 API documentation: http://localhost:${PORT}/api`);
      console.log(`👁️ Smart seeder monitoring: ${smartSeeder.config.watchDirectory}`);
      console.log(`🔍 Watching for changes in: ${smartSeeder.config.watchDirectory}`);
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('🔄 Shutting down gracefully...');
      smartSeeder.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('🔄 Received SIGTERM, shutting down gracefully...');
      smartSeeder.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to initialize application:', error);
    process.exit(1);
  }
})();

export default app;
