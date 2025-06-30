import { query } from '../../database/config/db.js';

export class SimulationService {
  
  /**
   * Simulate changes to test both discrepancy and duplicate detection
   */
  async simulateChanges() {
    try {
      console.log('🎭 Starting comprehensive simulation of changes...');
      
      // Backup original data (optional)
      await this.createBackup();
      
      // Simulate different types of changes
      const changes = {
        // Discrepancy simulations
        typeMismatches: await this.simulateTypeMismatches(),
        missingRecords: await this.simulateMissingRecords(),
        newRecords: await this.simulateNewRecords(),
        
        // Duplicate simulations
        prsDuplicates: await this.simulatePrsDuplicates(),
        mdmsDuplicates: await this.simulateMdmsDuplicates(),
        crossTableDuplicates: await this.simulateCrossTableDuplicates()
      };
      
      console.log('✅ Comprehensive simulation complete:', changes);
      return changes;
      
    } catch (error) {
      console.error('❌ Error during simulation:', error);
      throw error;
    }
  }
  
  // ==================== DISCREPANCY SIMULATIONS ====================
  
  /**
   * Simulate type mismatches by changing berth types
   */
  async simulateTypeMismatches() {
    try {
      // Change some PRS berth types to create mismatches
      const updateQuery = `
        UPDATE prs 
        SET berth_type = 'SIMULATED_TYPE'
        WHERE serial_no IN (
          SELECT serial_no FROM prs 
          ORDER BY RANDOM() 
          LIMIT 5
        )
      `;
      
      const result = await query(updateQuery);
      console.log(`🔄 Simulated ${result.rowCount} type mismatches`);
      return result.rowCount;
      
    } catch (error) {
      console.error('Error simulating type mismatches:', error);
      throw error;
    }
  }
  
  /**
   * Simulate missing records by temporarily removing some
   */
  async simulateMissingRecords() {
    try {
      // Create a temporary table to store "deleted" records
      await query(`
        CREATE TABLE IF NOT EXISTS prs_simulation_backup AS 
        SELECT * FROM prs WHERE 1=0
      `);
      
      // Move some records to backup (simulate deletion)
      const moveQuery = `
        WITH records_to_move AS (
          SELECT * FROM prs 
          ORDER BY RANDOM() 
          LIMIT 3
        )
        INSERT INTO prs_simulation_backup 
        SELECT * FROM records_to_move
      `;
      
      await query(moveQuery);
      
      // Delete the moved records
      const deleteQuery = `
        DELETE FROM prs 
        WHERE serial_no IN (
          SELECT serial_no FROM prs_simulation_backup
        )
      `;
      
      const result = await query(deleteQuery);
      console.log(`🗑️ Simulated ${result.rowCount} missing records`);
      return result.rowCount;
      
    } catch (error) {
      console.error('Error simulating missing records:', error);
      throw error;
    }
  }
  
  /**
   * Simulate new records by adding test data
   */
  async simulateNewRecords() {
    try {
      // Add some new records to MDMS that don't exist in PRS
      const insertQuery = `
        INSERT INTO mdms (
          serial_no, layout_variant_no, composite_flag, 
          coach_class_first, prs_coach_code, coach_class, 
          berth_no, berth_qualifier
        ) VALUES 
        (99991, 'SIM001', false, 'SL', 'SIM-COACH-1', 'SL', 1, 'SIMULATED'),
        (99992, 'SIM002', false, 'AC', 'SIM-COACH-2', 'AC', 2, 'SIMULATED'),
        (99993, 'SIM003', false, '3A', 'SIM-COACH-3', '3A', 3, 'SIMULATED')
      `;
      
      const result = await query(insertQuery);
      console.log(`➕ Simulated ${result.rowCount} new records`);
      return result.rowCount;
      
    } catch (error) {
      console.error('Error simulating new records:', error);
      throw error;
    }
  }
  
  // ==================== DUPLICATE SIMULATIONS ====================
  
  /**
   * Simulate duplicates within PRS table
   */
  async simulatePrsDuplicates() {
    try {
      // First, get some existing records to duplicate
      const getRecordsQuery = `
        SELECT coach_code, class, berth_number, berth_type 
        FROM prs 
        ORDER BY RANDOM() 
        LIMIT 3
      `;
      
      const existingRecords = await query(getRecordsQuery);
      let duplicatesCreated = 0;
      
      // Create duplicates by inserting similar records with different serial numbers
      for (const record of existingRecords.rows) {
        const insertQuery = `
          INSERT INTO prs (
            serial_no, coach_code, class, berth_number, berth_type
          ) VALUES (
            99000 + $1,
            $2,
            $3,
            $4,
            $5
          )
        `;
        
        try {
          await query(insertQuery, [
            duplicatesCreated + 1,
            record.coach_code,
            record.class,
            record.berth_number,
            record.berth_type
          ]);
          duplicatesCreated++;
        } catch (err) {
          // Skip if constraint violation (duplicate serial_no)
          console.log(`Skipping duplicate creation due to constraint: ${err.message}`);
        }
      }
      
      console.log(`🔄 Simulated ${duplicatesCreated} PRS internal duplicates`);
      return duplicatesCreated;
      
    } catch (error) {
      console.error('Error simulating PRS duplicates:', error);
      throw error;
    }
  }
  
