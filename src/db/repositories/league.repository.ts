import { db } from '../database';
import { League } from '../../types';
import { config } from '../../utils/config';
import { DB_FIELDS } from '../../constants';

export class LeagueRepository {
  async upsert(
    apiLeagueId: number,
    name: string,
    country: string,
    season: number,
    code?: string,
    logoUrl?: string
  ): Promise<League> {
    const result = await db.query<League>(
      `INSERT INTO leagues (${DB_FIELDS.API_LEAGUE_ID}, name, country, season, code, logo_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (${DB_FIELDS.API_LEAGUE_ID}, season) DO UPDATE
       SET name = EXCLUDED.name,
           country = EXCLUDED.country,
           code = EXCLUDED.code,
           logo_url = EXCLUDED.logo_url
       RETURNING *`,
      [apiLeagueId, name, country, season, code || null, logoUrl || null]
    );
    return result.rows[0];
  }

  async findActive(): Promise<League[]> {
    const result = await db.query<League>(
      'SELECT * FROM leagues WHERE is_active = true ORDER BY name ASC'
    );
    return result.rows;
  }

  async findActiveByConfiguredLeagues(): Promise<League[]> {
    const leagueCodes = config.leagues.defaultLeagueIds;
    const result = await db.query<League>(
      `SELECT * FROM leagues
       WHERE is_active = true
       AND code = ANY($1::text[])
       ORDER BY name ASC`,
      [leagueCodes]
    );
    return result.rows;
  }
}

export const leagueRepository = new LeagueRepository();
