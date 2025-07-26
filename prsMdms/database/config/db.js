import pkg from 'pg';
const { Pool } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool = null;

// Initialize PostgreSQL connection
export async function initDb() {
  try {
    // Create connection pool
    pool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'prs_mdms_db',
      password: process.env.DB_PASSWORD || 'password',
      port: process.env.DB_PORT || 5432,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Test connection
    const client = await pool.connect();
    console.log('✅ PostgreSQL connection established');
    client.release();
    
    // Create tables using your SQL schema
    await createTables();
    
    return pool;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Execute SQL schema file
async function createTables() {
  try {
    const schemaPath = path.join(__dirname, '../prsMdms.sql');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`SQL schema file not found: ${schemaPath}`);
    }
    
    console.log('📄 Reading SQL schema file:', schemaPath);
    const sqlContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Split SQL statements (in case there are multiple)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log('🔧 Executing SQL schema...');
    for (const statement of statements) {
      await pool.query(statement);
    }
    
    console.log('✅ Database tables created/verified using SQL schema');
  } catch (error) {
    console.error('❌ Table creation failed:', error);
    throw error;
  }
}

// Query function to execute SQL with parameters
export async function query(text, params = []) {
  if (!pool) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error('❌ Query execution failed:', error);
    console.error('SQL:', text);
    console.error('Params:', params);
    throw error;
  }
}

// Get pool instance
export function getPool() {
  if (!pool) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return pool;
}

// Close database connection
export async function closeDb() {
  if (pool) {
    await pool.end();
    console.log('✅ PostgreSQL connection pool closed');
  }
}