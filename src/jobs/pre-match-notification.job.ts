import { matchRepository, betRepository } from '../db/repositories';
import { db } from '../db/database';
import { NotificationService } from '../services/notification.service';
import { User } from '../types';
import { logger } from '../utils/logger';
import { NOTIFICATION_WINDOW } from '../constants';

export class PreMatchNotificationJob {
  constructor(private notificationService: NotificationService) {}

  async run(): Promise<void> {
    try {
      logger.info('Starting pre-match notification job');

      // Find matches starting in the next 1-2 hours
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + NOTIFICATION_WINDOW.PRE_MATCH_MIN);
      const twoHoursFromNow = new Date(now.getTime() + NOTIFICATION_WINDOW.PRE_MATCH_MAX);

      // Get upcoming scheduled matches
      const upcomingMatches = await matchRepository.findUpcoming();

      // Filter matches that start in 1-2 hours
      const matchesInWindow = upcomingMatches.filter((match) => {
        const matchTime = new Date(match.match_date);
        return matchTime > oneHourFromNow && matchTime <= twoHoursFromNow;
      });

      logger.info(`Found ${matchesInWindow.length} matches starting in 1-2 hours`);

      for (const match of matchesInWindow) {
        try {
          // Get all users
          const allUsers = await this.getAllUsers();

          for (const user of allUsers) {
            // Check if user has placed a bet for this match
            const bet = await betRepository.findByUserAndMatch(user.id, match.id);

            if (!bet) {
              // User hasn't placed a bet, send notification
              await this.notificationService.sendPreMatchNoBetNotification(
                user.id,
                user.telegram_id,
                match.id,
                match.home_team,
                match.away_team,
                new Date(match.match_date)
              );
            }
          }
        } catch (error) {
          logger.error('Error processing match for pre-match notifications', {
            error,
            matchId: match.id,
          });
        }
      }

      logger.info('Pre-match notification job completed');
    } catch (error) {
      logger.error('Pre-match notification job failed', { error });
      throw error;
    }
  }

  private async getAllUsers(): Promise<User[]> {
    // This is a simple implementation - in production you might want to add pagination
    const result = await db.query<User>('SELECT * FROM users');
    return result.rows;
  }
}

export const createPreMatchNotificationJob = (
  notificationService: NotificationService
): PreMatchNotificationJob => {
  return new PreMatchNotificationJob(notificationService);
};
