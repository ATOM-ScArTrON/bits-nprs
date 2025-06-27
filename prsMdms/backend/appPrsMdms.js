import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from '../database/config/db.js';
import discrepancyRoutes from './routes/prsMdmsRoutes.js';

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'PRS vs MDMS Comparison API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use('*catachall', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Route ${req.originalUrl} not found`
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
      console.log(`🚀 PRS vs MDMS Comparison API running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:3000/health`);
      console.log(`🔍 API endpoints: http://localhost:3000/api/discrepancies/`);
    });
    
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    console.error('💡 Make sure PostgreSQL is running and your .env file has correct database credentials');
    process.exit(1);
  }
})();

export default app;