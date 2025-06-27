import { query } from '../config/db';
import * as ExcelJS from 'exceljs';
import path from 'path';

export interface DiscrepancyResult {
  coachCode: string;
  berthNumber: number;
  berthType: string;
  berthQualifier: string;
  discrepancyType: 'TYPE_MISMATCH' | 'MISSING_IN_BERTHS' | 'MISSING_IN_LAYOUTS';
  details: string;
}

export interface DiscrepancySummary {
  totalDiscrepancies: number;
  typeMismatchCount: number;
  missingInBerthsCount: number;
  missingInLayoutsCount: number;
  discrepancies: DiscrepancyResult[];
}

export interface DetailedSummary {
  overview: {
    totalBerthRecords: number;
    totalCoachLayoutRecords: number;
    totalDiscrepancies: number;
    dataQualityScore: number; // Percentage of matching records
  };
  discrepancyBreakdown: {
    typeMismatchCount: number;
    missingInBerthsCount: number;
    missingInLayoutsCount: number;
    typeMismatchPercentage: number;
    missingInBerthsPercentage: number;
    missingInLayoutsPercentage: number;
  };
  coachCodeAnalysis: {
    totalUniqueCoachCodes: number;
    coachCodesWithDiscrepancies: number;
    topProblematicCoachCodes: Array<{
      coachCode: string;
      discrepancyCount: number;
      discrepancyTypes: string[];
    }>;
  };
  berthTypeAnalysis: {
    typeMismatchesByBerthType: Array<{
      berthType: string;
      count: number;
      commonMismatchWith: string[];
    }>;
  };
  recommendations: string[];
}

export class DiscrepancyService {
  /**
   * Find all discrepancies between berths and coach_layouts tables
   * Compares coach_code with prs_coach_code and berth_number with berth_no
   * Checks if berth_type matches berth_qualifier
   */
  async findDiscrepancies(): Promise<DiscrepancySummary> {
    try {
      const discrepancies: DiscrepancyResult[] = [];

      // Query 1: Find mismatches where coach codes and berth numbers match but types differ
      const typeMismatchQuery = `
        SELECT 
          b.coach_code,
          b.berth_number,
          b.berth_type,
          cl.berth_qualifier,
          'TYPE_MISMATCH' as discrepancy_type
        FROM berths b
        INNER JOIN coach_layouts cl 
          ON b.coach_code = cl.prs_coach_code 
          AND b.berth_number = cl.berth_no
        WHERE b.berth_type != cl.berth_qualifier
        ORDER BY b.coach_code, b.berth_number;
      `;

      const typeMismatchResult = await query(typeMismatchQuery);
      
      for (const row of typeMismatchResult.rows) {
        discrepancies.push({
          coachCode: row.coach_code,
          berthNumber: row.berth_number,
          berthType: row.berth_type,
          berthQualifier: row.berth_qualifier,
          discrepancyType: 'TYPE_MISMATCH',
          details: `Berth type '${row.berth_type}' in berths table doesn't match berth qualifier '${row.berth_qualifier}' in coach_layouts table`
        });
      }

      // Query 2: Find berths that don't have corresponding entries in coach_layouts
      const missingInLayoutsQuery = `
        SELECT 
          b.coach_code,
          b.berth_number,
          b.berth_type,
          NULL as berth_qualifier,
          'MISSING_IN_LAYOUTS' as discrepancy_type
        FROM berths b
        LEFT JOIN coach_layouts cl 
          ON b.coach_code = cl.prs_coach_code 
          AND b.berth_number = cl.berth_no
        WHERE cl.prs_coach_code IS NULL
        ORDER BY b.coach_code, b.berth_number;
      `;

      const missingInLayoutsResult = await query(missingInLayoutsQuery);
      
      for (const row of missingInLayoutsResult.rows) {
        discrepancies.push({
          coachCode: row.coach_code,
          berthNumber: row.berth_number,
          berthType: row.berth_type,
          berthQualifier: row.berth_qualifier || 'N/A',
          discrepancyType: 'MISSING_IN_LAYOUTS',
          details: `Berth with coach code '${row.coach_code}' and berth number '${row.berth_number}' exists in berths table but not in coach_layouts table`
        });
      }

      // Query 3: Find coach_layouts that don't have corresponding entries in berths
      const missingInBerthsQuery = `
        SELECT 
          cl.prs_coach_code as coach_code,
          cl.berth_no as berth_number,
          NULL as berth_type,
          cl.berth_qualifier,
          'MISSING_IN_BERTHS' as discrepancy_type
        FROM coach_layouts cl
        LEFT JOIN berths b 
          ON cl.prs_coach_code = b.coach_code 
          AND cl.berth_no = b.berth_number
        WHERE b.coach_code IS NULL
        ORDER BY cl.prs_coach_code, cl.berth_no;
      `;

      const missingInBerthsResult = await query(missingInBerthsQuery);
      
      for (const row of missingInBerthsResult.rows) {
        discrepancies.push({
          coachCode: row.coach_code,
          berthNumber: row.berth_number,
          berthType: row.berth_type || 'N/A',
          berthQualifier: row.berth_qualifier,
          discrepancyType: 'MISSING_IN_BERTHS',
          details: `Coach layout with coach code '${row.coach_code}' and berth number '${row.berth_number}' exists in coach_layouts table but not in berths table`
        });
      }

      // Calculate summary statistics
      const typeMismatchCount = discrepancies.filter(d => d.discrepancyType === 'TYPE_MISMATCH').length;
      const missingInBerthsCount = discrepancies.filter(d => d.discrepancyType === 'MISSING_IN_BERTHS').length;
      const missingInLayoutsCount = discrepancies.filter(d => d.discrepancyType === 'MISSING_IN_LAYOUTS').length;

      return {
        totalDiscrepancies: discrepancies.length,
        typeMismatchCount,
        missingInBerthsCount,
        missingInLayoutsCount,
        discrepancies
      };

    } catch (error) {
      console.error('Error finding discrepancies:', error);
      throw error;
    }
  }