  /**
   * Simulate duplicates within MDMS table
   */
  async simulateMdmsDuplicates() {
    try {
      // Get some existing MDMS records to duplicate
      const getRecordsQuery = `
        SELECT prs_coach_code, coach_class, berth_no, berth_qualifier,
               layout_variant_no, composite_flag, coach_class_first
        FROM mdms 
        ORDER BY RANDOM() 
        LIMIT 3
      `;
      
      const existingRecords = await query(getRecordsQuery);
      let duplicatesCreated = 0;
      
      // Create duplicates by inserting similar records with different serial numbers
      for (const record of existingRecords.rows) {
        const insertQuery = `
          INSERT INTO mdms (
            serial_no, layout_variant_no, composite_flag, 
            coach_class_first, prs_coach_code, coach_class, 
            berth_no, berth_qualifier
          ) VALUES (
            99100 + $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8
          )
        `;
        
        try {
          await query(insertQuery, [
            duplicatesCreated + 1,
            record.layout_variant_no || 'SIM_VARIANT',
            record.composite_flag || false,
            record.coach_class_first || record.coach_class,
            record.prs_coach_code,
            record.coach_class,
            record.berth_no,
            record.berth_qualifier
          ]);
          duplicatesCreated++;
        } catch (err) {
          // Skip if constraint violation
          console.log(`Skipping MDMS duplicate creation due to constraint: ${err.message}`);
        }
      }
      
      console.log(`🔄 Simulated ${duplicatesCreated} MDMS internal duplicates`);
      return duplicatesCreated;
      
    } catch (error) {
      console.error('Error simulating MDMS duplicates:', error);
      throw error;
    }
  }
  
  /**
   * Simulate cross-table duplicates (same combination appears multiple times across both tables)
   */
  async simulateCrossTableDuplicates() {
    try {
      // Find some matching records between PRS and MDMS
      const getMatchingRecordsQuery = `
        SELECT 
          p.coach_code,
          p.class,
          p.berth_number,
          p.berth_type,
          m.berth_qualifier
        FROM prs p
        INNER JOIN mdms m 
          ON TRIM(LOWER(p.coach_code)) = TRIM(LOWER(m.prs_coach_code))
          AND TRIM(LOWER(p.class)) = TRIM(LOWER(m.coach_class))
          AND p.berth_number::INT = m.berth_no
        ORDER BY RANDOM()
        LIMIT 2
      `;
      
      const matchingRecords = await query(getMatchingRecordsQuery);
      let crossDuplicatesCreated = 0;
      
      // Create additional entries in both tables for the same combination
      for (const record of matchingRecords.rows) {
        try {
          // Add duplicate to PRS
          const insertPrsQuery = `
            INSERT INTO prs (
              serial_no, coach_code, class, berth_number, berth_type
            ) VALUES (
              99200 + $1,
              $2,
              $3,
              $4,
              $5
            )
          `;
          
          await query(insertPrsQuery, [
            crossDuplicatesCreated + 1,
            record.coach_code,
            record.class,
            record.berth_number,
            record.berth_type
          ]);
          
          // Add duplicate to MDMS
          const insertMdmsQuery = `
            INSERT INTO mdms (
              serial_no, layout_variant_no, composite_flag, 
              coach_class_first, prs_coach_code, coach_class, 
              berth_no, berth_qualifier
            ) VALUES (
              99300 + $1,
              'CROSS_SIM',
              false,
              $2,
              $3,
              $4,
              $5,
              $6
            )
          `;
          
          await query(insertMdmsQuery, [
            crossDuplicatesCreated + 1,
            record.class,
            record.coach_code,
            record.class,
            parseInt(record.berth_number),
            record.berth_qualifier
          ]);
          
          crossDuplicatesCreated++;
        } catch (err) {
          console.log(`Skipping cross-table duplicate creation due to constraint: ${err.message}`);
        }
      }
      
      console.log(`🔄 Simulated ${crossDuplicatesCreated} cross-table duplicate combinations`);
      return crossDuplicatesCreated;
      
    } catch (error) {
      console.error('Error simulating cross-table duplicates:', error);
      throw error;
    }
  }
  
  // ==================== SPECIALIZED SIMULATION METHODS ====================
  
  /**
   * Simulate only discrepancy-related changes
   */
  async simulateDiscrepanciesOnly() {
    try {
      console.log('🎭 Simulating discrepancy scenarios only...');
      
      const changes = {
        typeMismatches: await this.simulateTypeMismatches(),
        missingRecords: await this.simulateMissingRecords(),
        newRecords: await this.simulateNewRecords()
      };
      
      console.log('✅ Discrepancy simulation complete:', changes);
      return changes;
      
    } catch (error) {
      console.error('❌ Error during discrepancy simulation:', error);
      throw error;
    }
  }
  
