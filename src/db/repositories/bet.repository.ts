import { db } from '../database';
import { Bet, BetWithMatch, MatchStatus, ScoreType } from '../../types';
import { DB_FIELDS } from '../../constants';

interface BetWithMatchRow extends Bet {
  // Match fields
  api_fixture_id: number;
  league_id: number;
  home_team: string;
  away_team: string;
  match_date: Date;
  match_status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  home_score_ft: number | null;
  away_score_ft: number | null;
  match_updated_at: Date;
  // Score fields (optional, from LEFT JOIN)
  score_id?: number;
  points_awarded?: number;
  score_type?: ScoreType;
  calculated_at?: Date;
}

export class BetRepository {
  async findByUserAndMatch(userId: number, matchId: number): Promise<Bet | null> {
    const result = await db.query<Bet>(
      `SELECT * FROM bets WHERE ${DB_FIELDS.USER_ID} = $1 AND ${DB_FIELDS.MATCH_ID} = $2`,
      [userId, matchId]
    );
    return result.rows[0] || null;
  }

  async findByUserAndMatchWithScore(userId: number, matchId: number): Promise<BetWithMatch | null> {
    const result = await db.query<BetWithMatchRow>(
      `SELECT b.*,
              m.${DB_FIELDS.API_FIXTURE_ID}, m.${DB_FIELDS.LEAGUE_ID}, m.home_team, m.away_team,
              m.match_date, m.status as match_status,
              m.${DB_FIELDS.HOME_SCORE}, m.${DB_FIELDS.AWAY_SCORE},
              m.home_score_ft, m.away_score_ft, m.updated_at as match_updated_at,
              s.id as score_id, s.points_awarded, s.score_type, s.calculated_at
       FROM bets b
       JOIN matches m ON b.${DB_FIELDS.MATCH_ID} = m.id
       LEFT JOIN scores s ON b.id = s.bet_id
       WHERE b.${DB_FIELDS.USER_ID} = $1 AND b.${DB_FIELDS.MATCH_ID} = $2`,
      [userId, matchId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowWithMatch(result.rows[0]);
  }

  async findByUser(userId: number): Promise<BetWithMatch[]> {
    const result = await db.query<BetWithMatchRow>(
      `SELECT b.*,
              m.${DB_FIELDS.API_FIXTURE_ID}, m.${DB_FIELDS.LEAGUE_ID}, m.home_team, m.away_team,
              m.match_date, m.status as match_status,
              m.${DB_FIELDS.HOME_SCORE}, m.${DB_FIELDS.AWAY_SCORE},
              m.home_score_ft, m.away_score_ft, m.updated_at as match_updated_at,
              s.id as score_id, s.points_awarded, s.score_type, s.calculated_at
       FROM bets b
       JOIN matches m ON b.${DB_FIELDS.MATCH_ID} = m.id
       LEFT JOIN scores s ON b.id = s.bet_id
       WHERE b.${DB_FIELDS.USER_ID} = $1
       ORDER BY m.match_date DESC`,
      [userId]
    );

    return result.rows.map((row) => this.mapRowWithMatch(row));
  }

  async findByMatch(matchId: number): Promise<Bet[]> {
    const result = await db.query<Bet>(`SELECT * FROM bets WHERE ${DB_FIELDS.MATCH_ID} = $1`, [
      matchId,
    ]);
    return result.rows;
  }

  async create(
    userId: number,
    matchId: number,
    predictedHomeScore: number,
    predictedAwayScore: number
  ): Promise<Bet> {
    const result = await db.query<Bet>(
      `INSERT INTO bets (${DB_FIELDS.USER_ID}, ${DB_FIELDS.MATCH_ID}, ${DB_FIELDS.PREDICTED_HOME_SCORE}, ${DB_FIELDS.PREDICTED_AWAY_SCORE})
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, matchId, predictedHomeScore, predictedAwayScore]
    );
    return result.rows[0];
  }

  async findUnscoredForMatch(matchId: number): Promise<Bet[]> {
    const result = await db.query<Bet>(
      `SELECT b.* FROM bets b
       LEFT JOIN scores s ON b.id = s.bet_id
       WHERE b.${DB_FIELDS.MATCH_ID} = $1 AND s.id IS NULL`,
      [matchId]
    );
    return result.rows;
  }

  async update(
    betId: number,
    predictedHomeScore: number,
    predictedAwayScore: number
  ): Promise<Bet> {
    const result = await db.query<Bet>(
      `UPDATE bets
       SET ${DB_FIELDS.PREDICTED_HOME_SCORE} = $2, ${DB_FIELDS.PREDICTED_AWAY_SCORE} = $3
       WHERE id = $1
       RETURNING *`,
      [betId, predictedHomeScore, predictedAwayScore]
    );
    return result.rows[0];
  }

  async getBetScore(betId: number): Promise<{ points_awarded: number } | null> {
    const result = await db.query<{ points_awarded: number }>(
      'SELECT points_awarded FROM scores WHERE bet_id = $1',
      [betId]
    );
    return result.rows[0] || null;
  }

  private mapRowWithMatch(row: BetWithMatchRow): BetWithMatch {
    const bet: BetWithMatch = {
      id: row.id,
      user_id: row.user_id,
      match_id: row.match_id,
      predicted_home_score: row.predicted_home_score,
      predicted_away_score: row.predicted_away_score,
      created_at: row.created_at,
      match: {
        id: row.match_id,
        api_fixture_id: row.api_fixture_id,
        league_id: row.league_id,
        home_team: row.home_team,
        away_team: row.away_team,
        match_date: row.match_date,
        status: row.match_status,
        home_score: row.home_score,
        away_score: row.away_score,
        home_score_ft: row.home_score_ft,
        away_score_ft: row.away_score_ft,
        updated_at: row.match_updated_at,
      },
    };

    if (row.score_id) {
      bet.score = {
        id: row.score_id,
        bet_id: row.id,
        points_awarded: row.points_awarded!,
        score_type: row.score_type!,
        calculated_at: row.calculated_at!,
      };
    }

    return bet;
  }
}

export const betRepository = new BetRepository();
