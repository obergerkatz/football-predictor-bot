import { leaderboardRepository } from '../db/repositories';
import { LeaderboardEntry } from '../types';
import { logger } from '../utils/logger';
import { SERVICE_ERROR_PREFIX } from '../constants';

export class LeaderboardService {
  async getLeaderboard(limit?: number): Promise<LeaderboardEntry[]> {
    try {
      const leaderboard = await leaderboardRepository.getLeaderboard(limit);
      logger.debug(`Retrieved leaderboard with ${leaderboard.length} entries`);
      return leaderboard;
    } catch (error) {
      logger.error(SERVICE_ERROR_PREFIX.FAILED_TO_GET_LEADERBOARD, { error });
      throw error;
    }
  }

  async getUserRank(userId: number): Promise<{ rank: number; total_users: number } | null> {
    try {
      const rankInfo = await leaderboardRepository.getUserRank(userId);
      return rankInfo;
    } catch (error) {
      logger.error(SERVICE_ERROR_PREFIX.FAILED_TO_GET_USER_RANK, { error, userId });
      throw error;
    }
  }
}

export const leaderboardService = new LeaderboardService();
