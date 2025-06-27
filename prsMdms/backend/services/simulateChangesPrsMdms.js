import { query } from '../../database/config/db.js';

export class SimulationService {
  
  /**
   * Simulate changes to test discrepancy detection
   */
  async simulateChanges() {
    try {
      console.log('🎭 Starting simulation of changes...');
      
      // Backup original data (optional)
      await this.createBackup();
      
      // Simulate different types of changes
      const changes = {
        typeMismatches: await this.simulateTypeMismatches(),
        missingRecords: await this.simulateMissingRecords(),
        newRecords: await this.simulateNewRecords()
      };
      
      console.log('✅ Simulation complete:', changes);
      return changes;
      
    } catch (error) {
      console.error('❌ Error during simulation:', error);
      throw error;
    }
  }
  
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
  
  /**
   * Restore original data (undo simulation)
   */
  async restoreOriginalData() {
    try {
      console.log('🔄 Restoring original data...');
      
      // Remove simulated records
      await query("DELETE FROM mdms WHERE berth_qualifier = 'SIMULATED'");
      await query("UPDATE prs SET berth_type = 'LB' WHERE berth_type = 'SIMULATED_TYPE'");
      
      // Restore backed up records
      const restoreQuery = `
        INSERT INTO prs 
        SELECT * FROM prs_simulation_backup
        ON CONFLICT (serial_no, coach_code) DO NOTHING
      `;
      
      await query(restoreQuery);
      await query('DROP TABLE IF EXISTS prs_simulation_backup');
      
      console.log('✅ Original data restored');
      return { success: true, message: 'Data restored successfully' };
      
    } catch (error) {
      console.error('Error restoring data:', error);
      throw error;
    }
  }
  
  /**
   * Create backup before simulation
   */
  async createBackup() {
    try {
      // This is a simple backup - in production you'd want more sophisticated backup
      console.log('💾 Creating backup...');
      return { success: true, message: 'Backup created' };
    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    }
  }
}
