import { DiscrepancyService } from '../services/prsMdms.js';
import { SimulationService } from '../services/simulateChangesPrsMdms.js';

const discrepancyService = new DiscrepancyService();
const simulationService = new SimulationService();

/**
 * Get all discrepancies between PRS and MDMS tables
 */
export const getAllDiscrepancies = async (req, res) => {
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
      message: error.message
    });
  }
}; // ← ADDED MISSING CLOSING BRACE

/**
 * Get discrepancy summary statistics only
 */
export const getDiscrepancySummary = async (req, res) => {
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
      message: error.message
    });
  }
}; // ← ADDED MISSING CLOSING BRACE

/**
 * Get discrepancies by type
 */
export const getDiscrepanciesByType = async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!['TYPE_MISMATCH', 'MISSING_IN_PRS', 'MISSING_IN_MDMS'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid discrepancy type',
        message: 'Type must be one of: TYPE_MISMATCH, MISSING_IN_PRS, MISSING_IN_MDMS'
      });
    }

    const discrepancies = await discrepancyService.getDiscrepanciesByType(type);
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
      message: error.message
    });
  }
}; // ← ADDED MISSING CLOSING BRACE

/**
 * Get discrepancies for a specific coach code
 */
export const getDiscrepanciesForCoachCode = async (req, res) => {
  try {
    const { coachCode } = req.params;
    
    if (!coachCode) {
      return res.status(400).json({
        success: false,
        error: 'Coach code is required',
        message: 'Please provide a valid coach code'
      });
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
      message: error.message
    });
  }
}; // ← ADDED MISSING CLOSING BRACE

/**
 * Get detailed discrepancy summary with analytics
 */
export const getDetailedSummary = async (req, res) => {
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
      message: error.message
    });
  }
}; // ← ADDED MISSING CLOSING BRACE

/**
 * Export discrepancies to Excel file
 */
export const exportToExcel = async (req, res) => {
  try {
    const includeDetailedSummary = req.query.detailed === 'true';
    console.log('📊 Generating Excel report...');
    
    const fileName = await discrepancyService.exportToExcel(includeDetailedSummary);
    res.status(200).json({
      success: true,
      data: {
        fileName,
        downloadUrl: `/api/discrepancies/download/${fileName}`,
        includeDetailedSummary
      },
      message: `Excel report generated successfully: ${fileName}`
    });
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export to Excel',
      message: error.message
    });
  }
}; // ← ADDED MISSING CLOSING BRACE

/**
 * Simulate changes for testing
 */
export const simulateChanges = async (req, res) => {
  try {
    const changes = await simulationService.simulateChanges();
    res.status(200).json({
      success: true,
      data: changes,
      message: 'Simulation completed successfully'
    });
  } catch (error) {
    console.error('Error simulating changes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to simulate changes',
      message: error.message
    });
  }
}; // ← ADDED MISSING CLOSING BRACE

/**
 * Restore original data
 */
export const restoreData = async (req, res) => {
  try {
    const result = await simulationService.restoreOriginalData();
    res.status(200).json({
      success: true,
      data: result,
      message: 'Data restored successfully'
    });
  } catch (error) {
    console.error('Error restoring data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore data',
      message: error.message
    });
  }
}; // ← ADDED MISSING CLOSING BRACE
