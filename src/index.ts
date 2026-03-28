import { logger } from './utils/logger';
import { db } from './db/database';
import { runMigrations } from './db/migrate';
import { telegramBot } from './bot';
import { jobScheduler } from './jobs/scheduler';
import { fixtureSyncJob } from './jobs/fixture-sync.job';

async function bootstrap() {
  try {
    logger.info('Starting Football Predictor Bot');

    // Test database connection
    logger.info('Testing database connection...');
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    // Run migrations
    logger.info('Running database migrations...');
    await runMigrations();

    // Run initial fixture sync to ensure matches are available
    logger.info('Running initial fixture sync...');
    await fixtureSyncJob.run();
    logger.info('Fixture sync completed - matches are now available');

    // Launch Telegram bot
    logger.info('Launching Telegram bot...');
    await telegramBot.launch();

    // Set bot instance for scheduler (needed for notifications)
    jobScheduler.setBot(telegramBot.getBot());

    // Start job scheduler (which will handle periodic updates)
    logger.info('Starting job scheduler...');
    jobScheduler.start();

    logger.info('Football Predictor Bot is running! 🚀');
  } catch (error) {
    logger.error('Failed to start application', { error });
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  try {
    // Stop job scheduler
    jobScheduler.stop();

    // Stop bot
    await telegramBot.stop(signal);

    // Close database connection
    await db.close();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});

// Start the application
bootstrap();
