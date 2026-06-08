import { db } from '../database';

export interface TopGoalscorerPrediction {
  id: number;
  user_id: number;
  league_id: number;
  predicted_player: string;
  bonus_points: number;
  is_scored: boolean;
  created_at: Date;
}

export class TopGoalscorerPredictionRepository {
  async findByUserId(userId: number, leagueId: number): Promise<TopGoalscorerPrediction | null> {
    const result = await db.query<TopGoalscorerPrediction>(
      'SELECT * FROM top_goalscorer_predictions WHERE user_id = $1 AND league_id = $2',
      [userId, leagueId]
    );
    return result.rows[0] || null;
  }

  async create(
    userId: number,
    leagueId: number,
    predictedPlayer: string
  ): Promise<TopGoalscorerPrediction> {
    const result = await db.query<TopGoalscorerPrediction>(
      `INSERT INTO top_goalscorer_predictions (user_id, league_id, predicted_player)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, leagueId, predictedPlayer]
    );
    return result.rows[0];
  }

  async update(
    userId: number,
    leagueId: number,
    predictedPlayer: string
  ): Promise<TopGoalscorerPrediction> {
    const result = await db.query<TopGoalscorerPrediction>(
      `UPDATE top_goalscorer_predictions
       SET predicted_player = $3
       WHERE user_id = $1 AND league_id = $2
       RETURNING *`,
      [userId, leagueId, predictedPlayer]
    );
    return result.rows[0];
  }

  async updateBonusPoints(userId: number, leagueId: number, bonusPoints: number): Promise<void> {
    await db.query(
      `UPDATE top_goalscorer_predictions
       SET bonus_points = $3, is_scored = TRUE
       WHERE user_id = $1 AND league_id = $2`,
      [userId, leagueId, bonusPoints]
    );
  }

  async getAllByLeague(leagueId: number): Promise<TopGoalscorerPrediction[]> {
    const result = await db.query<TopGoalscorerPrediction>(
      'SELECT * FROM top_goalscorer_predictions WHERE league_id = $1 ORDER BY created_at ASC',
      [leagueId]
    );
    return result.rows;
  }
}

export const topGoalscorerPredictionRepository = new TopGoalscorerPredictionRepository();
