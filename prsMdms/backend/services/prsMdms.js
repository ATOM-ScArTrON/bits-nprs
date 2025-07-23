import { query } from '../../database/config/db.js';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

export class DiscrepancyService {

  /**
   * Generate SQL files for all discrepancy types
   */
  async generateDiscrepancySQL() {
    try {
      console.log('📝 Generating SQL files for discrepancies...');

      const sqlQueries = {
        typeMismatch: `
-- Type Mismatch Discrepancies
-- Records where berth type in PRS doesn't match berth qualifier in MDMS
SELECT 
  p.serial_no,
  p.coach_code,
  p.class as prs_class,
  p.berth_number,
  p.berth_type,
  m.berth_qualifier,
  m.coach_class as mdms_class,
  'TYPE_MISMATCH' as discrepancy_type,
  CONCAT('PRS berth type ''', p.berth_type, ''' doesn''t match MDMS berth qualifier ''', m.berth_qualifier, '''') as details
FROM prs p
INNER JOIN mdms m
  ON TRIM(LOWER(p.coach_code)) = TRIM(LOWER(m.prs_coach_code))
  AND TRIM(LOWER(p.class)) = TRIM(LOWER(m.coach_class))
  AND p.berth_number::INT = m.berth_no
WHERE p.berth_type != m.berth_qualifier
ORDER BY p.coach_code, p.berth_number;
`,

        missingInMdms: `
-- Missing in MDMS
-- Records that exist in PRS but not in MDMS
SELECT 
  p.serial_no,
  p.coach_code,
  p.class as prs_class,
  p.berth_number,
  p.berth_type,
  'N/A' as berth_qualifier,
  'MISSING_IN_MDMS' as discrepancy_type,
  CONCAT('PRS record (', p.coach_code, ', class ', p.class, ', berth ', p.berth_number, ') not found in MDMS') as details
FROM prs p
LEFT JOIN mdms m 
  ON TRIM(LOWER(p.coach_code)) = TRIM(LOWER(m.prs_coach_code))
  AND TRIM(LOWER(p.class)) = TRIM(LOWER(m.coach_class))
  AND p.berth_number::INT = m.berth_no
WHERE m.serial_no IS NULL
ORDER BY p.coach_code, p.berth_number;
`,

        missingInPrs: `
-- Missing in PRS
-- Records that exist in MDMS but not in PRS
SELECT 
  m.serial_no,
  m.prs_coach_code as coach_code,
  m.coach_class as mdms_class,
  m.berth_no as berth_number,
  'N/A' as berth_type,
  m.berth_qualifier,
  'MISSING_IN_PRS' as discrepancy_type,
  CONCAT('MDMS record (', m.prs_coach_code, ', class ', m.coach_class, ', berth ', m.berth_no, ') not found in PRS') as details
FROM mdms m
LEFT JOIN prs p 
  ON TRIM(LOWER(m.prs_coach_code)) = TRIM(LOWER(p.coach_code))
  AND TRIM(LOWER(m.coach_class)) = TRIM(LOWER(p.class))
  AND m.berth_no = p.berth_number::INT
WHERE p.serial_no IS NULL
ORDER BY m.prs_coach_code, m.berth_no;
`,

        allDiscrepancies: `
-- All Discrepancies Combined
-- Union of all discrepancy types
WITH type_mismatches AS (
  SELECT 
    p.serial_no,
    p.coach_code,
    p.class as prs_class,
    m.coach_class as mdms_class,
    p.berth_number,
    p.berth_type,
    m.berth_qualifier,
    'TYPE_MISMATCH' as discrepancy_type,
    CONCAT('PRS berth type ''', p.berth_type, ''' doesn''t match MDMS berth qualifier ''', m.berth_qualifier, '''') as details
  FROM prs p
  INNER JOIN mdms m
    ON TRIM(LOWER(p.coach_code)) = TRIM(LOWER(m.prs_coach_code))
    AND TRIM(LOWER(p.class)) = TRIM(LOWER(m.coach_class))
    AND p.berth_number::INT = m.berth_no
  WHERE p.berth_type != m.berth_qualifier
),
missing_in_mdms AS (
  SELECT 
    p.serial_no,
    p.coach_code,
    p.class as prs_class,
    NULL as mdms_class,
    p.berth_number,
    p.berth_type,
    'N/A' as berth_qualifier,
    'MISSING_IN_MDMS' as discrepancy_type,
    CONCAT('PRS record (', p.coach_code, ', class ', p.class, ', berth ', p.berth_number, ') not found in MDMS') as details
  FROM prs p
  LEFT JOIN mdms m 
    ON TRIM(LOWER(p.coach_code)) = TRIM(LOWER(m.prs_coach_code))
    AND TRIM(LOWER(p.class)) = TRIM(LOWER(m.coach_class))
    AND p.berth_number::INT = m.berth_no
  WHERE m.serial_no IS NULL
),
missing_in_prs AS (
  SELECT 
    m.serial_no,
    m.prs_coach_code as coach_code,
    NULL as prs_class,
    m.coach_class as mdms_class,
    m.berth_no as berth_number,
    'N/A' as berth_type,
    m.berth_qualifier,
    'MISSING_IN_PRS' as discrepancy_type,
    CONCAT('MDMS record (', m.prs_coach_code, ', class ', m.coach_class, ', berth ', m.berth_no, ') not found in PRS') as details
  FROM mdms m
  LEFT JOIN prs p 
    ON TRIM(LOWER(m.prs_coach_code)) = TRIM(LOWER(p.coach_code))
    AND TRIM(LOWER(m.coach_class)) = TRIM(LOWER(p.class))
    AND m.berth_no = p.berth_number::INT
  WHERE p.serial_no IS NULL
)
SELECT * FROM type_mismatches
UNION ALL
SELECT * FROM missing_in_mdms
UNION ALL
SELECT * FROM missing_in_prs
ORDER BY discrepancy_type, coach_code, berth_number;
`
      };

      const sqlDir = path.join(process.cwd(), 'sql_exports');
      if (!fs.existsSync(sqlDir)) {
        fs.mkdirSync(sqlDir, { recursive: true });
      }

      const timestamp = this.getTimestamp();
      const sqlFiles = [];

      for (const [type, sqlQuery] of Object.entries(sqlQueries)) {
        const fileName = `discrepancy_${type}_${timestamp}.sql`;
        const filePath = path.join(sqlDir, fileName);

        fs.writeFileSync(filePath, sqlQuery.trim());
        sqlFiles.push(fileName);
        console.log(`✅ Created SQL file: ${fileName}`);
      }

      return sqlFiles;

    } catch (error) {
      console.error('Error generating discrepancy SQL files:', error);
      throw error;
    }
  }

