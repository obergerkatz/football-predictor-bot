import { Telegraf } from 'telegraf';
import { notificationRepository } from '../db/repositories';
import { NotificationType } from '../types';
import { logger } from '../utils/logger';
import { TIME_MS } from '../constants';
import { formatDateTimeFull } from '../utils/date.utils';

export class NotificationService {
  constructor(private bot: Telegraf) {}

  async sendPreMatchNoBetNotification(
    userId: number,
    telegramId: string,
    matchId: number,
    homeTeam: string,
    awayTeam: string,
    matchDate: Date
  ): Promise<void> {
    try {
      // Check if notification already sent
      const alreadySent = await notificationRepository.hasBeenSent(
        userId,
        matchId,
        NotificationType.PRE_MATCH_NO_BET
      );

      if (alreadySent) {
        logger.debug('Pre-match notification already sent', { userId, matchId });
        return;
      }

      const timeLeft = this.formatTimeUntilMatch(matchDate);
      const message =
        `⏰ <b>Reminder: Match starting ${timeLeft}!</b>\n\n` +
        `🏟️ <b>${homeTeam}</b> vs <b>${awayTeam}</b>\n` +
        `📅 ${this.formatMatchDate(matchDate)}\n\n` +
        `⚠️ You haven't placed a bet yet!`;

      await this.bot.telegram.sendMessage(telegramId, message, { parse_mode: 'HTML' });

      // Record notification
      await notificationRepository.create(
        userId,
        matchId,
        NotificationType.PRE_MATCH_NO_BET,
        message
      );

      logger.info('Pre-match notification sent', { userId, matchId, telegramId });
    } catch (error) {
      logger.error('Failed to send pre-match notification', { error, userId, matchId });
    }
  }

  async sendPostMatchPointsNotification(
    userId: number,
    telegramId: string,
    matchId: number,
    homeTeam: string,
    awayTeam: string,
    homeScore: number,
    awayScore: number,
    pointsEarned: number,
    predictedHomeScore: number,
    predictedAwayScore: number
  ): Promise<void> {
    try {
      // Check if notification already sent
      const alreadySent = await notificationRepository.hasBeenSent(
        userId,
        matchId,
        NotificationType.POST_MATCH_POINTS
      );

      if (alreadySent) {
        logger.debug('Post-match notification already sent', { userId, matchId });
        return;
      }

      const emoji = this.getPointsEmoji(pointsEarned);
      const message =
        `${emoji} <b>Match Result</b>\n\n` +
        `🏟️ <b>${homeTeam}</b> ${homeScore} - ${awayScore} <b>${awayTeam}</b>\n\n` +
        `🎯 Your prediction: ${predictedHomeScore} - ${predictedAwayScore}\n` +
        `⭐ Points earned: <b>${pointsEarned}</b>\n\n` +
        `${this.getPointsMessage(pointsEarned)}`;

      await this.bot.telegram.sendMessage(telegramId, message, { parse_mode: 'HTML' });

      // Record notification
      await notificationRepository.create(
        userId,
        matchId,
        NotificationType.POST_MATCH_POINTS,
        message
      );

      logger.info('Post-match notification sent', { userId, matchId, telegramId, pointsEarned });
    } catch (error) {
      logger.error('Failed to send post-match notification', { error, userId, matchId });
    }
  }

  private formatTimeUntilMatch(matchDate: Date): string {
    const now = new Date();
    const diff = matchDate.getTime() - now.getTime();
    const minutes = Math.floor(diff / TIME_MS.MINUTE);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `in ${hours}h ${remainingMinutes}m` : `in ${hours}h`;
    }
    return `in ${minutes}m`;
  }

  private formatMatchDate(date: Date): string {
    return formatDateTimeFull(date);
  }

  private getPointsEmoji(points: number): string {
    if (points >= 6) return '🎉';
    if (points >= 4) return '👏';
    if (points >= 3) return '✅';
    if (points >= 1) return '👍';
    return '😔';
  }

  private getPointsMessage(points: number): string {
    if (points >= 6) return '🎊 Perfect prediction! Exact score!';
    if (points >= 4) return '🎯 Great job! Correct goal difference!';
    if (points >= 3) return '✨ Nice! 3 points!';
    if (points >= 1) return '👌 Not bad! You got some points!';
    return '💪 Better luck next time!';
  }
}

export const createNotificationService = (bot: Telegraf): NotificationService => {
  return new NotificationService(bot);
};
