import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import { fixtureSyncJob } from './fixture-sync.job';
import { matchUpdateJob } from './match-update.job';
import { scoringJob } from './scoring.job';
import { createPreMatchNotificationJob } from './pre-match-notification.job';
import { createPostMatchNotificationJob } from './post-match-notification.job';
import { createNotificationService } from '../services/notification.service';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

export class JobScheduler {
  private jobs: cron.ScheduledTask[] = [];
  private bot?: Telegraf;

  setBot(bot: Telegraf): void {
    this.bot = bot;
  }

  start(): void {
    if (!this.bot) {
      throw new Error('Bot instance not set. Call setBot() before starting scheduler.');
    }
    logger.info('Starting job scheduler');

    // Fetch new fixtures job (default: every 6 hours)
    const fetchNewFixturesCron = cron.schedule(
      config.jobs.fetchNewFixturesCron,
      async () => {
        try {
          await fixtureSyncJob.run();
        } catch (error) {
          logger.error('Fetch new fixtures job error', { error });
        }
      },
      { scheduled: false }
    );

    // Refresh match statuses job (default: every 5 minutes)
    const refreshMatchesStatusesCron = cron.schedule(
      config.jobs.refreshMatchesStatusesCron,
      async () => {
        try {
          await matchUpdateJob.run();
        } catch (error) {
          logger.error('Refresh match statuses job error', { error });
        }
      },
      { scheduled: false }
    );

    // Calculate user points job (default: every 10 minutes)
    const calculateUserPointsCron = cron.schedule(
      config.jobs.calculateUserPointsCron,
      async () => {
        try {
          await scoringJob.run();
        } catch (error) {
          logger.error('Calculate user points job error', { error });
        }
      },
      { scheduled: false }
    );

    // Create notification service and jobs
    const notificationService = createNotificationService(this.bot);
    const preMatchNotificationJob = createPreMatchNotificationJob(notificationService);
    const postMatchNotificationJob = createPostMatchNotificationJob(notificationService);

    // Pre-match notification job (default: every 15 minutes)
    const preMatchNotificationCron = cron.schedule(
      config.jobs.preMatchNotificationCron,
      async () => {
        try {
          await preMatchNotificationJob.run();
        } catch (error) {
          logger.error('Pre-match notification job error', { error });
        }
      },
      { scheduled: false }
    );

    // Post-match notification job (default: every 15 minutes)
    const postMatchNotificationCron = cron.schedule(
      config.jobs.postMatchNotificationCron,
      async () => {
        try {
          await postMatchNotificationJob.run();
        } catch (error) {
          logger.error('Post-match notification job error', { error });
        }
      },
      { scheduled: false }
    );

    this.jobs = [
      fetchNewFixturesCron,
      refreshMatchesStatusesCron,
      calculateUserPointsCron,
      preMatchNotificationCron,
      postMatchNotificationCron,
    ];

    // Start all jobs
    this.jobs.forEach((job) => job.start());

    logger.info('Job scheduler started', {
      fetchNewFixturesCron: config.jobs.fetchNewFixturesCron,
      refreshMatchesStatusesCron: config.jobs.refreshMatchesStatusesCron,
      calculateUserPointsCron: config.jobs.calculateUserPointsCron,
      preMatchNotificationCron: config.jobs.preMatchNotificationCron,
      postMatchNotificationCron: config.jobs.postMatchNotificationCron,
    });
  }

  stop(): void {
    logger.info('Stopping job scheduler');
    this.jobs.forEach((job) => job.stop());
  }
}

export const jobScheduler = new JobScheduler();
