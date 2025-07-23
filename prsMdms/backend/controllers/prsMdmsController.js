import { DiscrepancyService, DuplicateService } from '../services/prsMdms.js';
import { SimulationService } from '../services/simulateChangesPrsMdms.js';
import { SmartSeeder } from '../services/smartSeeder.js';
import fs from 'fs';
import path from 'path';

const discrepancyService = new DiscrepancyService();
const duplicateService = new DuplicateService();
const simulationService = new SimulationService();

// Smart Seeder instance holder
let smartSeederInstance = null;

// ==================== SMART SEEDER INSTANCE MANAGEMENT ====================

/**
 * Set Smart Seeder instance for controller access
 */
export const setSmartSeederInstance = (instance) => {
  smartSeederInstance = instance;
  console.log('✅ Smart Seeder instance set in controller');
};

/**
 * Get Smart Seeder instance (internal use)
 */
const getSmartSeederInstance = () => {
  if (!smartSeederInstance) {
    throw new Error('Smart Seeder not initialized. Call setSmartSeederInstance() first.');
  }
  return smartSeederInstance;
};

// ==================== SMART SEEDER CONTROLLERS ====================

/**
 * Get Smart Seeder status
 */
export const getSeederStatus = async (req, res) => {
  try {
    const seeder = getSmartSeederInstance();
    const status = await seeder.getStatus();
    
    // Get file details
    const watchDir = seeder.config.watchDirectory;
    const fileDetails = [];
    
    if (fs.existsSync(watchDir)) {
      const files = fs.readdirSync(watchDir)
        .filter(file => seeder.config.filePattern.test(file));
      
      for (const file of files) {
        const filePath = path.join(watchDir, file);
        const stats = fs.statSync(filePath);
        const hash = seeder.calculateFileHash(filePath);
        
        fileDetails.push({
          name: file,
          path: filePath,
          size: stats.size,
          lastModified: stats.mtime,
          hash: hash,
          isTracked: seeder.fileHashes[filePath] !== undefined
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        ...status,
        fileDetails,
        lastSeedTimeFormatted: status.lastSeedTime ? new Date(status.lastSeedTime).toISOString() : null
      },
      message: 'Smart seeder status retrieved',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting seeder status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get seeder status',
      message: error.message
    });
  }
};

/**
 * Force manual seeding
 */
export const forceSeeding = async (req, res) => {
  try {
    const seeder = getSmartSeederInstance();
    
    if (seeder.isSeeding) {
      return res.status(409).json({
        success: false,
        error: 'Seeding already in progress',
        message: 'Cannot start new seeding while another is running'
      });
    }

    console.log('🔄 Manual seeding requested via API...');
    const startTime = Date.now();
    
    // Force seeding regardless of file changes
    await seeder.seedWithWhitespaceCleanup();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    res.json({
      success: true,
      message: 'Manual seeding completed successfully',
      data: {
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        status: 'completed'
      }
    });
  } catch (error) {
    console.error('Error forcing seeding:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to force seeding',
      message: error.message
    });
  }
};

/**
 * Reset file hash tracking
 */
export const resetFileHashes = async (req, res) => {
  try {
    const seeder = getSmartSeederInstance();
    
    console.log('🔄 Resetting file hash tracking via API...');
    
    // Reset file hashes to force detection on next change
    seeder.fileHashes = {};
    await seeder.saveFileHashes();
    
    res.json({
      success: true,
      message: 'File hash tracking reset successfully',
      data: {
        message: 'All file hashes cleared - next file change will trigger seeding',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error resetting file hashes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset file hashes',
      message: error.message
    });
  }
};

/**
 * Get Smart Seeder configuration
 */
export const getSeederConfig = async (req, res) => {
  try {
    const seeder = getSmartSeederInstance();
    
    const config = {
      watchDirectory: seeder.config.watchDirectory,
      seederPath: seeder.config.seederPath,
      filePattern: seeder.config.filePattern.toString(),
      debounceTime: seeder.config.debounceTime,
      hashFile: seeder.config.hashFile,
      isActive: seeder.watchers.length > 0,
      isSeeding: seeder.isSeeding,
      watcherCount: seeder.watchers.length
    };

    res.json({
      success: true,
      data: config,
      message: 'Smart seeder configuration retrieved'
    });
  } catch (error) {
    console.error('Error getting seeder config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get seeder configuration',
      message: error.message
    });
  }
};

