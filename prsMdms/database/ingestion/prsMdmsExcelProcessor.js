import ExcelJS from 'exceljs';
import fs from 'fs';
import crypto from 'crypto';
import { query } from '../config/db.js';

const CONFIG = {
  CHUNK_SIZE: 3000,
  COUNT_DIFFERENCE_THRESHOLD: 50
};

const PRS_COLS = ['serial_no', 'coach_code', 'composite_flag', 'class', 'berth_number', 'berth_type'];
const MDMS_COLS = ['serial_no', 'layout_variant_no', 'composite_flag', 'coach_class_first', 'coach_class_second', 'prs_coach_code', 'coach_class', 'berth_no', 'berth_qualifier'];

const PRS_HASH_FIELDS = ['coach_code', 'composite_flag', 'class', 'berth_number', 'berth_type'];
const MDMS_HASH_FIELDS = ['layout_variant_no', 'composite_flag', 'coach_class_first', 'coach_class_second', 'prs_coach_code', 'coach_class', 'berth_no', 'berth_qualifier'];

const clean = v => typeof v === 'string' ? v.trim() : v;
const bool = v => ['y', 'yes', 'true', '1'].includes((v ?? '').toString().toLowerCase());

export async function parseAndInsertExcel(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Excel file not found: ${filePath}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  await query('BEGIN');

  try {
    const { isReplacement } = await analyzeForReplacement(workbook);

    if (isReplacement) {
      console.log('🔄 Full replacement triggered...');
      await query('DELETE FROM prs');
      await query('DELETE FROM mdms');
      await processSheet(workbook, 'PRS', 'prs', PRS_COLS);
      await processSheet(workbook, 'MDMS', 'mdms', MDMS_COLS);
    } else {
      console.log('🧠 Performing incremental upsert...');
      await incrementalUpsert(workbook, 'PRS', 'prs', PRS_COLS, PRS_HASH_FIELDS);
      await incrementalUpsert(workbook, 'MDMS', 'mdms', MDMS_COLS, MDMS_HASH_FIELDS);
    }

    await query('COMMIT');
    console.log('✅ Import successful');
  } catch (err) {
    await query('ROLLBACK');
    console.error('❌ Import failed:', err);
    throw err;
  }
}

function generateRecordHash(record, fields) {
  const str = fields.map(f => String(record[f] ?? '').trim().toLowerCase()).join('|');
  return crypto.createHash('md5').update(str).digest('hex');
}

async function analyzeForReplacement(workbook) {
  const checks = [
    { sheet: 'PRS', table: 'prs' },
    { sheet: 'MDMS', table: 'mdms' }
  ];

  for (const { sheet, table } of checks) {
    const ws = workbook.getWorksheet(sheet);
    const newCount = ws ? ws.rowCount - 1 : 0;
    const res = await query(`SELECT COUNT(*) AS cnt FROM ${table}`);
    const existingCount = Number(res.rows[0].cnt);

    if (existingCount === 0 && newCount > 0) return { isReplacement: true };

    const diffPct = existingCount > 0 ? Math.abs(newCount - existingCount) / existingCount * 100 : 0;
    if (diffPct > CONFIG.COUNT_DIFFERENCE_THRESHOLD) return { isReplacement: true };
  }

  return { isReplacement: false };
}

async function processSheet(workbook, sheetName, tableName, columns) {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) return;

  const records = [];
  sheet.eachRow((row, idx) => {
    if (idx === 1) return;
    const rec = parseRow(row.values, tableName);
    if (rec) records.push(rec);
  });

  await batchInsert(tableName, columns, records);
}

async function incrementalUpsert(workbook, sheetName, tableName, columns, hashFields) {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) return;

  const records = [];
  sheet.eachRow((row, idx) => {
    if (idx === 1) return;
    const rec = parseRow(row.values, tableName);
    if (rec) {
      rec._hash = generateRecordHash(rec, hashFields);
      records.push(rec);
    }
  });

  const chunks = chunkArray(records, CONFIG.CHUNK_SIZE);
  for (const chunk of chunks) {
    const values = [];
    const placeholders = chunk.map((rec, i) => {
      const offset = i * columns.length;
      values.push(...columns.map(c => rec[c]));
      return `(${columns.map((_, j) => `$${offset + j + 1}`).join(', ')})`;
    });

    const updateCols = columns.filter(c => c !== 'serial_no');
    const setClause = updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ');
    const whereClause = updateCols.map(c => `${tableName}.${c} IS DISTINCT FROM EXCLUDED.${c}`).join(' OR ');

    const sql = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (serial_no) DO UPDATE
      SET ${setClause}
      WHERE ${whereClause};
    `;

    await query(sql, values);
  }
}

async function batchInsert(table, columns, data) {
  const chunks = chunkArray(data, CONFIG.CHUNK_SIZE);
  for (const chunk of chunks) {
    const values = [];
    const placeholders = chunk.map((rec, i) => {
      const offset = i * columns.length;
      values.push(...columns.map(c => rec[c]));
      return `(${columns.map((_, j) => `$${offset + j + 1}`).join(', ')})`;
    });

    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`;
    await query(sql, values);
  }
}

function chunkArray(arr, size) {
  const res = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}

function parseRow(values, table) {
  if (!values[1] || isNaN(Number(values[1]))) return null;

  if (table === 'prs') {
    return {
      serial_no: Number(values[1]),
      coach_code: clean(values[2]),
      composite_flag: bool(values[3]),
      class: clean(values[4]),
      berth_number: values[5] != null ? Number(values[5]) : null,
      berth_type: clean(values[6])
    };
  } else {
    return {
      serial_no: Number(values[1]),
      layout_variant_no: clean(values[2]),
      composite_flag: bool(values[3]),
      coach_class_first: clean(values[4]),
      coach_class_second: clean(values[5]),
      prs_coach_code: clean(values[6]),
      coach_class: clean(values[7]),
      berth_no: values[8] != null ? Number(values[8]) : null,
      berth_qualifier: clean(values[9])
    };
  }
}
