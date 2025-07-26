    import fs from 'fs';
    import path from 'path';
    import crypto from 'crypto';
    import { exec } from 'child_process';
    import { promisify } from 'util';
    import { query } from '../../database/config/db.js';

    const execAsync = promisify(exec);

    export class SmartSeeder {
        constructor(config) {
            this.config = {
                watchDirectory: config.watchDirectory || './data/excel',
                seederPath: config.seederPath || 'database/ingestion/prsMdmsDataSeeder.js',
                filePattern: config.filePattern || /\.(xlsx|xls)$/i,
                debounceTime: config.debounceTime || 3000,
                hashFile: config.hashFile || '.file_hashes.json',
                ...config
            };

            this.fileHashes = {};
            this.debounceTimer = null;
            this.isSeeding = false;
            this.watchers = [];
        }

        async initialize() {
            try {
                console.log('🔧 Initializing Smart Seeder with whitespace trimming...');

                // Ensure watch directory exists
                if (!fs.existsSync(this.config.watchDirectory)) {
                    fs.mkdirSync(this.config.watchDirectory, { recursive: true });
                    console.log(`📁 Created watch directory: ${this.config.watchDirectory}`);
                }

                // Load existing file hashes
                await this.loadFileHashes();

                // Check for changes in existing files
                const { fileChanged, dbEmpty } = await this.checkForChanges();

                // Ensure data seeding is allowed
                const target = process.env.DB_TARGET;
                const allowDDL = process.env.ALLOW_TABLE_CREATION;

                if (target === 'local' && allowDDL) {
                    if (fileChanged || dbEmpty) {
                    if (dbEmpty && !fileChanged) {
                        console.log('📉 Database was empty — seeding triggered');
                    }
                    else {
                        console.log('🔄 Changes detected in Excel files, seeding with whitespace cleanup...')
                    }
                    await this.seedWithWhitespaceCleanup();
                } else {
                    console.log('✅ No changes detected, skipping seeding');
                }

                // Start watching for new changes
                this.startWatching();

                console.log(`👁️ Smart seeder initialized, watching: ${this.config.watchDirectory}`);
                } else if (target === 'remote') {
                    console.log('⚠️ Production mode: Seeding disabled for remote database');
                    console.log('💡 Ensure tables and data are pre-loaded by database administrators');
                } else {
                    
                }
                return true;
            } catch (error) {
                console.error('❌ Error initializing smart seeder:', error);
                throw error;
            }
        }

        async loadFileHashes() {
            const hashFilePath = path.join(process.cwd(), this.config.hashFile);

            try {
                if (fs.existsSync(hashFilePath)) {
                    const data = fs.readFileSync(hashFilePath, 'utf8');
                    this.fileHashes = JSON.parse(data);
                    console.log('📋 Loaded existing file hash tracking');
                } else {
                    console.log('📝 Creating new file hash tracking');
                    this.fileHashes = {};
                }
            } catch (error) {
                console.error('⚠️ Error loading file hashes, creating new tracking:', error.message);
                this.fileHashes = {};
            }
        }

        async saveFileHashes() {
            const hashFilePath = path.join(process.cwd(), this.config.hashFile);

            try {
                fs.writeFileSync(hashFilePath, JSON.stringify(this.fileHashes, null, 2));
            } catch (error) {
                console.error('❌ Error saving file hashes:', error);
            }
        }

        calculateFileHash(filePath) {
            try {
                const fileBuffer = fs.readFileSync(filePath);
                const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
                return hash;
            } catch (error) {
                console.error(`❌ Error calculating hash for ${filePath}:`, error);
                return null;
            }
        }

        async checkForChanges() {
            const watchDir = this.config.watchDirectory;

            if (!fs.existsSync(watchDir)) {
                console.log(`📁 Watch directory not found: ${watchDir}`);
                return false;
            }

            const files = fs.readdirSync(watchDir)
                .filter(file => this.config.filePattern.test(file))
                .map(file => path.join(watchDir, file));

            if (files.length === 0) {
                console.log('📂 No Excel files found in watch directory');
                return false;
            }

            let hasChanges = false;
            let dbNeedsSeeding = false;

            for (const filePath of files) {
                const currentHash = this.calculateFileHash(filePath);
                const storedHash = this.fileHashes[filePath];

                if (currentHash !== storedHash) {
                    console.log(`🔄 Change detected in: ${path.basename(filePath)}`);
                    this.fileHashes[filePath] = currentHash;
                    hasChanges = true;
                }
            }

            // Check if PRS and MDMS tables are empty
            try {
                const prsResult = await query('SELECT COUNT(*) FROM prs');
                const mdmsResult = await query('SELECT COUNT(*) FROM mdms');

                const prsCount = parseInt(prsResult.rows[0].count);
                const mdmsCount = parseInt(mdmsResult.rows[0].count);

                if (prsCount === 0 || mdmsCount === 0) {
                    console.log('📉 Database is empty, forcing seed');
                    hasChanges = true;
                    dbNeedsSeeding = true;
                }
            } catch (error) {
                console.error('❌ Error checking DB contents for seeding:', error);
                // Optional: fallback to seeding if DB check fails
                hasChanges = true;
                dbNeedsSeeding = true;
            }

            // Check for deleted files
            for (const trackedFile of Object.keys(this.fileHashes)) {
                if (trackedFile !== '_lastSeedTime' && !fs.existsSync(trackedFile)) {
                    console.log(`🗑️ File deleted: ${path.basename(trackedFile)}`);
                    delete this.fileHashes[trackedFile];
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                await this.saveFileHashes();
            }

            return {
                fileChanged: hasChanges && !dbNeedsSeeding,
                dbEmpty: dbNeedsSeeding
            }
        };

        startWatching() {
            const watchDir = this.config.watchDirectory;

            const watcher = fs.watch(watchDir, { recursive: true }, (eventType, filename) => {
                if (!filename || !this.config.filePattern.test(filename)) {
                    return;
                }

                console.log(`📝 File system event: ${eventType} - ${filename}`);
                this.debouncedCheck();
            });

            this.watchers.push(watcher);
            console.log(`👁️ File watcher started for: ${watchDir}`);
        }

        debouncedCheck() {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }

            this.debounceTimer = setTimeout(async () => {
                if (!this.isSeeding) {
                    const hasChanges = await this.checkForChanges();

                    if (hasChanges) {
                        await this.seedWithWhitespaceCleanup();
                    }
                }
            }, this.config.debounceTime);
        }

        async seedWithWhitespaceCleanup() {
            if (this.isSeeding) {
                console.log('⏳ Seeding already in progress...');
                return;
            }

            try {
                this.isSeeding = true;
                console.log('🧹 Starting intelligent seeding with whitespace cleanup...');

                const startTime = Date.now();

                // Add debugging lines here
                console.log(`🔧 Executing seeder command: node ${this.config.seederPath}`);
                console.log(`📁 Working directory: ${process.cwd()}`);
                console.log(`📄 Expected Excel file path: ${path.join(process.cwd(), 'database/excel/MDMS_PRS_Differences_BerthQualifier.xlsx')}`);

                // Step 1: Run the seeder with enhanced whitespace trimming
                const result = await execAsync(`node ${this.config.seederPath}`);

                // Add result debugging
                console.log('📊 Seeder stdout:', result.stdout);
                if (result.stderr) console.error('⚠️ Seeder stderr:', result.stderr);

                // Step 2: Clean any remaining whitespace after seeding
                await this.cleanExistingWhitespace();

                const endTime = Date.now();

                console.log(`✅ Smart seeding completed in ${endTime - startTime}ms`);

                // Update tracking
                this.fileHashes._lastSeedTime = Date.now();
                await this.saveFileHashes();

            } catch (error) {
                console.error('❌ Smart seeding failed:', error);
                console.error('❌ Error details:', error.message);
                console.error('❌ Stack trace:', error.stack);
                throw error;
            } finally {
                this.isSeeding = false;
            }
        }

        async cleanExistingWhitespace() {
            try {
                console.log('🧹 Cleaning whitespace from database...');

                // Clean PRS table
                const prsCleanQuery = `
            UPDATE prs SET 
            coach_code = TRIM(coach_code),
            class = TRIM(class),
            berth_type = TRIM(berth_type)
            WHERE 
            coach_code != TRIM(coach_code) OR
            class != TRIM(class) OR
            berth_type != TRIM(berth_type)
        `;

                const prsResult = await query(prsCleanQuery);
                if (prsResult.rowCount > 0) {
                    console.log(`🧹 Cleaned ${prsResult.rowCount} PRS records`);
                }

                // Clean MDMS table
                const mdmsCleanQuery = `
            UPDATE mdms SET
            prs_coach_code = TRIM(prs_coach_code),
            coach_class = TRIM(coach_class),
            berth_qualifier = TRIM(berth_qualifier),
            layout_variant_no = TRIM(layout_variant_no),
            coach_class_first = TRIM(coach_class_first),
            coach_class_second = TRIM(coach_class_second)
            WHERE 
            prs_coach_code != TRIM(prs_coach_code) OR
            coach_class != TRIM(coach_class) OR
            berth_qualifier != TRIM(berth_qualifier) OR
            layout_variant_no != TRIM(layout_variant_no) OR
            coach_class_first != TRIM(coach_class_first) OR
            coach_class_second != TRIM(coach_class_second)
        `;

                const mdmsResult = await query(mdmsCleanQuery);
                if (mdmsResult.rowCount > 0) {
                    console.log(`🧹 Cleaned ${mdmsResult.rowCount} MDMS records`);
                }

                if (prsResult.rowCount === 0 && mdmsResult.rowCount === 0) {
                    console.log('✅ No whitespace found in database');
                }

            } catch (error) {
                console.error('❌ Error cleaning whitespace:', error);
                throw error;
            }
        }

        async getStatus() {
            try {
                const watchDir = this.config.watchDirectory;
                const files = fs.existsSync(watchDir)
                    ? fs.readdirSync(watchDir).filter(file => this.config.filePattern.test(file))
                    : [];

                return {
                    isActive: this.watchers.length > 0,
                    isSeeding: this.isSeeding,
                    watchDirectory: watchDir,
                    trackedFiles: files.length,
                    lastSeedTime: this.fileHashes._lastSeedTime || null,
                    fileHashes: Object.keys(this.fileHashes).filter(key => key !== '_lastSeedTime')
                };
            } catch (error) {
                console.error('Error getting seeder status:', error);
                throw error;
            }
        }

        stop() {
            this.watchers.forEach(watcher => watcher.close());
            this.watchers = [];

            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }

            console.log('👁️ Smart seeder stopped');
        }
    }