  /**
   * Get discrepancies by type
   */
  async getDiscrepanciesByType(type: 'TYPE_MISMATCH' | 'MISSING_IN_BERTHS' | 'MISSING_IN_LAYOUTS'): Promise<DiscrepancyResult[]> {
    const allDiscrepancies = await this.findDiscrepancies();
    return allDiscrepancies.discrepancies.filter(d => d.discrepancyType === type);
  }

  /**
   * Get discrepancies for a specific coach code
   */
  async getDiscrepanciesForCoachCode(coachCode: string): Promise<DiscrepancyResult[]> {
    const allDiscrepancies = await this.findDiscrepancies();
    return allDiscrepancies.discrepancies.filter(d => d.coachCode === coachCode);
  }

  /**
   * Get summary statistics only
   */
  async getDiscrepancySummary(): Promise<Omit<DiscrepancySummary, 'discrepancies'>> {
    const result = await this.findDiscrepancies();
    return {
      totalDiscrepancies: result.totalDiscrepancies,
      typeMismatchCount: result.typeMismatchCount,
      missingInBerthsCount: result.missingInBerthsCount,
      missingInLayoutsCount: result.missingInLayoutsCount
    };
  }

  /**
   * Get detailed summary with analytics and insights
   */
  async getDetailedSummary(): Promise<DetailedSummary> {
    try {
      // Get basic discrepancy data
      const discrepancyResult = await this.findDiscrepancies();
      
      // Get total record counts
      const berthCountResult = await query('SELECT COUNT(*) as count FROM berths');
      const layoutCountResult = await query('SELECT COUNT(*) as count FROM coach_layouts');
      
      const totalBerthRecords = parseInt(berthCountResult.rows[0].count);
      const totalCoachLayoutRecords = parseInt(layoutCountResult.rows[0].count);
      const totalPossibleMatches = Math.max(totalBerthRecords, totalCoachLayoutRecords);
      const matchingRecords = totalPossibleMatches - discrepancyResult.totalDiscrepancies;
      const dataQualityScore = (matchingRecords / totalPossibleMatches) * 100;

      // Get unique coach codes analysis
      const coachCodeAnalysisQuery = `
        SELECT 
          COALESCE(b.coach_code, cl.prs_coach_code) as coach_code,
          COUNT(*) as discrepancy_count,
          ARRAY_AGG(DISTINCT 
            CASE 
              WHEN b.coach_code IS NULL THEN 'MISSING_IN_BERTHS'
              WHEN cl.prs_coach_code IS NULL THEN 'MISSING_IN_LAYOUTS'
              WHEN b.berth_type != cl.berth_qualifier THEN 'TYPE_MISMATCH'
            END
          ) as discrepancy_types
        FROM berths b
        FULL OUTER JOIN coach_layouts cl 
          ON b.coach_code = cl.prs_coach_code 
          AND b.berth_number = cl.berth_no
        WHERE b.coach_code IS NULL 
          OR cl.prs_coach_code IS NULL 
          OR b.berth_type != cl.berth_qualifier
        GROUP BY COALESCE(b.coach_code, cl.prs_coach_code)
        ORDER BY discrepancy_count DESC
        LIMIT 10;
      `;

      const coachCodeAnalysisResult = await query(coachCodeAnalysisQuery);
      
      // Get total unique coach codes
      const uniqueCoachCodesQuery = `
        SELECT COUNT(DISTINCT coach_code) as unique_codes
        FROM (
          SELECT coach_code FROM berths
          UNION
          SELECT prs_coach_code as coach_code FROM coach_layouts
        ) as all_codes;
      `;
      
      const uniqueCoachCodesResult = await query(uniqueCoachCodesQuery);
      const totalUniqueCoachCodes = parseInt(uniqueCoachCodesResult.rows[0].unique_codes);

      // Berth type mismatch analysis
      const berthTypeMismatchQuery = `
        SELECT 
          b.berth_type,
          COUNT(*) as mismatch_count,
          ARRAY_AGG(DISTINCT cl.berth_qualifier) as common_mismatches
        FROM berths b
        INNER JOIN coach_layouts cl 
          ON b.coach_code = cl.prs_coach_code 
          AND b.berth_number = cl.berth_no
        WHERE b.berth_type != cl.berth_qualifier
        GROUP BY b.berth_type
        ORDER BY mismatch_count DESC;
      `;

      const berthTypeMismatchResult = await query(berthTypeMismatchQuery);

      // Generate recommendations
      const recommendations = this.generateRecommendations(discrepancyResult, {
        totalBerthRecords,
        totalCoachLayoutRecords,
        dataQualityScore
      });

      return {
        overview: {
          totalBerthRecords,
          totalCoachLayoutRecords,
          totalDiscrepancies: discrepancyResult.totalDiscrepancies,
          dataQualityScore: Math.round(dataQualityScore * 100) / 100
        },
        discrepancyBreakdown: {
          typeMismatchCount: discrepancyResult.typeMismatchCount,
          missingInBerthsCount: discrepancyResult.missingInBerthsCount,
          missingInLayoutsCount: discrepancyResult.missingInLayoutsCount,
          typeMismatchPercentage: Math.round((discrepancyResult.typeMismatchCount / discrepancyResult.totalDiscrepancies) * 10000) / 100,
          missingInBerthsPercentage: Math.round((discrepancyResult.missingInBerthsCount / discrepancyResult.totalDiscrepancies) * 10000) / 100,
          missingInLayoutsPercentage: Math.round((discrepancyResult.missingInLayoutsCount / discrepancyResult.totalDiscrepancies) * 10000) / 100
        },
        coachCodeAnalysis: {
          totalUniqueCoachCodes,
          coachCodesWithDiscrepancies: coachCodeAnalysisResult.rows.length,
          topProblematicCoachCodes: coachCodeAnalysisResult.rows.map(row => ({
            coachCode: row.coach_code,
            discrepancyCount: parseInt(row.discrepancy_count),
            discrepancyTypes: row.discrepancy_types.filter(Boolean)
          }))
        },
        berthTypeAnalysis: {
          typeMismatchesByBerthType: berthTypeMismatchResult.rows.map(row => ({
            berthType: row.berth_type,
            count: parseInt(row.mismatch_count),
            commonMismatchWith: row.common_mismatches
          }))
        },
        recommendations
      };

    } catch (error) {
      console.error('Error generating detailed summary:', error);
      throw error;
    }
  }

