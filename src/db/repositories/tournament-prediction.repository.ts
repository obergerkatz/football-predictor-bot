import { db } from '../database';
import { TournamentPrediction } from '../../types';

export class TournamentPredictionRepository {
  async findByUserId(userId: number, leagueId: number): Promise<TournamentPrediction | null> {
    const result = await db.query<TournamentPrediction>(
      'SELECT * FROM tournament_predictions WHERE user_id = $1 AND league_id = $2',
      [userId, leagueId]
    );
    return result.rows[0] || null;
  }

  async create(
    userId: number,
    leagueId: number,
    firstPlace: string,
    secondPlace: string
  ): Promise<TournamentPrediction> {
    const result = await db.query<TournamentPrediction>(
      `INSERT INTO tournament_predictions (user_id, league_id, first_place, second_place)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, leagueId, firstPlace, secondPlace]
    );
    return result.rows[0];
  }

  async update(
    userId: number,
    leagueId: number,
    firstPlace: string,
    secondPlace: string
  ): Promise<TournamentPrediction> {
    const result = await db.query<TournamentPrediction>(
      `UPDATE tournament_predictions
       SET first_place = $3, second_place = $4
       WHERE user_id = $1 AND league_id = $2
       RETURNING *`,
      [userId, leagueId, firstPlace, secondPlace]
    );
    return result.rows[0];
  }

  async updateBonusPoints(userId: number, leagueId: number, bonusPoints: number): Promise<void> {
    await db.query(
      `UPDATE tournament_predictions
       SET bonus_points = $3, is_scored = TRUE
       WHERE user_id = $1 AND league_id = $2`,
      [userId, leagueId, bonusPoints]
    );
  }

  async getAll(): Promise<TournamentPrediction[]> {
    const result = await db.query<TournamentPrediction>(
      'SELECT * FROM tournament_predictions ORDER BY created_at ASC'
    );
    return result.rows;
  }

  async getAllByLeague(leagueId: number): Promise<TournamentPrediction[]> {
    const result = await db.query<TournamentPrediction>(
      'SELECT * FROM tournament_predictions WHERE league_id = $1 ORDER BY created_at ASC',
      [leagueId]
    );
    return result.rows;
  }
}

export const tournamentPredictionRepository = new TournamentPredictionRepository();
