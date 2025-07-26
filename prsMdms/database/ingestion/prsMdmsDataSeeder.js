import { initDb } from '../config/db.js';
import { parseAndInsertExcel } from './prsMdmsExcelProcessor.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(__dirname);

(async () => {
  try {
    console.log('🚀 Starting PRS and MDMS data seeding process...');

    const target = process.env.DB_TARGET;
    const allowDDL = process.env.ALLOW_TABLE_CREATION;

    if (target === 'remote') { // Target server should be local for seeding
      console.error('❌ Seeding not allowed on remote/production database');
      console.log('💡 This script should only run in local development mode');
      console.log('💡 Set DB_TARGET=local for development seeding');
      process.exit(1);
    }

    if (!allowDDL) { // ALLOW_TABLE_CREATION must be set to true for table creation
      console.error('❌ Table creation not allowed (ALLOW_TABLE_CREATION=false)');
      console.log('💡 Set ALLOW_TABLE_CREATION=true for development seeding');
      process.exit(1);
    }

    // Use relative path from project root or make it configurable
    const filePath = process.env.EXCEL_FILE_PATH ||
      path.resolve(process.cwd(), 'database/excel/MDMS_PRS_Differences_BerthQualifier.xlsx');;

    // Check if file exists before proceeding
    if (!fs.existsSync(filePath)) {
      console.error('❌ Excel file not found at:', filePath);
      console.log('💡 Please ensure the Excel file exists at the specified path.');
      console.log('💡 You can also set EXCEL_FILE_PATH environment variable to specify a different path.');
      process.exit(1);
    }

    console.log('📁 Using Excel file:', filePath);
    console.log('🔧 Creating/updating database tables...');

    // Initialize database (create tables if they don't exist)
    await initDb();
    console.log('✅ Database tables ready.');

    console.log('📊 Parsing Excel file and inserting data...');
    await parseAndInsertExcel(filePath);

    console.log('🎉 Data seeding completed successfully!');
    console.log('💾 PRS and MDMS data has been imported into the database.');

  } catch (error) {
    console.error('💥 Error during data seeding:', error.message);
    console.error('📋 Full error details:', error);
    process.exit(1);
  }
})();