import pkg from 'pg';
const { Pool } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let localPool, remotePool = null;
const target = process.env.DB_TARGET; //Remote or Local Target Server
const allowDDL = process.env.ALLOW_TABLE_CREATION === 'true';

console.log(`🌐 Target database: ${target}`)

// Initialize PostgreSQL connection
export async function initDb() {
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
    if (target === 'remote') {

      // Create remote connection pool
      remotePool = new Pool({
        user: process.env.REMOTE_DB_USER,
        host: process.env.REMOTE_DB_HOST,
        database: process.env.REMOTE_DB_NAME,
        password: process.env.REMOTE_DB_PASSWORD,
        port: process.env.REMOTE_DB_PORT,
        ssl: {
          rejectUnauthorized: false,
        },
      });

      // Test remote connection
      const remoteClient = await remotePool.connect();
      console.log('✅ Remote DB PostgreSQL connection established');
      remoteClient.release();
    }

    // Determine target pool for DDL operations
    const targetPool = target === 'remote' ? remotePool : localPool;

    if (target === 'local' && allowDDL) {
      console.log('🔧 Table creation enabled via environment flag'); // Local table creation using your SQL schema
      await createTables(targetPool);
    } else if (target === 'remote') {
      console.log('⚠️ Production mode: Verifying tables exist (no creation)'); // Verification of tables on the remote server
      await verifyTablesExist(targetPool);
    } else {
      console.log('⚠️ Table creation DISABLED on this run'); // Disable automatic table creation on unless allowed
      await verifyTablesExist(targetPool);
    }

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

    // Verify tables were created
    await verifyTablesExist(pool);

    console.log('✅ Database tables created/verified using SQL schema');
  } catch (error) {
    console.error('❌ Table creation failed:', error);
    throw error;
  }
}

// Verify that required tables exist in the database
async function verifyTablesExist(pool) {
  try {
    console.log('🔍 Verifying table existence...');

    // Check if tables exist
    const checkTablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
        `;

    const result = await pool.query(checkTablesQuery);
    const existingTables = result.rows.map(row => row.table_name);

    console.log('📋 Tables found:', existingTables);

    if (!existingTables.includes('prs')) {
      throw new Error('❌ PRS table not found in database. Please contact DB admin or enable table creation.');
    }
    if (!existingTables.includes('mdms')) {
      throw new Error('❌ MDMS table not found in database. Please contact DB admin or enable table creation.');
    }

    console.log('✅ Required tables verified in database');
    return true;
  } catch (error) {
    console.error('❌ Table verification failed:', error);
    throw error;
  }
}

// Query function to execute SQL with parameters
export async function query(text, params = []) {
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
export function getPool() {
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