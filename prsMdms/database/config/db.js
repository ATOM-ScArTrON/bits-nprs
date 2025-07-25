import pkg from 'pg';
const { Pool } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log

let localPool, remotePool = null;

// Initialize PostgreSQL connection
export async function initDb(target = 'local') {
  try {
    // Create localhost connection pool
    localPool = new Pool({
      user: process.env.LOCAL_DB_USER || 'postgres',
      host: process.env.LOCAL_DB_HOST || 'localhost',
      database: process.env.LOCAL_DB_NAME || 'prs_mdms_db',
      password: process.env.LOCAL_DB_PASSWORD || 'password',
      port: process.env.LOCAL_DB_PORT || 5432,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Test localhost connection
    const localClient = await localPool.connect();
    console.log('✅ Local DB PostgreSQL connection established');
    localClient.release();

    // Create remote connection pool
    remotePool = new Pool({
      user: process.env.REMOTE_DB_USER,
      host: process.env.REMOTE_DB_HOST,
      database: process.env.REMOTE_DB_NAME,
      password: process.env.REMOTE_DB_PASSWORD,
      port: process.env.REMOTE_DB_PORT,
      ssl: true,
    });

    // Test remote connection
    const remoteClient = await remotePool.connect();
    console.log('✅ Remote DB PostgreSQL connection established');
    remoteClient.release();
    
    // Create tables using your SQL schema
    await createTables(localPool);
    
    return { localPool, remotePool };
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Execute SQL schema file
async function createTables(pool) {
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
export async function query(text, params = [], target = 'local') {
  const pool = target === 'remote' ? remotePool : localPool;
  if (!pool) {
    throw new Error(`${target} Database not initialized`);
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
export function getPool(target = 'local') {
  const pool = target === 'remote' ? remotePool : localPool; 
  if (!pool) {
    throw new Error(`${target} database not initialized`);
  }
  return pool;
}

// Close database connection
export async function closeDb() {
  if (localPool) {
    await localPool.end();
    console.log('✅ Local PostgreSQL connection pool closed');
  }
  if (remotePool) {
    await remotePool.end();
    console.log('✅ Remote PostgreSQL connection pool closed');
  }
}