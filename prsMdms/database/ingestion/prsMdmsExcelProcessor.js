import ExcelJS from 'exceljs';
import fs from 'fs';
import { query } from '../config/db.js';

export async function parseAndInsertExcel(filePath) {
  try {
    console.log(`📖 Reading Excel file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found: ${filePath}`);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    console.log('📋 Available sheets in Excel file:', workbook.worksheets.map(ws => ws.name));

    await query('BEGIN');

    try {
      console.log('🗑️ Clearing existing data...');
      await query('DELETE FROM prs');
      await query('DELETE FROM mdms');

      // PRS Sheet Processing
      console.log('📊 Processing PRS sheet...');
      const prsSheet = workbook.getWorksheet('PRS');
      
      if (!prsSheet) {
        throw new Error('PRS sheet not found in Excel file');
      }

      const PRS = [];
      
      prsSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        // Skip header row
        if (rowNumber === 1) {
          console.log('📋 PRS Headers:', row.values.slice(1, 7)); // Only show actual data columns
          return;
        }
        
        const rowValues = row.values;
        const serialNo = rowValues[1];
        const coachCode = rowValues[2];
        
        // Skip rows where serial_no is not a number or contains header-like data
        if (!serialNo || isNaN(Number(serialNo)) || coachCode === 'Coach Code') {
          console.warn(`⚠️ Skipping invalid PRS row ${rowNumber}: serialNo=${serialNo}, coachCode=${coachCode}`);
          return;
        }
        
        // Only process columns 1-6 (ignore SQL query columns 7-8)
        PRS.push({
          'S. No.': rowValues[1],
          'Coach Code': rowValues[2],
          'Composite Flag': rowValues[3],
          'Class': rowValues[4],
          'Berth Number': rowValues[5],
          'Berth Type': rowValues[6],
        });
      });

      console.log(`Found ${PRS.length} valid rows in PRS sheet`);

      // Process PRS data
      for (const [index, row] of PRS.entries()) {
        const {
          'S. No.': serialNo,
          'Coach Code': coachCode,
          'Composite Flag': compositeFlag,
          'Class': cls,
          'Berth Number': berthNumber,
          'Berth Type': berthType,
        } = row;

        // Enhanced validation
        if (!serialNo || !coachCode || isNaN(Number(serialNo))) {
          console.warn(`⚠️ Skipping PRS row ${index + 1}: Invalid serialNo (${serialNo}) or coachCode (${coachCode})`);
          continue;
        }

        // Convert and validate numeric fields
        const validSerialNo = Number(serialNo);
        const validBerthNumber = berthNumber && !isNaN(Number(berthNumber)) ? Number(berthNumber) : null;

        await query(
          `INSERT INTO prs (serial_no, coach_code, composite_flag, class, berth_number, berth_type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            validSerialNo,
            coachCode,
            parseBoolean(compositeFlag),
            cls,
            validBerthNumber,
            berthType,
          ]
        );
        
        if ((index + 1) % 100 === 0) {
          console.log(`✅ Inserted ${index + 1} PRS records...`);
        }
      }

      // MDMS Sheet Processing
      console.log('📊 Processing MDMS sheet...');
      const mdmsSheet = workbook.getWorksheet('MDMS');
      
      if (!mdmsSheet) {
        throw new Error('MDMS sheet not found in Excel file');
      }

      const MDMS = [];
      
      mdmsSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        // Skip header row
        if (rowNumber === 1) {
          console.log('📋 MDMS Headers:', row.values.slice(1, 10)); // Only show actual data columns
          return;
        }
        
        const rowValues = row.values;
        const serialNo = rowValues[1];
        
        // Skip invalid rows
        if (!serialNo || isNaN(Number(serialNo))) {
          console.warn(`⚠️ Skipping invalid MDMS row ${rowNumber}: serialNo=${serialNo}`);
          return;
        }
        
        // Only process columns 1-9 (ignore SQL query columns 10-12)
        MDMS.push({
          'S. No.': rowValues[1],
          'layout_variant_no': rowValues[2],
          'composite_flag': rowValues[3],
          'coach_class_first': rowValues[4],
          'coach_class_second': rowValues[5],
          'prs_coach_code': rowValues[6],
          'coach_class': rowValues[7],
          'berth_no': rowValues[8],
          'berth_qualifier': rowValues[9],
        });
      });

      console.log(`Found ${MDMS.length} valid rows in MDMS sheet`);

      // Process MDMS data
      for (const [index, row] of MDMS.entries()) {
        const {
          'S. No.': serialNo,
          'layout_variant_no': layoutVariantNo,
          'composite_flag': compositeFlag,
          'coach_class_first': coachClassFirst,
          'coach_class_second': coachClassSecond,
          'prs_coach_code': prsCoachCode,
          'coach_class': coachClass,
          'berth_no': berthNo,
          'berth_qualifier': berthQualifier,
        } = row;

        // Validate required fields
        if (!serialNo || isNaN(Number(serialNo))) {
          console.warn(`⚠️ Skipping MDMS row ${index + 1}: Invalid serialNo (${serialNo})`);
          continue;
        }

        // Convert and validate numeric fields
        const validSerialNo = Number(serialNo);
        const validBerthNo = berthNo && !isNaN(Number(berthNo)) ? Number(berthNo) : null;

        await query(
          `INSERT INTO mdms (
            serial_no, layout_variant_no, composite_flag, coach_class_first,
            coach_class_second, prs_coach_code, coach_class, berth_no, berth_qualifier
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            validSerialNo,
            layoutVariantNo,
            parseBoolean(compositeFlag),
            coachClassFirst,
            coachClassSecond,
            prsCoachCode,
            coachClass,
            validBerthNo,
            berthQualifier,
          ]
        );
        
        if ((index + 1) % 100 === 0) {
          console.log(`✅ Inserted ${index + 1} MDMS records...`);
        }
      }

      await query('COMMIT');
      console.log('🎉 PRS and MDMS data inserted successfully.');
      
      const prsCount = await query('SELECT COUNT(*) as count FROM prs');
      const mdmsCount = await query('SELECT COUNT(*) as count FROM mdms');
      console.log(`📈 Summary: ${prsCount.rows[0].count} PRS records, ${mdmsCount.rows[0].count} MDMS records inserted.`);
      
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('❌ Failed to parse and insert Excel data:', error);
    throw error;
  }
}

function parseBoolean(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const trimmed = val.trim().toLowerCase();
    return trimmed === 'y' || trimmed === 'yes' || trimmed === 'true' || trimmed === '1';
  }
  if (typeof val === 'number') return val === 1;
  return false;
}