  /**
   * Export discrepancies to Excel file
   */
  async exportToExcel(includeDetailedSummary: boolean = true): Promise<string> {
    try {
      const workbook = new ExcelJS.Workbook();
      const discrepancyData = await this.findDiscrepancies();

      // Summary Sheet
      const summarySheet = workbook.addWorksheet('Summary');
      
      // Set column widths
      summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 30 },
        { header: 'Value', key: 'value', width: 20 },
        { header: 'Percentage', key: 'percentage', width: 15 }
      ];

      // Add summary data
      summarySheet.addRow({ metric: 'Total Discrepancies', value: discrepancyData.totalDiscrepancies, percentage: '100%' });
      summarySheet.addRow({ 
        metric: 'Type Mismatches', 
        value: discrepancyData.typeMismatchCount, 
        percentage: `${Math.round((discrepancyData.typeMismatchCount / discrepancyData.totalDiscrepancies) * 100)}%`
      });
      summarySheet.addRow({ 
        metric: 'Missing in Berths', 
        value: discrepancyData.missingInBerthsCount, 
        percentage: `${Math.round((discrepancyData.missingInBerthsCount / discrepancyData.totalDiscrepancies) * 100)}%`
      });
      summarySheet.addRow({ 
        metric: 'Missing in Layouts', 
        value: discrepancyData.missingInLayoutsCount, 
        percentage: `${Math.round((discrepancyData.missingInLayoutsCount / discrepancyData.totalDiscrepancies) * 100)}%`
      });