/**
 * Get seeding history/logs
 */
export const getSeedingHistory = async (req, res) => {
  try {
    const seeder = getSmartSeederInstance();
    
    const history = {
      lastSeedTime: seeder.fileHashes._lastSeedTime || null,
      lastSeedTimeFormatted: seeder.fileHashes._lastSeedTime 
        ? new Date(seeder.fileHashes._lastSeedTime).toISOString()
        : null,
      trackedFiles: Object.keys(seeder.fileHashes).filter(key => key !== '_lastSeedTime'),
      isCurrentlySeeding: seeder.isSeeding,
      watcherCount: seeder.watchers.length,
      configuration: {
        watchDirectory: seeder.config.watchDirectory,
        debounceTime: seeder.config.debounceTime,
        filePattern: seeder.config.filePattern.toString()
      }
    };

    res.json({
      success: true,
      data: history,
      message: 'Seeding history retrieved'
    });
  } catch (error) {
    console.error('Error getting seeding history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get seeding history',
      message: error.message
    });
  }
};

/**
 * Stop Smart Seeder
 */
export const stopSeeder = async (req, res) => {
  try {
    const seeder = getSmartSeederInstance();
    
    if (seeder.isSeeding) {
      return res.status(409).json({
        success: false,
        error: 'Cannot stop seeder while seeding is in progress',
        message: 'Wait for current seeding operation to complete'
      });
    }

    seeder.stop();
    
    res.json({
      success: true,
      message: 'Smart seeder stopped successfully',
      data: {
        status: 'stopped',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error stopping seeder:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop seeder',
      message: error.message
    });
  }
};

/**
 * Start Smart Seeder
 */
export const startSeeder = async (req, res) => {
  try {
    const seeder = getSmartSeederInstance();
    
    if (seeder.watchers.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Smart Seeder already running',
        message: 'Seeder is already active and monitoring files'
      });
    }

    seeder.startWatching();
    
    res.json({
      success: true,
      message: 'Smart seeder started successfully',
      data: {
        status: 'active',
        watchDirectory: seeder.config.watchDirectory,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error starting seeder:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start seeder',
      message: error.message
    });
  }
};

/**
 * Check for changes manually
 */
export const checkForChanges = async (req, res) => {
  try {
    const seeder = getSmartSeederInstance();
    
    console.log('🔍 Manual change detection requested...');
    const hasChanges = await seeder.checkForChanges();
    
    if (hasChanges) {
      console.log('✅ Changes detected, triggering seeding...');
      await seeder.seedWithWhitespaceCleanup();
    }
    
    res.json({
      success: true,
      message: hasChanges ? 'Changes detected and seeding completed' : 'No changes detected',
      data: {
        hasChanges,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error checking for changes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check for changes',
      message: error.message
    });
  }
};

// ==================== DISCREPANCY CONTROLLERS ====================

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
};

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
};

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
};

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

    const result = await discrepancyService.getDiscrepanciesForCoachCode(coachCode);
    res.status(200).json({
      success: true,
      data: result,
      message: result.message
    });
  } catch (error) {
    console.error('Error getting discrepancies for coach code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve discrepancies for coach code',
      message: error.message
    });
  }
};

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
};

/**
 * Export discrepancies to Excel file
 */
export const exportDiscrepanciesToExcel = async (req, res) => {
  try {
    const includeDetailedSummary = req.query.detailed === 'true';
    console.log('📊 Generating Excel report...');
    const fileName = await discrepancyService.exportDiscrepanciesToExcel(includeDetailedSummary);
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
};

// ==================== DUPLICATE CONTROLLERS ====================

/**
 * Get all duplicates in PRS and MDMS tables
 */
export const getAllDuplicates = async (req, res) => {
  try {
    const result = await duplicateService.findDuplicates();
    res.status(200).json({
      success: true,
      data: result,
      message: `Found ${result.summary.totalDuplicateGroups} duplicate groups with ${result.summary.totalDuplicateRecords} total records`
    });
  } catch (error) {
    console.error('Error getting all duplicates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve duplicates',
      message: error.message
    });
  }
};

/**
 * Get duplicate summary statistics only
 */
