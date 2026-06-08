import { userRepository, leaderboardRepository } from '../db/repositories';
import { User, UserStats } from '../types';
import { logger } from '../utils/logger';

export class UserService {
  async getOrCreateUser(
    telegramId: string,
    username: string | null,
    firstName: string
  ): Promise<User> {
    try {
      const user = await userRepository.upsert(telegramId, username, firstName);
      logger.debug('User retrieved or created', { userId: user.id, telegramId });
      return user;
    } catch (error) {
      logger.error('Failed to get or create user', { error, telegramId });
      throw error;
    }
  }

  async getUserByTelegramId(telegramId: string): Promise<User | null> {
    return userRepository.findByTelegramId(telegramId);
  }

  async getUserById(userId: number): Promise<User | null> {
    return userRepository.findById(userId);
  }

  async getUserStats(userId: number): Promise<UserStats | null> {
    try {
      const user = await userRepository.findById(userId);
      if (!user) return null;

      const leaderboard = await leaderboardRepository.getLeaderboard();
      const userEntry = leaderboard.find((entry) => entry.user_id === userId);

      if (!userEntry) {
        // User exists but has no stats yet
        const rankInfo = await leaderboardRepository.getUserRank(userId);
        return {
          user,
          total_points: 0,
          total_bets: 0,
          scored_bets: 0,
          pending_bets: 0,
          rank: rankInfo?.rank || 0,
          total_users: rankInfo?.total_users || 0,
          exact_scores: 0,
          goal_diffs: 0,
          three_pt_scores: 0,
          two_pt_scores: 0,
          one_pt_scores: 0,
          zero_scores: 0,
          bonus_points: 0,
        };
      }

      const scoredBets = Number(userEntry.scored_bets);
      const pendingBets = Number(userEntry.total_bets) - scoredBets;

      return {
        user,
        total_points: Number(userEntry.total_points),
        total_bets: Number(userEntry.total_bets),
        scored_bets: scoredBets,
        pending_bets: pendingBets,
        rank: Number(userEntry.rank),
        total_users: leaderboard.length,
        exact_scores: Number(userEntry.exact_scores),
        goal_diffs: Number(userEntry.goal_diffs),
        three_pt_scores: Number(userEntry.three_pt_scores),
        two_pt_scores: Number(userEntry.two_pt_scores),
        one_pt_scores: Number(userEntry.one_pt_scores),
        zero_scores: Number(userEntry.zero_scores),
        bonus_points: Number(userEntry.bonus_points),
      };
    } catch (error) {
      logger.error('Failed to get user stats', { error, userId });
      throw error;
    }
  }
}

export const userService = new UserService();
