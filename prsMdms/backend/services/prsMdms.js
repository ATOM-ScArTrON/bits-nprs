import { query } from '../../database/config/db.js';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

export class DiscrepancyService {

  /**
   * Find all discrepancies between PRS and MDMS tables
   */
async findDiscrepancies() {
  try {
    console.log('🔍 Starting improved discrepancy analysis...');
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
        m.prs_coach_code AS coach_code,
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
        details: `MDMS record (${row.coach_code}, class ${row.class}, berth ${row.berth_number}) not found in PRS`
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
    return allDiscrepancies.discrepancies.filter(d => d.coachCode === coachCode);
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
   */
  async exportToExcel(includeDetailedSummary = true) {
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

      // Style the header row
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
      const allDiscrepanciesSheet = workbook.addWorksheet('All Discrepancies');
      allDiscrepanciesSheet.columns = [
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

      // Style the header row
      allDiscrepanciesSheet.getRow(1).font = { bold: true };
      allDiscrepanciesSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      discrepancyData.discrepancies.forEach(discrepancy => {
        allDiscrepanciesSheet.addRow(discrepancy);
      });

      // Create exports directory if it doesn't exist
      const exportsDir = path.join(process.cwd(), 'exports');
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      // Save file in exports directory
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
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