export const getDuplicateSummary = async (req, res) => {
  try {
    const summary = await duplicateService.getDuplicateSummary();
    res.status(200).json({
      success: true,
      data: summary,
      message: `Summary: ${summary.totalDuplicateGroups} duplicate groups found`
    });
  } catch (error) {
    console.error('Error getting duplicate summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve duplicate summary',
      message: error.message
    });
  }
};

/**
 * Get detailed duplicate summary with analytics
 */
export const getDetailedDuplicateSummary = async (req, res) => {
  try {
    const detailedSummary = await duplicateService.getDetailedDuplicateSummary();
    res.status(200).json({
      success: true,
      data: detailedSummary,
      message: `Detailed duplicate analysis complete. Data integrity score: ${detailedSummary.overview.dataIntegrityScore}%`
    });
  } catch (error) {
    console.error('Error getting detailed duplicate summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve detailed duplicate summary',
      message: error.message
    });
  }
};

/**
 * Get duplicates by type
 */
export const getDuplicatesByType = async (req, res) => {
  try {
    const { type } = req.params;
    if (!['WITHIN_PRS', 'WITHIN_MDMS', 'CROSS_TABLE'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid duplicate type',
        message: 'Type must be one of: WITHIN_PRS, WITHIN_MDMS, CROSS_TABLE'
      });
    }

    const duplicates = await duplicateService.getDuplicatesByType(type);
    res.status(200).json({
      success: true,
      data: {
        type,
        count: duplicates.length,
        duplicates
      },
      message: `Found ${duplicates.length} duplicates of type ${type}`
    });
  } catch (error) {
    console.error('Error getting duplicates by type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve duplicates by type',
      message: error.message
    });
  }
};

/**
 * Get duplicates for a specific coach code
 */
export const getDuplicatesForCoachCode = async (req, res) => {
  try {
    const { coachCode } = req.params;
    if (!coachCode) {
      return res.status(400).json({
        success: false,
        error: 'Coach code is required',
        message: 'Please provide a valid coach code'
      });
    }

    const duplicates = await duplicateService.getDuplicatesForCoachCode(coachCode);
    const totalCount = duplicates.prs.length + duplicates.mdms.length + duplicates.crossTable.length;

    res.status(200).json({
      success: true,
      data: {
        coachCode,
        totalCount,
        duplicates
      },
      message: `Found ${totalCount} duplicate groups for coach code ${coachCode}`
    });
  } catch (error) {
    console.error('Error getting duplicates for coach code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve duplicates for coach code',
      message: error.message
    });
  }
};

/**
 * Export duplicates to Excel file
 */
export const exportDuplicatesToExcel = async (req, res) => {
  try {
    console.log('📊 Generating duplicate analysis Excel report...');
    const fileName = await duplicateService.exportDuplicatesToExcel();
    res.status(200).json({
      success: true,
      data: {
        fileName,
        downloadUrl: `/api/duplicates/download/${fileName}`
      },
      message: `Duplicate analysis Excel report generated successfully: ${fileName}`
    });
  } catch (error) {
    console.error('Error exporting duplicates to Excel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export duplicates to Excel',
      message: error.message
    });
  }
};

// ==================== SIMULATION CONTROLLERS ====================

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
};

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
};

// ==================== UTILITY CONTROLLERS ====================

/**
 * Download the generated excel file
 */
export const downloadExcel = async (req, res) => {
  try {
    const { fileName } = req.params;
    
    // Validate filename to prevent path traversal attacks
    if (!fileName || !/^[\w\-. ]+\.xlsx$/.test(fileName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename',
        message: 'Filename must be a valid Excel file'
      });
    }

    // Construct file path
    const filePath = path.join(process.cwd(), 'exports', fileName);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
        message: 'The requested Excel file does not exist or has expired'
      });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Stream the file to client
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to download file',
          message: error.message
        });
      }
    });

    fileStream.pipe(res);
    
    // Optional: Delete file after download
    fileStream.on('end', () => {
      setTimeout(() => {
        fs.unlink(filePath, (err) => {
          if (err) console.error('Error deleting file:', err);
          else console.log(`🗑️ Cleaned up file: ${fileName}`);
        });
      }, 5000);
    });
  } catch (error) {
    console.error('Error downloading Excel file:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to download file',
        message: error.message
      });
    }
  }
};
