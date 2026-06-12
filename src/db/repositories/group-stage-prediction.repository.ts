import { db } from '../database';
import { GroupStagePrediction } from '../../types';

export class GroupStagePredictionRepository {
  async create(
    userId: number,
    leagueId: number,
    predictions: Record<string, string[]>
  ): Promise<GroupStagePrediction> {
    const result = await db.query<GroupStagePrediction>(
      `INSERT INTO group_stage_predictions (user_id, league_id, predictions)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, league_id)
       DO UPDATE SET
         predictions = $3,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, leagueId, JSON.stringify(predictions)]
    );

    // Parse the JSON predictions field
    const row = result.rows[0];
    if (typeof row.predictions === 'string') {
      row.predictions = JSON.parse(row.predictions);
    }

    return row;
  }

  async findByUserId(userId: number, leagueId: number): Promise<GroupStagePrediction | null> {
    const result = await db.query<GroupStagePrediction>(
      'SELECT * FROM group_stage_predictions WHERE user_id = $1 AND league_id = $2',
      [userId, leagueId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    // Parse the JSON predictions field if it's a string
    if (typeof row.predictions === 'string') {
      row.predictions = JSON.parse(row.predictions);
    }

    return row as GroupStagePrediction;
  }

  async getAll(): Promise<GroupStagePrediction[]> {
    const result = await db.query<GroupStagePrediction>(
      'SELECT * FROM group_stage_predictions ORDER BY created_at ASC'
    );
    return result.rows.map((row) => {
      if (typeof row.predictions === 'string') {
        row.predictions = JSON.parse(row.predictions);
      }
      return row;
    });
  }

  async updateBonusPoints(userId: number, leagueId: number, bonusPoints: number): Promise<void> {
    await db.query(
      `UPDATE group_stage_predictions
       SET bonus_points = $1, is_scored = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND league_id = $3`,
      [bonusPoints, userId, leagueId]
    );
  }
}

export const groupStagePredictionRepository = new GroupStagePredictionRepository();