      // Style the summary sheet
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } };

      // All Discrepancies Sheet
      const allDiscrepanciesSheet = workbook.addWorksheet('All Discrepancies');
      allDiscrepanciesSheet.columns = [
        { header: 'Coach Code', key: 'coachCode', width: 15 },
        { header: 'Berth Number', key: 'berthNumber', width: 12 },
        { header: 'Berth Type', key: 'berthType', width: 12 },
        { header: 'Berth Qualifier', key: 'berthQualifier', width: 15 },
        { header: 'Discrepancy Type', key: 'discrepancyType', width: 20 },
        { header: 'Details', key: 'details', width: 60 }
      ];

      // Add data
      discrepancyData.discrepancies.forEach(discrepancy => {
        allDiscrepanciesSheet.addRow(discrepancy);
      });

      // Style headers
      allDiscrepanciesSheet.getRow(1).font = { bold: true };
      allDiscrepanciesSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6FA' } };

      // Type Mismatch Sheet
      const typeMismatchSheet = workbook.addWorksheet('Type Mismatches');
      typeMismatchSheet.columns = allDiscrepanciesSheet.columns;
      
      const typeMismatches = discrepancyData.discrepancies.filter(d => d.discrepancyType === 'TYPE_MISMATCH');
      typeMismatches.forEach(discrepancy => {
        typeMismatchSheet.addRow(discrepancy);
      });
      
      typeMismatchSheet.getRow(1).font = { bold: true };
      typeMismatchSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCC' } };

      // Missing in Berths Sheet
      const missingInBerthsSheet = workbook.addWorksheet('Missing in Berths');
      missingInBerthsSheet.columns = allDiscrepanciesSheet.columns;
      
      const missingInBerths = discrepancyData.discrepancies.filter(d => d.discrepancyType === 'MISSING_IN_BERTHS');
      missingInBerths.forEach(discrepancy => {
        missingInBerthsSheet.addRow(discrepancy);
      });
      
      missingInBerthsSheet.getRow(1).font = { bold: true };
      missingInBerthsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFE0' } };

      // Missing in Layouts Sheet
      const missingInLayoutsSheet = workbook.addWorksheet('Missing in Layouts');
      missingInLayoutsSheet.columns = allDiscrepanciesSheet.columns;
      
      const missingInLayouts = discrepancyData.discrepancies.filter(d => d.discrepancyType === 'MISSING_IN_LAYOUTS');
      missingInLayouts.forEach(discrepancy => {
        missingInLayoutsSheet.addRow(discrepancy);
      });
      
      missingInLayoutsSheet.getRow(1).font = { bold: true };
      missingInLayoutsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0FFE0' } };

      // Add detailed summary sheet if requested
      if (includeDetailedSummary) {
        const detailedSummary = await this.getDetailedSummary();
        const detailedSheet = workbook.addWorksheet('Detailed Analysis');
        
        // Add detailed analysis data
        detailedSheet.addRow(['OVERVIEW']);
        detailedSheet.addRow(['Total Berth Records', detailedSummary.overview.totalBerthRecords]);
        detailedSheet.addRow(['Total Coach Layout Records', detailedSummary.overview.totalCoachLayoutRecords]);
        detailedSheet.addRow(['Data Quality Score', `${detailedSummary.overview.dataQualityScore}%`]);
        detailedSheet.addRow([]);
        
        detailedSheet.addRow(['TOP PROBLEMATIC COACH CODES']);
        detailedSheet.addRow(['Coach Code', 'Discrepancy Count', 'Types']);
        detailedSummary.coachCodeAnalysis.topProblematicCoachCodes.forEach(coach => {
          detailedSheet.addRow([coach.coachCode, coach.discrepancyCount, coach.discrepancyTypes.join(', ')]);
        });
        
        detailedSheet.addRow([]);
        detailedSheet.addRow(['RECOMMENDATIONS']);
        detailedSummary.recommendations.forEach(rec => {
          detailedSheet.addRow([rec]);
        });
        
        // Style the detailed sheet
        detailedSheet.getRow(1).font = { bold: true, size: 14 };
        detailedSheet.getRow(6).font = { bold: true, size: 14 };
        detailedSheet.getRow(7).font = { bold: true };
      }

      // Save file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `discrepancy-report-${timestamp}.xlsx`;
      const filePath = path.join(process.cwd(), 'public', fileName);
      
      await workbook.xlsx.writeFile(filePath);
      
      return fileName;

    } catch (error) {
      console.error('Error exporting to Excel:', error);
      throw error;
    }
  }

  /**
   * Generate recommendations based on discrepancy analysis
   */
  private generateRecommendations(discrepancyData: DiscrepancySummary, overview: any): string[] {
    const recommendations: string[] = [];
    
    if (discrepancyData.typeMismatchCount > 0) {
      recommendations.push(`Address ${discrepancyData.typeMismatchCount} type mismatches by standardizing berth type naming conventions.`);
    }
    
    if (discrepancyData.missingInBerthsCount > 0) {
      recommendations.push(`Investigate ${discrepancyData.missingInBerthsCount} coach layouts that don't have corresponding berth records.`);
    }
    
    if (discrepancyData.missingInLayoutsCount > 0) {
      recommendations.push(`Review ${discrepancyData.missingInLayoutsCount} berth records that don't have corresponding layout entries.`);
    }
    
    if (overview.dataQualityScore < 90) {
      recommendations.push('Consider implementing data validation rules to improve overall data quality.');
    }
    
    if (overview.dataQualityScore < 70) {
      recommendations.push('URGENT: Data quality is below 70%. Immediate data cleansing is recommended.');
    }
    
    recommendations.push('Implement regular automated data quality checks to prevent future discrepancies.');
    
    return recommendations;
  }
}