  /**
   * Generate timestamp for file naming
   */
  getTimestamp() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
  }


  /**
   * Find all discrepancies between PRS and MDMS tables
   */
  async findDiscrepancies() {
    try {
      console.log('🔍 Starting improved discrepancy analysis...');

      // Generate SQL files first
      await this.generateDiscrepancySQL();

      const discrepancies = [];

      // Query 1: Type Mismatch
      const typeMismatchQuery = `
      SELECT 
        p.serial_no,
        p.coach_code,
        p.class,
        p.berth_number,
        p.berth_type,
        m.berth_qualifier,
        m.coach_class
      FROM prs p
      INNER JOIN mdms m
        ON TRIM(LOWER(p.coach_code)) = TRIM(LOWER(m.prs_coach_code))
        AND TRIM(LOWER(p.class)) = TRIM(LOWER(m.coach_class))
        AND p.berth_number::INT = m.berth_no
      WHERE p.berth_type != m.berth_qualifier
    `;

      const typeMismatchResult = await query(typeMismatchQuery);
      console.log(`⚠️ Found ${typeMismatchResult.rows.length} type mismatches`);

      for (const row of typeMismatchResult.rows) {
        discrepancies.push({
          serialNo: row.serial_no,
          coachCode: row.coach_code,
          prsClass: row.class,
          mdmsClass: row.coach_class,
          berthNumber: row.berth_number,
          berthType: row.berth_type,
          berthQualifier: row.berth_qualifier,
          discrepancyType: 'TYPE_MISMATCH',
          details: `PRS berth type '${row.berth_type}' doesn't match MDMS berth qualifier '${row.berth_qualifier}'`
        });
      }

      // Query 2: Missing in MDMS
      const missingInMdmsQuery = `
      SELECT 
        p.serial_no,
        p.coach_code,
        p.class,
        p.berth_number,
        p.berth_type
      FROM prs p
      LEFT JOIN mdms m 
        ON TRIM(LOWER(p.coach_code)) = TRIM(LOWER(m.prs_coach_code))
        AND TRIM(LOWER(p.class)) = TRIM(LOWER(m.coach_class))
        AND p.berth_number::INT = m.berth_no
      WHERE m.serial_no IS NULL
    `;

      const missingInMdmsResult = await query(missingInMdmsQuery);
      console.log(`🚫 Found ${missingInMdmsResult.rows.length} records missing in MDMS`);

      for (const row of missingInMdmsResult.rows) {
        discrepancies.push({
          serialNo: row.serial_no,
          coachCode: row.coach_code,
          prsClass: row.class,
          berthNumber: row.berth_number,
          berthType: row.berth_type,
          berthQualifier: 'N/A',
          discrepancyType: 'MISSING_IN_MDMS',
          details: `PRS record (${row.coach_code}, class ${row.class}, berth ${row.berth_number}) not found in MDMS`
        });
      }

      // Query 3: Missing in PRS
      const missingInPrsQuery = `
      SELECT 
        m.serial_no,
        p.coach_code,
        m.coach_class,
        m.berth_no AS berth_number,
        m.berth_qualifier
      FROM mdms m
      LEFT JOIN prs p 
        ON TRIM(LOWER(m.prs_coach_code)) = TRIM(LOWER(p.coach_code))
        AND TRIM(LOWER(m.coach_class)) = TRIM(LOWER(p.class))
        AND m.berth_no = p.berth_number::INT
      WHERE p.serial_no IS NULL
    `;

      const missingInPrsResult = await query(missingInPrsQuery);
      console.log(`🚫 Found ${missingInPrsResult.rows.length} records missing in PRS`);

      for (const row of missingInPrsResult.rows) {
        discrepancies.push({
          serialNo: row.serial_no,
          coachCode: row.coach_code,
          mdmsClass: row.coach_class,
          berthNumber: row.berth_number,
          berthType: 'N/A',
          berthQualifier: row.berth_qualifier,
          discrepancyType: 'MISSING_IN_PRS',
          details: `MDMS record (${row.coach_code}, class ${row.coach_class}, berth ${row.berth_number}) not found in PRS`
        });
      }

      console.log('✅ Discrepancy analysis complete');
      return {
        totalDiscrepancies: discrepancies.length,
        typeMismatchCount: typeMismatchResult.rows.length,
        missingInMdmsCount: missingInMdmsResult.rows.length,
        missingInPrsCount: missingInPrsResult.rows.length,
        discrepancies
      };

    } catch (error) {
      console.error('❌ Error in improved discrepancy analysis:', error);
      throw error;
    }
  }


  /**
   * Get discrepancies by type
   */
  async getDiscrepanciesByType(type) {
    const allDiscrepancies = await this.findDiscrepancies();
    return allDiscrepancies.discrepancies.filter(d => d.discrepancyType === type);
  }

  /**
 * Get discrepancies for a specific coach code
 */
  async getDiscrepanciesForCoachCode(coachCode) {
    const allDiscrepancies = await this.findDiscrepancies();

    // Filter discrepancies for the specified coach code (case-insensitive)
    const filteredDiscrepancies = allDiscrepancies.discrepancies.filter(d =>
      d.coachCode && d.coachCode.toString().trim().toLowerCase() === coachCode.toString().trim().toLowerCase()
    );

    return {
      coachCode: coachCode,
      count: filteredDiscrepancies.length,
      discrepancies: filteredDiscrepancies,
      message: filteredDiscrepancies.length === 0
        ? `No discrepancies found for coach code ${coachCode}`
        : `Found ${filteredDiscrepancies.length} discrepancies for coach code ${coachCode}`
    };
  }

  /**
   * Get summary statistics only
   */
  async getDiscrepancySummary() {
    const result = await this.findDiscrepancies();
    return {
      totalDiscrepancies: result.totalDiscrepancies,
      typeMismatchCount: result.typeMismatchCount,
      missingInPrsCount: result.missingInPrsCount,
      missingInMdmsCount: result.missingInMdmsCount
    };
  }

  /**
   * Get detailed summary with analytics
   */
  async getDetailedSummary() {
    try {
      const discrepancyResult = await this.findDiscrepancies();

      // Get total record counts
      const prsCountResult = await query('SELECT COUNT(*) as count FROM prs');
      const mdmsCountResult = await query('SELECT COUNT(*) as count FROM mdms');

      const totalPrsRecords = parseInt(prsCountResult.rows[0].count);
      const totalMdmsRecords = parseInt(mdmsCountResult.rows[0].count);
      const totalPossibleMatches = Math.max(totalPrsRecords, totalMdmsRecords);
      const matchingRecords = totalPossibleMatches - discrepancyResult.totalDiscrepancies;
      const dataQualityScore = (matchingRecords / totalPossibleMatches) * 100;

      return {
        overview: {
          totalPrsRecords,
          totalMdmsRecords,
          totalDiscrepancies: discrepancyResult.totalDiscrepancies,
          dataQualityScore: Math.round(dataQualityScore * 100) / 100
        },
        discrepancyBreakdown: {
          typeMismatchCount: discrepancyResult.typeMismatchCount,
          missingInPrsCount: discrepancyResult.missingInPrsCount,
          missingInMdmsCount: discrepancyResult.missingInMdmsCount,
          typeMismatchPercentage: Math.round((discrepancyResult.typeMismatchCount / discrepancyResult.totalDiscrepancies) * 10000) / 100,
          missingInPrsPercentage: Math.round((discrepancyResult.missingInPrsCount / discrepancyResult.totalDiscrepancies) * 10000) / 100,
          missingInMdmsPercentage: Math.round((discrepancyResult.missingInMdmsCount / discrepancyResult.totalDiscrepancies) * 10000) / 100
        }
      };

    } catch (error) {
      console.error('Error generating detailed summary:', error);
      throw error;
    }
  }

  /**
   * Export discrepancies to Excel file
   */  async exportDiscrepanciesToExcel(includeDetailedSummary = true) {
    try {
      console.log('📊 Generating Excel report...');
      const workbook = new ExcelJS.Workbook();
      const discrepancyData = await this.findDiscrepancies();

      // Summary Sheet
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 30 },
        { header: 'Value', key: 'value', width: 20 },
        { header: 'Percentage', key: 'percentage', width: 15 }
      ];
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      summarySheet.addRow({ metric: 'Total Discrepancies', value: discrepancyData.totalDiscrepancies, percentage: '100%' });
      summarySheet.addRow({
        metric: 'Type Mismatches',
        value: discrepancyData.typeMismatchCount,
        percentage: `${Math.round((discrepancyData.typeMismatchCount / discrepancyData.totalDiscrepancies) * 100)}%`
      });
      summarySheet.addRow({
        metric: 'Missing in PRS',
        value: discrepancyData.missingInPrsCount,
        percentage: `${Math.round((discrepancyData.missingInPrsCount / discrepancyData.totalDiscrepancies) * 100)}%`
      });
      summarySheet.addRow({
        metric: 'Missing in MDMS',
        value: discrepancyData.missingInMdmsCount,
        percentage: `${Math.round((discrepancyData.missingInMdmsCount / discrepancyData.totalDiscrepancies) * 100)}%`
      });

      // All Discrepancies Sheet
      const allSheet = workbook.addWorksheet('All Discrepancies');
      allSheet.columns = [
        { header: 'Serial No', key: 'serialNo', width: 12 },
        { header: 'Coach Code', key: 'coachCode', width: 15 },
        { header: 'PRS Coach Class', key: 'prsClass', width: 12 },
        { header: 'MDMS Coach Class', key: 'mdmsClass', width: 12 },
        { header: 'Berth Number', key: 'berthNumber', width: 12 },
        { header: 'PRS Berth Type', key: 'berthType', width: 15 },
        { header: 'MDMS Berth Qualifier', key: 'berthQualifier', width: 20 },
        { header: 'Discrepancy Type', key: 'discrepancyType', width: 20 },
        { header: 'Details', key: 'details', width: 60 }
      ];
      allSheet.getRow(1).font = { bold: true };
      allSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
      discrepancyData.discrepancies.forEach(d => allSheet.addRow(d));

      // Sheet: Type Mismatches
      const typeMismatchSheet = workbook.addWorksheet('Type Mismatches');
      typeMismatchSheet.columns = [
        { header: 'Serial No', key: 'serialNo', width: 12 },
        { header: 'Coach Code', key: 'coachCode', width: 15 },
        { header: 'PRS Class', key: 'prsClass', width: 12 },
        { header: 'MDMS Class', key: 'mdmsClass', width: 12 },
        { header: 'Berth Number', key: 'berthNumber', width: 12 },
        { header: 'PRS Berth Type', key: 'berthType', width: 15 },
        { header: 'MDMS Berth Qualifier', key: 'berthQualifier', width: 20 },
        { header: 'Details', key: 'details', width: 60 }
      ];
      typeMismatchSheet.getRow(1).font = { bold: true };
      typeMismatchSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

      discrepancyData.discrepancies
        .filter(d => d.discrepancyType === 'TYPE_MISMATCH')
        .forEach(d => {
          typeMismatchSheet.addRow({
            serialNo: d.serialNo,
            coachCode: d.coachCode,
            prsClass: d.prsClass,
            mdmsClass: d.mdmsClass,
            berthNumber: d.berthNumber,
            berthType: d.berthType,
            berthQualifier: d.berthQualifier,
            details: d.details
          });
        });

      // Sheet: Missing in PRS
      const missingInPrsSheet = workbook.addWorksheet('Missing in PRS');
      missingInPrsSheet.columns = [
        { header: 'Serial No', key: 'serialNo', width: 12 },
        { header: 'Coach Code', key: 'coachCode', width: 15 },
        { header: 'MDMS Class', key: 'mdmsClass', width: 12 },
        { header: 'Berth Number', key: 'berthNumber', width: 12 },
        { header: 'Berth Qualifier', key: 'berthQualifier', width: 20 },
        { header: 'Details', key: 'details', width: 60 }
      ];
      missingInPrsSheet.getRow(1).font = { bold: true };
      missingInPrsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

      discrepancyData.discrepancies
        .filter(d => d.discrepancyType === 'MISSING_IN_PRS')
        .forEach(d => {
          missingInPrsSheet.addRow({
            serialNo: d.serialNo,
            coachCode: d.coachCode,
            mdmsClass: d.mdmsClass,
            berthNumber: d.berthNumber,
            berthQualifier: d.berthQualifier,
            details: d.details
          });
        });

      // Sheet: Missing in MDMS
      const missingInMdmsSheet = workbook.addWorksheet('Missing in MDMS');
      missingInMdmsSheet.columns = [
        { header: 'Serial No', key: 'serialNo', width: 12 },
        { header: 'Coach Code', key: 'coachCode', width: 15 },
        { header: 'PRS Class', key: 'prsClass', width: 12 },
        { header: 'Berth Number', key: 'berthNumber', width: 12 },
        { header: 'Berth Type', key: 'berthType', width: 15 },
        { header: 'Details', key: 'details', width: 60 }
      ];
      missingInMdmsSheet.getRow(1).font = { bold: true };
      missingInMdmsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

      discrepancyData.discrepancies
        .filter(d => d.discrepancyType === 'MISSING_IN_MDMS')
        .forEach(d => {
          missingInMdmsSheet.addRow({
            serialNo: d.serialNo,
            coachCode: d.coachCode,
            prsClass: d.prsClass,
            berthNumber: d.berthNumber,
            berthType: d.berthType,
            details: d.details
          });
        });

      // Create exports dir if needed
      const exportsDir = path.join(process.cwd(), 'exports');
      if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });

      // Timestamped filename
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;

      const fileName = `prs-mdms-discrepancy-report-${timestamp}.xlsx`;
      const filePath = path.join(exportsDir, fileName);

      await workbook.xlsx.writeFile(filePath);
      console.log(`✅ Excel report saved: ${fileName}`);
      return fileName;

    } catch (error) {
      console.error('Error exporting to Excel:', error);
      throw error;
    }
  }
}

