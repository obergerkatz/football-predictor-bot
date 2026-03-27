import cron from 'node-cron';
import { fixtureSyncJob } from './fixture-sync.job';
import { matchUpdateJob } from './match-update.job';
import { scoringJob } from './scoring.job';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

export class JobScheduler {
  private jobs: cron.ScheduledTask[] = [];

  start(): void {
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

    this.jobs = [fetchNewFixturesCron, refreshMatchesStatusesCron, calculateUserPointsCron];

    // Start all jobs
    this.jobs.forEach((job) => job.start());

    logger.info('Job scheduler started', {
      fetchNewFixturesCron: config.jobs.fetchNewFixturesCron,
      refreshMatchesStatusesCron: config.jobs.refreshMatchesStatusesCron,
      calculateUserPointsCron: config.jobs.calculateUserPointsCron,
    });
  }

  stop(): void {
    logger.info('Stopping job scheduler');
    this.jobs.forEach((job) => job.stop());
  }
}

export const jobScheduler = new JobScheduler();
