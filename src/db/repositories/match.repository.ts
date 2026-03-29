import { db } from '../database';
import { Match, MatchStatus, MatchWithLeague } from '../../types';
import { config } from '../../utils/config';
import { DB_FIELDS } from '../../constants';

interface MatchWithLeagueRow extends Match {
  league_id: number;
  api_league_id: number;
  league_code: string | null;
  league_name: string;
  league_country: string;
  league_season: number;
  league_is_active: boolean;
  league_logo_url: string | null;
}

export class MatchRepository {
  async findById(id: number): Promise<Match | null> {
    const result = await db.query<Match>('SELECT * FROM matches WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findByIdWithLeague(id: number): Promise<MatchWithLeague | null> {
    const result = await db.query<MatchWithLeagueRow>(
      `SELECT m.*,
              l.id as league_id, l.${DB_FIELDS.API_LEAGUE_ID}, l.code as league_code, l.name as league_name,
              l.country as league_country, l.season as league_season,
              l.is_active as league_is_active, l.logo_url as league_logo_url
       FROM matches m
       JOIN leagues l ON m.${DB_FIELDS.LEAGUE_ID} = l.id
       WHERE m.id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return this.mapRowWithLeague(row);
  }

  async upsert(
    apiFixtureId: number,
    leagueId: number,
    homeTeam: string,
    awayTeam: string,
    matchDate: Date,
    status: MatchStatus,
    homeScore?: number | null,
    awayScore?: number | null,
    homeScoreFt?: number | null,
    awayScoreFt?: number | null
  ): Promise<Match> {
    const result = await db.query<Match>(
      `INSERT INTO matches (${DB_FIELDS.API_FIXTURE_ID}, ${DB_FIELDS.LEAGUE_ID}, home_team, away_team, match_date, status,
                            ${DB_FIELDS.HOME_SCORE}, ${DB_FIELDS.AWAY_SCORE}, home_score_ft, away_score_ft, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
       ON CONFLICT (${DB_FIELDS.API_FIXTURE_ID}) DO UPDATE
       SET ${DB_FIELDS.LEAGUE_ID} = EXCLUDED.${DB_FIELDS.LEAGUE_ID},
           home_team = EXCLUDED.home_team,
           away_team = EXCLUDED.away_team,
           match_date = EXCLUDED.match_date,
           status = EXCLUDED.status,
           home_score = EXCLUDED.home_score,
           away_score = EXCLUDED.away_score,
           home_score_ft = EXCLUDED.home_score_ft,
           away_score_ft = EXCLUDED.away_score_ft,
           updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        apiFixtureId,
        leagueId,
        homeTeam,
        awayTeam,
        matchDate,
        status,
        homeScore,
        awayScore,
        homeScoreFt,
        awayScoreFt,
      ]
    );
    return result.rows[0];
  }

  async findUpcoming(): Promise<MatchWithLeague[]> {
    const leagueCodes = config.leagues.defaultLeagueIds;
    const result = await db.query<MatchWithLeagueRow>(
      `SELECT m.*,
              l.id as league_id, l.api_league_id, l.code as league_code, l.name as league_name,
              l.country as league_country, l.season as league_season,
              l.is_active as league_is_active, l.logo_url as league_logo_url
       FROM matches m
       JOIN leagues l ON m.league_id = l.id
       WHERE m.status = $1 AND m.match_date > CURRENT_TIMESTAMP
         AND l.code = ANY($2::text[])
       ORDER BY m.match_date ASC`,
      [MatchStatus.SCHEDULED, leagueCodes]
    );

    return result.rows.map((row) => this.mapRowWithLeague(row));
  }

  async findToday(): Promise<MatchWithLeague[]> {
    const leagueCodes = config.leagues.defaultLeagueIds;
    const result = await db.query<MatchWithLeagueRow>(
      `SELECT m.*,
              l.id as league_id, l.api_league_id, l.code as league_code, l.name as league_name,
              l.country as league_country, l.season as league_season,
              l.is_active as league_is_active, l.logo_url as league_logo_url
       FROM matches m
       JOIN leagues l ON m.league_id = l.id
       WHERE DATE(m.match_date) = CURRENT_DATE
         AND l.code = ANY($1::text[])
       ORDER BY m.match_date ASC`,
      [leagueCodes]
    );

    return result.rows.map((row) => this.mapRowWithLeague(row));
  }

  async findByStatus(status: MatchStatus): Promise<Match[]> {
    const result = await db.query<Match>(
      'SELECT * FROM matches WHERE status = $1 ORDER BY match_date ASC',
      [status]
    );
    return result.rows;
  }

  async findRecentFinished(limit: number = 10): Promise<MatchWithLeague[]> {
    const leagueCodes = config.leagues.defaultLeagueIds;
    const result = await db.query<MatchWithLeagueRow>(
      `SELECT m.*,
              l.id as league_id, l.api_league_id, l.code as league_code, l.name as league_name,
              l.country as league_country, l.season as league_season,
              l.is_active as league_is_active, l.logo_url as league_logo_url
       FROM matches m
       JOIN leagues l ON m.league_id = l.id
       WHERE m.status = $1
         AND l.code = ANY($2::text[])
       ORDER BY m.match_date DESC
       LIMIT $3`,
      [MatchStatus.FINISHED, leagueCodes, limit]
    );

    return result.rows.map((row) => this.mapRowWithLeague(row));
  }

  async findLiveAndRecent(): Promise<Match[]> {
    const result = await db.query<Match>(
      `SELECT * FROM matches
       WHERE status IN ($1, $2)
          OR (status = $3 AND match_date > CURRENT_TIMESTAMP - INTERVAL '2 hours')
       ORDER BY match_date ASC`,
      [MatchStatus.LIVE, MatchStatus.SCHEDULED, MatchStatus.FINISHED]
    );
    return result.rows;
  }

  async findFinishedAndLive(): Promise<MatchWithLeague[]> {
    const leagueCodes = config.leagues.defaultLeagueIds;
    const result = await db.query<MatchWithLeagueRow>(
      `SELECT m.*,
              l.id as league_id, l.api_league_id, l.code as league_code, l.name as league_name,
              l.country as league_country, l.season as league_season,
              l.is_active as league_is_active, l.logo_url as league_logo_url
       FROM matches m
       JOIN leagues l ON m.league_id = l.id
       WHERE m.status IN ($1, $2)
         AND l.code = ANY($3::text[])
       ORDER BY
         CASE WHEN m.status = $1 THEN 0 ELSE 1 END,
         m.match_date ASC`,
      [MatchStatus.LIVE, MatchStatus.FINISHED, leagueCodes]
    );

    return result.rows.map((row) => this.mapRowWithLeague(row));
  }

  async getFirstMatch(): Promise<Match | null> {
    const result = await db.query<Match>('SELECT * FROM matches ORDER BY match_date ASC LIMIT 1');
    return result.rows[0] || null;
  }

  async getFirstMatchByLeague(leagueId: number): Promise<Match | null> {
    const result = await db.query<Match>(
      'SELECT * FROM matches WHERE league_id = $1 ORDER BY match_date ASC LIMIT 1',
      [leagueId]
    );
    return result.rows[0] || null;
  }

  async getAllTeams(): Promise<string[]> {
    const result = await db.query<{ team_name: string }>(
      `SELECT DISTINCT team_name FROM (
        SELECT home_team as team_name FROM matches
        UNION
        SELECT away_team as team_name FROM matches
      ) AS teams
      ORDER BY team_name ASC`
    );
    return result.rows.map((row) => row.team_name);
  }

  private mapRowWithLeague(row: MatchWithLeagueRow): MatchWithLeague {
    return {
      id: row.id,
      api_fixture_id: row.api_fixture_id,
      league_id: row.league_id,
      home_team: row.home_team,
      away_team: row.away_team,
      match_date: row.match_date,
      status: row.status,
      home_score: row.home_score,
      away_score: row.away_score,
      home_score_ft: row.home_score_ft,
      away_score_ft: row.away_score_ft,
      updated_at: row.updated_at,
      league: {
        id: row.league_id,
        api_league_id: row.api_league_id,
        code: row.league_code,
        name: row.league_name,
        country: row.league_country,
        season: row.league_season,
        is_active: row.league_is_active,
        logo_url: row.league_logo_url,
      },
    };
  }
}

export const matchRepository = new MatchRepository();