export class DuplicateService {

  /**
 * Generate SQL files for all duplicate types
 */
  async generateDuplicateSQL() {
    try {
      console.log('📝 Generating SQL files for duplicates...');

      const sqlQueries = {
        prsDuplicates: `
-- PRS Internal Duplicates
-- Records that appear multiple times within the PRS table
SELECT 
  coach_code,
  class,
  berth_number,
  berth_type,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(serial_no ORDER BY serial_no) as serial_numbers,
  'WITHIN_PRS' as duplicate_type,
  CONCAT('Coach ', coach_code, ', Class ', class, ', Berth ', berth_number, ' appears ', COUNT(*), ' times in PRS') as details
FROM prs
GROUP BY coach_code, class, berth_number, berth_type
HAVING COUNT(*) > 1
ORDER BY coach_code, berth_number;
`,

        mdmsDuplicates: `
-- MDMS Internal Duplicates
-- Records that appear multiple times within the MDMS table
SELECT 
  prs_coach_code,
  coach_class,
  berth_no,
  berth_qualifier,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(serial_no ORDER BY serial_no) as serial_numbers,
  'WITHIN_MDMS' as duplicate_type,
  CONCAT('Coach ', prs_coach_code, ', Class ', coach_class, ', Berth ', berth_no, ' appears ', COUNT(*), ' times in MDMS') as details
FROM mdms
GROUP BY prs_coach_code, coach_class, berth_no, berth_qualifier
HAVING COUNT(*) > 1
ORDER BY prs_coach_code, berth_no;
`,

        crossTableDuplicates: `
-- Cross-Table Duplicates
-- Records that appear multiple times across both PRS and MDMS tables
SELECT 
  p.coach_code,
  p.class,
  p.berth_number,
  p.berth_type,
  m.berth_qualifier,
  COUNT(DISTINCT p.serial_no) as prs_count,
  COUNT(DISTINCT m.serial_no) as mdms_count,
  ARRAY_AGG(DISTINCT p.serial_no ORDER BY p.serial_no) as prs_serial_numbers,
  ARRAY_AGG(DISTINCT m.serial_no ORDER BY m.serial_no) as mdms_serial_numbers,
  'CROSS_TABLE' as duplicate_type,
  CONCAT('Coach ', p.coach_code, ', Class ', p.class, ', Berth ', p.berth_number, ' has ', COUNT(DISTINCT p.serial_no), ' entries in PRS and ', COUNT(DISTINCT m.serial_no), ' entries in MDMS') as details
FROM prs p
FULL OUTER JOIN mdms m 
  ON TRIM(LOWER(p.coach_code)) = TRIM(LOWER(m.prs_coach_code))
  AND TRIM(LOWER(p.class)) = TRIM(LOWER(m.coach_class))
  AND p.berth_number::INT = m.berth_no
GROUP BY p.coach_code, p.class, p.berth_number, p.berth_type, m.berth_qualifier
HAVING COUNT(DISTINCT p.serial_no) > 1 OR COUNT(DISTINCT m.serial_no) > 1
ORDER BY (COUNT(DISTINCT p.serial_no) + COUNT(DISTINCT m.serial_no)) DESC;
`,

        allDuplicates: `
-- All Duplicates Combined
-- Summary of all duplicate types
WITH prs_duplicates AS (
  SELECT 
    coach_code,
    class,
    berth_number,
    berth_type,
    COUNT(*) as duplicate_count,
    'WITHIN_PRS' as duplicate_type,
    CONCAT('Coach ', coach_code, ', Class ', class, ', Berth ', berth_number, ' appears ', COUNT(*), ' times in PRS') as details
  FROM prs
  GROUP BY coach_code, class, berth_number, berth_type
  HAVING COUNT(*) > 1
),
mdms_duplicates AS (
  SELECT 
    prs_coach_code as coach_code,
    coach_class as class,
    berth_no as berth_number,
    berth_qualifier as berth_type,
    COUNT(*) as duplicate_count,
    'WITHIN_MDMS' as duplicate_type,
    CONCAT('Coach ', prs_coach_code, ', Class ', coach_class, ', Berth ', berth_no, ' appears ', COUNT(*), ' times in MDMS') as details
  FROM mdms
  GROUP BY prs_coach_code, coach_class, berth_no, berth_qualifier
  HAVING COUNT(*) > 1
)
SELECT * FROM prs_duplicates
UNION ALL
SELECT * FROM mdms_duplicates
ORDER BY duplicate_type, coach_code, berth_number;
`
      };

      const sqlDir = path.join(process.cwd(), 'sql_exports');
      if (!fs.existsSync(sqlDir)) {
        fs.mkdirSync(sqlDir, { recursive: true });
      }

      const timestamp = this.getTimestamp();
      const sqlFiles = [];

      for (const [type, sqlQuery] of Object.entries(sqlQueries)) {
        const fileName = `duplicate_${type}_${timestamp}.sql`;
        const filePath = path.join(sqlDir, fileName);

        fs.writeFileSync(filePath, sqlQuery.trim());
        sqlFiles.push(fileName);
        console.log(`✅ Created SQL file: ${fileName}`);
      }

      return sqlFiles;

    } catch (error) {
      console.error('Error generating duplicate SQL files:', error);
      throw error;
    }
  }

