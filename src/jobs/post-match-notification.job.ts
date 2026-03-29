import { matchRepository, betRepository, scoreRepository } from '../db/repositories';
import { db } from '../db/database';
import { NotificationService } from '../services/notification.service';
import { User } from '../types';
import { logger } from '../utils/logger';
import { NOTIFICATION_WINDOW } from '../constants';

export class PostMatchNotificationJob {
  constructor(private notificationService: NotificationService) {}

  async run(): Promise<void> {
    try {
      logger.info('Starting post-match notification job');

      // Find recently finished matches (last 2 hours)
      const twoHoursAgo = new Date(Date.now() - NOTIFICATION_WINDOW.POST_MATCH);
      const finishedMatches = await matchRepository.findRecentFinished(50);

      // Filter to only matches finished in the last 2 hours
      const recentlyFinished = finishedMatches.filter((match) => {
        const updatedAt = new Date(match.updated_at);
        return updatedAt >= twoHoursAgo;
      });

      logger.info(`Found ${recentlyFinished.length} recently finished matches`);

      for (const match of recentlyFinished) {
        try {
          // Only notify if match has final scores
          if (match.home_score_ft === null || match.away_score_ft === null) {
            continue;
          }

          // Get all bets for this match
          const bets = await betRepository.findByMatch(match.id);

          logger.info(`Processing ${bets.length} bets for match ${match.id}`);

          for (const bet of bets) {
            try {
              // Get the score for this bet
              const score = await scoreRepository.findByBetId(bet.id);

              if (!score) {
                logger.debug('No score found for bet, skipping notification', {
                  betId: bet.id,
                  matchId: match.id,
                });
                continue;
              }

              // Get user info
              const userResult = await db.query<User>('SELECT * FROM users WHERE id = $1', [
                bet.user_id,
              ]);
              const user = userResult.rows[0];

              if (!user) {
                logger.warn('User not found for bet', { betId: bet.id, userId: bet.user_id });
                continue;
              }

              // Send notification
              await this.notificationService.sendPostMatchPointsNotification(
                user.id,
                user.telegram_id,
                match.id,
                match.home_team,
                match.away_team,
                match.home_score_ft,
                match.away_score_ft,
                score.points_awarded,
                bet.predicted_home_score,
                bet.predicted_away_score
              );
            } catch (error) {
              logger.error('Error sending notification for bet', {
                error,
                betId: bet.id,
                matchId: match.id,
              });
            }
          }
        } catch (error) {
          logger.error('Error processing match for post-match notifications', {
            error,
            matchId: match.id,
          });
        }
      }

      logger.info('Post-match notification job completed');
    } catch (error) {
      logger.error('Post-match notification job failed', { error });
      throw error;
    }
  }
}

export const createPostMatchNotificationJob = (
  notificationService: NotificationService
): PostMatchNotificationJob => {
  return new PostMatchNotificationJob(notificationService);
};
