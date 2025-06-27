import { query } from '../../database/config/db.js';
import ExcelJS from 'exceljs';
import path from 'path';

export class DiscrepancyService {
  
  /**
   * Find all discrepancies between PRS and MDMS tables
   */
  async findDiscrepancies() {
    try {
      console.log('🔍 Starting discrepancy analysis...');
      const discrepancies = [];

      // Query 1: Find type mismatches
      const typeMismatchQuery = `
        SELECT 
          p.serial_no,
          p.coach_code,
          p.berth_number,
          p.berth_type,
          m.berth_qualifier,
          'TYPE_MISMATCH' as discrepancy_type
        FROM prs p
        INNER JOIN mdms m 
          ON p.serial_no = m.serial_no 
          AND p.coach_code = m.prs_coach_code
          AND p.berth_number = m.berth_no
        WHERE p.berth_type != m.berth_qualifier
        ORDER BY p.coach_code, p.berth_number;
      `;

      const typeMismatchResult = await query(typeMismatchQuery);
      console.log(`Found ${typeMismatchResult.rows.length} type mismatches`);

      for (const row of typeMismatchResult.rows) {
        discrepancies.push({
          serialNo: row.serial_no,
          coachCode: row.coach_code,
          berthNumber: row.berth_number,
          berthType: row.berth_type,
          berthQualifier: row.berth_qualifier,
          discrepancyType: 'TYPE_MISMATCH',
          details: `PRS berth type '${row.berth_type}' doesn't match MDMS berth qualifier '${row.berth_qualifier}'`
        });
      }

      // Query 2: Find records missing in MDMS
      const missingInMdmsQuery = `
        SELECT 
          p.serial_no,
          p.coach_code,
          p.berth_number,
          p.berth_type,
          'MISSING_IN_MDMS' as discrepancy_type
        FROM prs p
        LEFT JOIN mdms m 
          ON p.serial_no = m.serial_no 
          AND p.coach_code = m.prs_coach_code
          AND p.berth_number = m.berth_no
        WHERE m.serial_no IS NULL
        ORDER BY p.coach_code, p.berth_number;
      `;

      const missingInMdmsResult = await query(missingInMdmsQuery);
      console.log(`Found ${missingInMdmsResult.rows.length} records missing in MDMS`);

      for (const row of missingInMdmsResult.rows) {
        discrepancies.push({
          serialNo: row.serial_no,
          coachCode: row.coach_code,
          berthNumber: row.berth_number,
          berthType: row.berth_type,
          berthQualifier: 'N/A',
          discrepancyType: 'MISSING_IN_MDMS',
          details: `PRS record (${row.coach_code}, berth ${row.berth_number}) not found in MDMS table`
        });
      }

      // Query 3: Find records missing in PRS
      const missingInPrsQuery = `
        SELECT 
          m.serial_no,
          m.prs_coach_code as coach_code,
          m.berth_no as berth_number,
          m.berth_qualifier,
          'MISSING_IN_PRS' as discrepancy_type
        FROM mdms m
        LEFT JOIN prs p 
          ON m.serial_no = p.serial_no 
          AND m.prs_coach_code = p.coach_code
          AND m.berth_no = p.berth_number
        WHERE p.serial_no IS NULL
        ORDER BY m.prs_coach_code, m.berth_no;
      `;

      const missingInPrsResult = await query(missingInPrsQuery);
      console.log(`Found ${missingInPrsResult.rows.length} records missing in PRS`);

      for (const row of missingInPrsResult.rows) {
        discrepancies.push({
          serialNo: row.serial_no,
          coachCode: row.coach_code,
          berthNumber: row.berth_number,
          berthType: 'N/A',
          berthQualifier: row.berth_qualifier,
          discrepancyType: 'MISSING_IN_PRS',
          details: `MDMS record (${row.coach_code}, berth ${row.berth_number}) not found in PRS table`
        });
      }

      // Calculate counts
      const typeMismatchCount = discrepancies.filter(d => d.discrepancyType === 'TYPE_MISMATCH').length;
      const missingInPrsCount = discrepancies.filter(d => d.discrepancyType === 'MISSING_IN_PRS').length;
      const missingInMdmsCount = discrepancies.filter(d => d.discrepancyType === 'MISSING_IN_MDMS').length;

      const result = {
        totalDiscrepancies: discrepancies.length,
        typeMismatchCount,
        missingInPrsCount,
        missingInMdmsCount,
        discrepancies
      };

      console.log('✅ Discrepancy analysis complete:', {
        total: result.totalDiscrepancies,
        typeMismatch: typeMismatchCount,
        missingInPrs: missingInPrsCount,
        missingInMdms: missingInMdmsCount
      });

      return result;

    } catch (error) {
      console.error('❌ Error finding discrepancies:', error);
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
        { header: 'Berth Number', key: 'berthNumber', width: 12 },
        { header: 'PRS Berth Type', key: 'berthType', width: 15 },
        { header: 'MDMS Berth Qualifier', key: 'berthQualifier', width: 20 },
        { header: 'Discrepancy Type', key: 'discrepancyType', width: 20 },
        { header: 'Details', key: 'details', width: 60 }
      ];

      discrepancyData.discrepancies.forEach(discrepancy => {
        allDiscrepanciesSheet.addRow(discrepancy);
      });

      // Save file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `prs-mdms-discrepancy-report-${timestamp}.xlsx`;
      const filePath = path.join(process.cwd(), fileName);

      await workbook.xlsx.writeFile(filePath);
      console.log(`✅ Excel report saved: ${fileName}`);
      return fileName;

    } catch (error) {
      console.error('Error exporting to Excel:', error);
      throw error;
    }
  }
}
