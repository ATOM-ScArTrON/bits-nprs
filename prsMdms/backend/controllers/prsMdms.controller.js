import { Request, Response } from 'express';
import path from 'path';
import { DiscrepancyService } from '../services/discrepancyService';

const discrepancyService = new DiscrepancyService();

/**
 * Get all discrepancies between berths and coach_layouts tables
 */
export const getAllDiscrepancies = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await discrepancyService.findDiscrepancies();
    
    res.status(200).json({
      success: true,
      data: result,
      message: `Found ${result.totalDiscrepancies} discrepancies`
    });
  } catch (error) {
    console.error('Error getting all discrepancies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve discrepancies',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get discrepancy summary statistics only
 */
export const getDiscrepancySummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const summary = await discrepancyService.getDiscrepancySummary();
    
    res.status(200).json({
      success: true,
      data: summary,
      message: `Summary: ${summary.totalDiscrepancies} total discrepancies found`
    });
  } catch (error) {
    console.error('Error getting discrepancy summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve discrepancy summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get discrepancies by type
 */
export const getDiscrepanciesByType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.params;
    
    if (!['TYPE_MISMATCH', 'MISSING_IN_BERTHS', 'MISSING_IN_LAYOUTS'].includes(type)) {
      res.status(400).json({
        success: false,
        error: 'Invalid discrepancy type',
        message: 'Type must be one of: TYPE_MISMATCH, MISSING_IN_BERTHS, MISSING_IN_LAYOUTS'
      });
      return;
    }

    const discrepancies = await discrepancyService.getDiscrepanciesByType(type as any);
    
    res.status(200).json({
      success: true,
      data: {
        type,
        count: discrepancies.length,
        discrepancies
      },
      message: `Found ${discrepancies.length} discrepancies of type ${type}`
    });
  } catch (error) {
    console.error('Error getting discrepancies by type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve discrepancies by type',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get discrepancies for a specific coach code
 */
export const getDiscrepanciesForCoachCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { coachCode } = req.params;
    
    if (!coachCode) {
      res.status(400).json({
        success: false,
        error: 'Coach code is required',
        message: 'Please provide a valid coach code'
      });
      return;
    }

    const discrepancies = await discrepancyService.getDiscrepanciesForCoachCode(coachCode);
    
    res.status(200).json({
      success: true,
      data: {
        coachCode,
        count: discrepancies.length,
        discrepancies
      },
      message: `Found ${discrepancies.length} discrepancies for coach code ${coachCode}`
    });
  } catch (error) {
    console.error('Error getting discrepancies for coach code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve discrepancies for coach code',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get detailed discrepancy summary with analytics
 */
export const getDetailedSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const detailedSummary = await discrepancyService.getDetailedSummary();
    
    res.status(200).json({
      success: true,
      data: detailedSummary,
      message: `Detailed analysis complete. Data quality score: ${detailedSummary.overview.dataQualityScore}%`
    });
  } catch (error) {
    console.error('Error getting detailed summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve detailed summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Export discrepancies to Excel file
 */
export const exportToExcel = async (req: Request, res: Response): Promise<void> => {
  try {
    const includeDetailedSummary = req.query.detailed === 'true';
    
    console.log('📊 Generating Excel report...');
    const fileName = await discrepancyService.exportToExcel(includeDetailedSummary);
    
    res.status(200).json({
      success: true,
      data: {
        fileName,
        downloadUrl: `/public/${fileName}`,
        includeDetailedSummary
      },
      message: `Excel report generated successfully: ${fileName}`
    });
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export to Excel',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Download Excel file
 */
export const downloadExcel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileName } = req.params;
    
    // Validate file name to prevent directory traversal
    if (!fileName || fileName.includes('..') || !fileName.endsWith('.xlsx')) {
      res.status(400).json({
        success: false,
        error: 'Invalid file name',
        message: 'Please provide a valid Excel file name'
      });
      return;
    }

    const filePath = path.join(process.cwd(), 'public', fileName);
    
    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      res.status(404).json({
        success: false,
        error: 'File not found',
        message: 'The requested Excel file does not exist'
      });
      return;
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Send file
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error downloading Excel file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download Excel file',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