  /**
   * Simulate only duplicate-related changes
   */
  async simulateDuplicatesOnly() {
    try {
      console.log('🎭 Simulating duplicate scenarios only...');
      
      const changes = {
        prsDuplicates: await this.simulatePrsDuplicates(),
        mdmsDuplicates: await this.simulateMdmsDuplicates(),
        crossTableDuplicates: await this.simulateCrossTableDuplicates()
      };
      
      console.log('✅ Duplicate simulation complete:', changes);
      return changes;
      
    } catch (error) {
      console.error('❌ Error during duplicate simulation:', error);
      throw error;
    }
  }
  
  // ==================== RESTORATION METHODS ====================
  
  /**
   * Restore original data (undo simulation)
   */
  async restoreOriginalData() {
    try {
      console.log('🔄 Restoring original data...');
      
      // Remove all simulated records
      await this.cleanupSimulatedData();
      
      // Restore backed up records
      await this.restoreBackedUpRecords();
      
      console.log('✅ Original data restored');
      return { 
        success: true, 
        message: 'Data restored successfully',
        details: 'All simulated records removed and backed up records restored'
      };
      
    } catch (error) {
      console.error('Error restoring data:', error);
      throw error;
    }
  }
  
  /**
   * Clean up all simulated data
   */
  async cleanupSimulatedData() {
    try {
      // Remove simulated discrepancy records
      await query("DELETE FROM mdms WHERE berth_qualifier = 'SIMULATED'");
      await query("UPDATE prs SET berth_type = 'LB' WHERE berth_type = 'SIMULATED_TYPE'");
      
      // Remove simulated duplicate records (using serial number ranges)
      await query("DELETE FROM prs WHERE serial_no >= 99000 AND serial_no <= 99999");
      await query("DELETE FROM mdms WHERE serial_no >= 99000 AND serial_no <= 99999");
      
      // Remove records with simulation-specific values
      await query("DELETE FROM mdms WHERE layout_variant_no IN ('SIM_VARIANT', 'CROSS_SIM')");
      
      console.log('🧹 Cleaned up all simulated data');
      
    } catch (error) {
      console.error('Error cleaning up simulated data:', error);
      throw error;
    }
  }
  
  /**
   * Restore backed up records
   */
  async restoreBackedUpRecords() {
    try {
      // Restore backed up records
      const restoreQuery = `
        INSERT INTO prs 
        SELECT * FROM prs_simulation_backup
        ON CONFLICT (serial_no) DO NOTHING
      `;
      
      const result = await query(restoreQuery);
      console.log(`🔄 Restored ${result.rowCount} backed up records`);
      
      // Clean up backup table
      await query('DROP TABLE IF EXISTS prs_simulation_backup');
      
    } catch (error) {
      console.error('Error restoring backed up records:', error);
      throw error;
    }
  }
  
  // ==================== UTILITY METHODS ====================
  
  /**
   * Create backup before simulation
   */
  async createBackup() {
    try {
      console.log('💾 Creating simulation backup...');
      
      // Create backup tables if they don't exist
      await query(`
        CREATE TABLE IF NOT EXISTS prs_simulation_backup AS 
        SELECT * FROM prs WHERE 1=0
      `);
      
      await query(`
        CREATE TABLE IF NOT EXISTS mdms_simulation_backup AS 
        SELECT * FROM mdms WHERE 1=0
      `);
      
      console.log('✅ Backup tables ready');
      return { success: true, message: 'Backup infrastructure created' };
      
    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    }
  }
  
  /**
   * Get simulation status and summary
   */
  async getSimulationStatus() {
    try {
      // Check for simulated records
      const prsSimulatedCount = await query("SELECT COUNT(*) as count FROM prs WHERE serial_no >= 99000");
      const mdmsSimulatedCount = await query("SELECT COUNT(*) as count FROM mdms WHERE serial_no >= 99000");
      const typeMismatchCount = await query("SELECT COUNT(*) as count FROM prs WHERE berth_type = 'SIMULATED_TYPE'");
      const simulatedQualifierCount = await query("SELECT COUNT(*) as count FROM mdms WHERE berth_qualifier = 'SIMULATED'");
      
      const hasSimulatedData = 
        parseInt(prsSimulatedCount.rows[0].count) > 0 ||
        parseInt(mdmsSimulatedCount.rows[0].count) > 0 ||
        parseInt(typeMismatchCount.rows[0].count) > 0 ||
        parseInt(simulatedQualifierCount.rows[0].count) > 0;
      
      return {
        hasSimulatedData,
        simulatedRecords: {
          prsRecords: parseInt(prsSimulatedCount.rows[0].count),
          mdmsRecords: parseInt(mdmsSimulatedCount.rows[0].count),
          typeMismatches: parseInt(typeMismatchCount.rows[0].count),
          simulatedQualifiers: parseInt(simulatedQualifierCount.rows[0].count)
        },
        message: hasSimulatedData ? 'Simulation data detected' : 'No simulation data found'
      };
      
    } catch (error) {
      console.error('Error checking simulation status:', error);
      throw error;
    }
  }
}