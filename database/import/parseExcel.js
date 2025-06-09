import * as XLSX from 'xlsx';
import fs from 'fs';
import { query } from '../config/db';

export async function parseAndInsertExcel(filePath: string) {
  try {
    console.log(` Reading Excel file: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found: ${filePath}`);
    }

    const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });

    // Debug: List all available sheets
    console.log(' Available sheets in Excel file:', workbook.SheetNames);

    /** PRS Sheet: BerthDetails**/
    console.log(' Processing PRS sheet...');
    const prsSheet = workbook.Sheets['PRS'];
    
    if (!prsSheet) {
      throw new Error('PRS sheet not found in Excel file');
    }
    
    const PRS = XLSX.utils.sheet_to_json(prsSheet, { defval: null });
    console.log(`Found ${PRS.length} rows in PRS sheet`);

    for (const [index, row] of PRS.entries()) {
      const {
        'S. No.': serialNo,
        'Coach Code': coachCode,
        'Composite Flag': compositeFlag,
        'Class': cls,
        'Berth Number': berthNumber,
        'Berth Type': berthType,
      } = row as Record<string, any>;

      await query(
        `INSERT INTO berths (serial_no, coach_code, composite_flag, class, berth_number, berth_type)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          Number(serialNo),
          coachCode,
          parseBoolean(compositeFlag),
          cls,
          Number(berthNumber),
          berthType,
        ]
      );
      
      if ((index + 1) % 100 === 0) {
        console.log(`Inserted ${index + 1} berth records...`);
      }
    }

    /** MDMS Sheet: CoachLayouts **/
    console.log(' Processing MDMS sheet...');
    const mdmsSheet = workbook.Sheets['MDMS'];
    
    if (!mdmsSheet) {
      throw new Error('MDMS sheet not found in Excel file');
    }
    
    const MDMS = XLSX.utils.sheet_to_json(mdmsSheet, { defval: null });
    console.log(`Found ${MDMS.length} rows in MDMS sheet`);

    for (const [index, row] of MDMS.entries()) {
      const {
        'S. No.': serialNo,
        layout_variant_no,
        composite_flag,
        coach_class_first,
        coach_class_second,
        prs_coach_code,
        coach_class,
        berth_no,
        berth_qualifier,
      } = row as Record<string, any>;

      await query(
        `INSERT INTO coach_layouts (
          serial_no, layout_variant_no, composite_flag, coach_class_first,
          coach_class_second, prs_coach_code, coach_class, berth_no, berth_qualifier
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          Number(serialNo),
          layout_variant_no,
          parseBoolean(composite_flag),
          coach_class_first,
          coach_class_second,
          prs_coach_code,
          coach_class,
          Number(berth_no),
          berth_qualifier,
        ]
      );
      
      if ((index + 1) % 100 === 0) {
        console.log(`Inserted ${index + 1} coach layout records...`);
      }
    }

    console.log(' PRS and MDMS data inserted successfully.');
  } catch (error) {
    console.error(' Failed to parse and insert Excel data:', error);
    throw error;
  }
}

function parseBoolean(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.trim().toLowerCase() === 'y' || val === 'true';
  return false;
}
