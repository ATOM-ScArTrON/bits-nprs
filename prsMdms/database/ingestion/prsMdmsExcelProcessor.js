import ExcelJS from 'exceljs';
import fs from 'fs';
import { query } from '../config/db.js';

function cleanTextData(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function cleanRowData(row) {
  const cleaned = {};
  for (const key in row) {
    cleaned[key] = cleanTextData(row[key]);
  }
  return cleaned;
}

function parseBoolean(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const v = val.trim().toLowerCase();
    return ['y', 'yes', 'true', '1'].includes(v);
  }
  return !!val;
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export async function parseAndInsertExcel(filePath) {
  try {
    console.log(`📖 Reading Excel file: ${filePath}`);
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    await query('BEGIN');
    try {
      await query('DELETE FROM prs');
      await query('DELETE FROM mdms');

      const prsSheet = workbook.getWorksheet('PRS');
      const mdmsSheet = workbook.getWorksheet('MDMS');
      if (!prsSheet || !mdmsSheet) throw new Error('Missing PRS or MDMS sheet');

      const PRS = [];
      prsSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const r = row.values;
        if (!r[1] || isNaN(Number(r[1]))) return;
        PRS.push({
          'S. No.': r[1],
          'Coach Code': r[2],
          'Composite Flag': r[3],
          'Class': r[4],
          'Berth Number': r[5],
          'Berth Type': r[6],
        });
      });

      const MDMS = [];
      mdmsSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const r = row.values;
        if (!r[1] || isNaN(Number(r[1]))) return;
        MDMS.push({
          'S. No.': r[1],
          'layout_variant_no': r[2],
          'composite_flag': r[3],
          'coach_class_first': r[4],
          'coach_class_second': r[5],
          'prs_coach_code': r[6],
          'coach_class': r[7],
          'berth_no': r[8],
          'berth_qualifier': r[9],
        });
      });

      console.log(`🔢 PRS rows: ${PRS.length}, MDMS rows: ${MDMS.length}`);

      const insertChunked = async (rows, table, columns, formatter, chunkSize = 500) => {
        const chunks = chunkArray(rows, chunkSize);
        for (const [i, chunk] of chunks.entries()) {
          const values = [];
          const placeholders = chunk.map((row, rowIndex) => {
            const rowData = formatter(cleanRowData(row));
            values.push(...rowData);
            const offset = rowIndex * rowData.length;
            return `(${rowData.map((_, j) => `$${offset + j + 1}`).join(', ')})`;
          });

          const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`;
          await query(sql, values);
          console.log(`✅ Inserted chunk ${i + 1}/${chunks.length} into ${table}`);
        }
      };

      await insertChunked(
        PRS,
        'prs',
        ['serial_no', 'coach_code', 'composite_flag', 'class', 'berth_number', 'berth_type'],
        (row) => [
          Number(row['S. No.']),
          row['Coach Code'],
          parseBoolean(row['Composite Flag']),
          row['Class'],
          row['Berth Number'] && !isNaN(row['Berth Number']) ? Number(row['Berth Number']) : null,
          row['Berth Type']
        ]
      );

      await insertChunked(
        MDMS,
        'mdms',
        ['serial_no', 'layout_variant_no', 'composite_flag', 'coach_class_first', 'coach_class_second', 'prs_coach_code', 'coach_class', 'berth_no', 'berth_qualifier'],
        (row) => [
          Number(row['S. No.']),
          row['layout_variant_no'],
          parseBoolean(row['composite_flag']),
          row['coach_class_first'],
          row['coach_class_second'],
          row['prs_coach_code'],
          row['coach_class'],
          row['berth_no'] && !isNaN(row['berth_no']) ? Number(row['berth_no']) : null,
          row['berth_qualifier']
        ]
      );

      await query('COMMIT');
      console.log('🎉 All records inserted in chunks successfully!');
    } catch (err) {
      await query('ROLLBACK');
      console.error('❌ Insert failed. Rolled back.', err);
      throw err;
    }

  } catch (err) {
    console.error('❌ Excel parse & insert failed:', err);
    throw err;
  }
}