  /**
   * Generate timestamp for file naming
   */
  getTimestamp() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
  }


  /**
   * Find all duplicate entries in PRS and MDMS tables
   */
  async findDuplicates() {
    try {
      console.log('🔍 Starting duplicate analysis...');

      // Generate SQL files first
      await this.generateDuplicateSQL();

      const duplicates = {
        prs: [],
        mdms: [],
        crossTable: []
      };

      // Query 1: Find duplicates within PRS table
      const prsDuplicatesQuery = `
        SELECT 
          coach_code,
          class,
          berth_number,
          berth_type,
          COUNT(*) as duplicate_count,
          ARRAY_AGG(serial_no ORDER BY serial_no) as serial_numbers
        FROM prs
        GROUP BY coach_code, class, berth_number, berth_type
        HAVING COUNT(*) > 1
        ORDER BY coach_code, berth_number
      `;

      const prsDuplicatesResult = await query(prsDuplicatesQuery);
      console.log(`🔄 Found ${prsDuplicatesResult.rows.length} duplicate groups in PRS`);

      for (const row of prsDuplicatesResult.rows) {
        duplicates.prs.push({
          coachCode: row.coach_code,
          class: row.class,
          berthNumber: row.berth_number,
          berthType: row.berth_type,
          duplicateCount: parseInt(row.duplicate_count),
          serialNumbers: row.serial_numbers,
          table: 'PRS',
          duplicateType: 'WITHIN_PRS',
          details: `Coach ${row.coach_code}, Class ${row.class}, Berth ${row.berth_number} appears ${row.duplicate_count} times in PRS`
        });
      }

      // Query 2: Find duplicates within MDMS table
      const mdmsDuplicatesQuery = `
        SELECT 
          prs_coach_code,
          layout_variant_no,
          berth_no,
          berth_qualifier,
          COUNT(*) as duplicate_count,
          ARRAY_AGG(serial_no ORDER BY serial_no) as serial_numbers
        FROM mdms
        GROUP BY prs_coach_code, layout_variant_no, berth_no, berth_qualifier
        HAVING COUNT(*) > 1
        ORDER BY prs_coach_code, berth_no
      `;

      const mdmsDuplicatesResult = await query(mdmsDuplicatesQuery);
      console.log(`🔄 Found ${mdmsDuplicatesResult.rows.length} duplicate groups in MDMS`);

      for (const row of mdmsDuplicatesResult.rows) {
        duplicates.mdms.push({
          coachCode: row.prs_coach_code,
          layoutVariantNo: row.layout_variant_no,
          berthNumber: row.berth_no,
          berthQualifier: row.berth_qualifier,
          duplicateCount: parseInt(row.duplicate_count),
          serialNumbers: row.serial_numbers,
          table: 'MDMS',
          duplicateType: 'WITHIN_MDMS',
          details: `Coach ${row.prs_coach_code}, Class ${row.layout_variant_no}, Berth ${row.berth_no} appears ${row.duplicate_count} times in MDMS`
        });
      }

      // Query 3: Find potential cross-table duplicates (same coach, class, berth in both tables)
      const crossTableDuplicatesQuery = `
        SELECT 
          p.coach_code,
          p.class,
          p.berth_number,
          p.berth_type,
          m.berth_qualifier,
          COUNT(DISTINCT p.serial_no) as prs_count,
          COUNT(DISTINCT m.serial_no) as mdms_count,
          ARRAY_AGG(DISTINCT p.serial_no ORDER BY p.serial_no) as prs_serial_numbers,
          ARRAY_AGG(DISTINCT m.serial_no ORDER BY m.serial_no) as mdms_serial_numbers
        FROM prs p
        FULL OUTER JOIN mdms m 
          ON TRIM(LOWER(p.coach_code)) = TRIM(LOWER(m.prs_coach_code))
          AND TRIM(LOWER(p.class)) = TRIM(LOWER(m.coach_class))
          AND p.berth_number::INT = m.berth_no
        GROUP BY p.coach_code, p.class, p.berth_number, p.berth_type, m.berth_qualifier
        HAVING COUNT(DISTINCT p.serial_no) > 1 OR COUNT(DISTINCT m.serial_no) > 1
        ORDER BY (COUNT(DISTINCT p.serial_no) + COUNT(DISTINCT m.serial_no)) DESC
      `;

      const crossTableDuplicatesResult = await query(crossTableDuplicatesQuery);
      console.log(`🔄 Found ${crossTableDuplicatesResult.rows.length} cross-table duplicate groups`);

      for (const row of crossTableDuplicatesResult.rows) {
        duplicates.crossTable.push({
          coachCode: row.coach_code,
          class: row.class,
          berthNumber: row.berth_number,
          berthType: row.berth_type,
          berthQualifier: row.berth_qualifier,
          prsCount: parseInt(row.prs_count),
          mdmsCount: parseInt(row.mdms_count),
          prsSerialNumbers: row.prs_serial_numbers,
          mdmsSerialNumbers: row.mdms_serial_numbers,
          duplicateType: 'CROSS_TABLE',
          details: `Coach ${row.coach_code}, Class ${row.class}, Berth ${row.berth_number} has ${row.prs_count} entries in PRS and ${row.mdms_count} entries in MDMS`
        });
      }

      const totalDuplicateGroups = duplicates.prs.length + duplicates.mdms.length + duplicates.crossTable.length;
      const totalDuplicateRecords =
        duplicates.prs.reduce((sum, dup) => sum + dup.duplicateCount, 0) +
        duplicates.mdms.reduce((sum, dup) => sum + dup.duplicateCount, 0) +
        duplicates.crossTable.reduce((sum, dup) => sum + dup.prsCount + dup.mdmsCount, 0);

      console.log('✅ Duplicate analysis complete');
      return {
        summary: {
          totalDuplicateGroups,
          totalDuplicateRecords,
          prsInternalDuplicates: duplicates.prs.length,
          mdmsInternalDuplicates: duplicates.mdms.length,
          crossTableDuplicates: duplicates.crossTable.length
        },
        duplicates
      };

    } catch (error) {
      console.error('❌ Error in duplicate analysis:', error);
      throw error;
    }
  }

  /**
   * Get duplicates by type (WITHIN_PRS, WITHIN_MDMS, CROSS_TABLE)
   */
  async getDuplicatesByType(type) {
    const allDuplicates = await this.findDuplicates();

    switch (type) {
      case 'WITHIN_PRS':
        return allDuplicates.duplicates.prs;
      case 'WITHIN_MDMS':
        return allDuplicates.duplicates.mdms;
      case 'CROSS_TABLE':
        return allDuplicates.duplicates.crossTable;
      default:
        throw new Error('Invalid duplicate type. Must be one of: WITHIN_PRS, WITHIN_MDMS, CROSS_TABLE');
    }
  }

  /**
   * Get duplicates for a specific coach code
   */
  async getDuplicatesForCoachCode(coachCode) {
    const allDuplicates = await this.findDuplicates();

    return {
      prs: allDuplicates.duplicates.prs.filter(d => d.coachCode === coachCode),
      mdms: allDuplicates.duplicates.mdms.filter(d => d.coachCode === coachCode),
      crossTable: allDuplicates.duplicates.crossTable.filter(d => d.coachCode === coachCode)
    };
  }

  /**
   * Get duplicate summary statistics only
   */
  async getDuplicateSummary() {
    const result = await this.findDuplicates();
    return result.summary;
  }

  /**
   * Get detailed duplicate summary with analytics
   */
  async getDetailedDuplicateSummary() {
    try {
      const duplicateResult = await this.findDuplicates();

      // Get total record counts for context
      const prsCountResult = await query('SELECT COUNT(*) as count FROM prs');
      const mdmsCountResult = await query('SELECT COUNT(*) as count FROM mdms');

      const totalPrsRecords = parseInt(prsCountResult.rows[0].count);
      const totalMdmsRecords = parseInt(mdmsCountResult.rows[0].count);

      // Calculate impact percentages
      const prsDuplicateImpact = duplicateResult.duplicates.prs.reduce((sum, dup) => sum + dup.duplicateCount, 0);
      const mdmsDuplicateImpact = duplicateResult.duplicates.mdms.reduce((sum, dup) => sum + dup.duplicateCount, 0);

      return {
        overview: {
          totalPrsRecords,
          totalMdmsRecords,
          totalDuplicateGroups: duplicateResult.summary.totalDuplicateGroups,
          totalDuplicateRecords: duplicateResult.summary.totalDuplicateRecords,
          dataIntegrityScore: Math.round(((totalPrsRecords + totalMdmsRecords - duplicateResult.summary.totalDuplicateRecords) / (totalPrsRecords + totalMdmsRecords)) * 10000) / 100
        },
        duplicateBreakdown: {
          prsInternalDuplicates: duplicateResult.summary.prsInternalDuplicates,
          mdmsInternalDuplicates: duplicateResult.summary.mdmsInternalDuplicates,
          crossTableDuplicates: duplicateResult.summary.crossTableDuplicates,
          prsDuplicateImpact,
          mdmsDuplicateImpact,
          prsImpactPercentage: Math.round((prsDuplicateImpact / totalPrsRecords) * 10000) / 100,
          mdmsImpactPercentage: Math.round((mdmsDuplicateImpact / totalMdmsRecords) * 10000) / 100
        }
      };

    } catch (error) {
      console.error('Error generating detailed duplicate summary:', error);
      throw error;
    }
  }

  /**
   * Export duplicates to Excel file
   */
  async exportDuplicatesToExcel() {
    try {
      console.log('📊 Generating duplicate analysis Excel report...');
      const workbook = new ExcelJS.Workbook();
      const duplicateData = await this.findDuplicates();

      // Summary Sheet
      const summarySheet = workbook.addWorksheet('Duplicate Summary');
      summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 30 },
        { header: 'Value', key: 'value', width: 20 },
        { header: 'Details', key: 'details', width: 40 }
      ];

      // Style the header row
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      summarySheet.addRow({
        metric: 'Total Duplicate Groups',
        value: duplicateData.summary.totalDuplicateGroups,
        details: 'Number of unique combinations that have duplicates'
      });
      summarySheet.addRow({
        metric: 'Total Duplicate Records',
        value: duplicateData.summary.totalDuplicateRecords,
        details: 'Total number of records involved in duplications'
      });
      summarySheet.addRow({
        metric: 'PRS Internal Duplicates',
        value: duplicateData.summary.prsInternalDuplicates,
        details: 'Duplicate groups within PRS table'
      });
      summarySheet.addRow({
        metric: 'MDMS Internal Duplicates',
        value: duplicateData.summary.mdmsInternalDuplicates,
        details: 'Duplicate groups within MDMS table'
      });
      summarySheet.addRow({
        metric: 'Cross-Table Duplicates',
        value: duplicateData.summary.crossTableDuplicates,
        details: 'Entries that appear multiple times across both tables'
      });

      // PRS Duplicates Sheet
      if (duplicateData.duplicates.prs.length > 0) {
        const prsSheet = workbook.addWorksheet('PRS Duplicates');
        prsSheet.columns = [
          { header: 'Coach Code', key: 'coachCode', width: 15 },
          { header: 'Class', key: 'class', width: 10 },
          { header: 'Berth Number', key: 'berthNumber', width: 12 },
          { header: 'Berth Type', key: 'berthType', width: 15 },
          { header: 'Duplicate Count', key: 'duplicateCount', width: 15 },
          { header: 'Serial Numbers', key: 'serialNumbers', width: 30 },
          { header: 'Details', key: 'details', width: 50 }
        ];

        prsSheet.getRow(1).font = { bold: true };
        prsSheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };

        duplicateData.duplicates.prs.forEach(duplicate => {
          prsSheet.addRow({
            ...duplicate,
            serialNumbers: duplicate.serialNumbers.join(', ')
          });
        });
      }

      // MDMS Duplicates Sheet
      if (duplicateData.duplicates.mdms.length > 0) {
        const mdmsSheet = workbook.addWorksheet('MDMS Duplicates');
        mdmsSheet.columns = [
          { header: 'Coach Code', key: 'coachCode', width: 15 },
          { header: 'Class', key: 'layoutVariantNo', width: 30 },
          { header: 'Berth Number', key: 'berthNumber', width: 12 },
          { header: 'Berth Qualifier', key: 'berthQualifier', width: 15 },
          { header: 'Duplicate Count', key: 'duplicateCount', width: 15 },
          { header: 'Serial Numbers', key: 'serialNumbers', width: 30 },
          { header: 'Details', key: 'details', width: 50 }
        ];

        mdmsSheet.getRow(1).font = { bold: true };
        mdmsSheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };

        duplicateData.duplicates.mdms.forEach(duplicate => {
          mdmsSheet.addRow({
            coachCode: duplicate.coachCode,
            layoutVariantNo: duplicate.layoutVariantNo,
            berthNumber: duplicate.berthNumber,
            berthQualifier: duplicate.berthQualifier,
            duplicateCount: duplicate.duplicateCount,
            serialNumbers: duplicate.serialNumbers.join(', '),
            details: duplicate.details
          });
        });
      }

      // Cross-Table Duplicates Sheet
      if (duplicateData.duplicates.crossTable.length > 0) {
        const crossTableSheet = workbook.addWorksheet('Cross-Table Duplicates');
        crossTableSheet.columns = [
          { header: 'Coach Code', key: 'coachCode', width: 15 },
          { header: 'Class', key: 'class', width: 10 },
          { header: 'Berth Number', key: 'berthNumber', width: 12 },
          { header: 'PRS Berth Type', key: 'berthType', width: 15 },
          { header: 'MDMS Berth Qualifier', key: 'berthQualifier', width: 18 },
          { header: 'PRS Count', key: 'prsCount', width: 10 },
          { header: 'MDMS Count', key: 'mdmsCount', width: 12 },
          { header: 'PRS Serial Numbers', key: 'prsSerialNumbers', width: 25 },
          { header: 'MDMS Serial Numbers', key: 'mdmsSerialNumbers', width: 25 },
          { header: 'Details', key: 'details', width: 50 }
        ];

        crossTableSheet.getRow(1).font = { bold: true };
        crossTableSheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };

        duplicateData.duplicates.crossTable.forEach(duplicate => {
          crossTableSheet.addRow({
            ...duplicate,
            prsSerialNumbers: duplicate.prsSerialNumbers.join(', '),
            mdmsSerialNumbers: duplicate.mdmsSerialNumbers.join(', ')
          });
        });
      }

      // Create exports directory if it doesn't exist
      const exportsDir = path.join(process.cwd(), 'exports');
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      // Save file in exports directory
      const now = new Date();

      const localTimestamp =
        now.getFullYear() +
        '-' + String(now.getMonth() + 1).padStart(2, '0') +
        '-' + String(now.getDate()).padStart(2, '0') +
        '_' + String(now.getHours()).padStart(2, '0') +
        '-' + String(now.getMinutes()).padStart(2, '0') +
        '-' + String(now.getSeconds()).padStart(2, '0');

      const fileName = `prs-mdms-duplicates-report-${localTimestamp}.xlsx`;
      const filePath = path.join(exportsDir, fileName);

      await workbook.xlsx.writeFile(filePath);
      console.log(`✅ Duplicate analysis Excel report saved: ${fileName}`);
      return fileName;

    } catch (error) {
      console.error('Error exporting duplicates to Excel:', error);
      throw error;
    }
  }
}
