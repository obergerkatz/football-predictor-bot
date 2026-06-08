import { db } from '../database';
import { LeaderboardEntry } from '../../types';

export class LeaderboardRepository {
  async getLeaderboard(limit?: number): Promise<LeaderboardEntry[]> {
    const query = `
      SELECT
        user_id,
        telegram_id,
        username,
        first_name,
        total_points,
        total_bets,
        exact_scores,
        goal_diffs,
        three_pt_scores,
        two_pt_scores,
        one_pt_scores,
        zero_scores,
        scored_bets,
        bonus_points,
        ROW_NUMBER() OVER (ORDER BY total_points DESC, scored_bets DESC, total_bets DESC, user_id ASC) as rank
      FROM leaderboard_view
      ${limit ? `LIMIT $1` : ''}
    `;

    const result = await db.query<LeaderboardEntry>(query, limit ? [limit] : []);
    return result.rows;
  }

  async getUserRank(userId: number): Promise<{ rank: number; total_users: number } | null> {
    const result = await db.query<{ rank: string; total_users: string }>(
      `WITH ranked_users AS (
        SELECT
          user_id,
          ROW_NUMBER() OVER (ORDER BY total_points DESC, scored_bets DESC, total_bets DESC, user_id ASC) as rank
        FROM leaderboard_view
      )
      SELECT
        ru.rank,
        (SELECT COUNT(*) FROM users) as total_users
      FROM ranked_users ru
      WHERE ru.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) return null;

    return {
      rank: parseInt(result.rows[0].rank, 10),
      total_users: parseInt(result.rows[0].total_users, 10),
    };
  }
}

export const leaderboardRepository = new LeaderboardRepository();
