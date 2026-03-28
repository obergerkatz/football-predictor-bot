import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from './database';
import { logger } from '../utils/logger';

async function runMigrations() {
  try {
    logger.info('Starting database migrations...');

    // Create migrations tracking table
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const migrations = [
      '001_initial_schema.sql',
      '002_tournament_predictions.sql',
      '007_create_group_stage_predictions.sql',
      '008_expand_group_stage_to_12_groups.sql',
      '009_add_league_code.sql',
      '010_add_league_to_predictions.sql',
      '011_create_notifications.sql',
    ];

    for (const migrationFile of migrations) {
      // Check if migration already executed
      const result = await db.query('SELECT id FROM migrations WHERE name = $1', [migrationFile]);

      if (result.rows.length > 0) {
        logger.info(`Migration ${migrationFile} already executed, skipping`);
        continue;
      }

      // Read and execute migration
      const migrationPath = join(__dirname, 'migrations', migrationFile);
      const sql = readFileSync(migrationPath, 'utf8');

      logger.info(`Executing migration: ${migrationFile}`);
      await db.query(sql);

      // Record migration
      await db.query('INSERT INTO migrations (name) VALUES ($1)', [migrationFile]);

      logger.info(`Migration ${migrationFile} completed successfully`);
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed', { error });
    throw error;
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration process failed', { error });
      process.exit(1);
    });
}

export { runMigrations };
