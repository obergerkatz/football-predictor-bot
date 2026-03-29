import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { MatchStatus } from '../types';
import { cacheService } from '../services/cache.service';
import { API_TIMEOUT } from '../constants';

const CACHE_TTL = {
  MATCHES: 60 * 60, // 1 hour
  COMPETITION: 24 * 60 * 60, // 24 hours
  MATCH_BY_ID: 5 * 60, // 5 minutes
  STANDINGS: 60 * 60, // 1 hour
  TEAMS: 24 * 60 * 60, // 24 hours
};

// Football-Data.org API response types
export interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  stage: string;
  competition: {
    id: number;
    name: string;
    code: string;
    emblem: string;
  };
  season: {
    id: number;
    startDate: string;
    endDate: string;
    currentMatchday: number;
  };
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  score: {
    winner: string | null;
    duration: string;
    fullTime: {
      home: number | null;
      away: number | null;
    };
    halfTime: {
      home: number | null;
      away: number | null;
    };
    regularTime?: {
      home: number | null;
      away: number | null;
    };
    extraTime?: {
      home: number | null;
      away: number | null;
    };
    penalties?: {
      home: number | null;
      away: number | null;
    };
  };
}

export interface FootballDataCompetition {
  id: number;
  name: string;
  code: string;
  emblem: string;
  area: {
    id: number;
    name: string;
    code: string;
  };
  currentSeason: {
    id: number;
    startDate: string;
    endDate: string;
    currentMatchday: number;
  };
}

export class FootballDataClient {
  private client: AxiosInstance;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 6000; // 6 seconds (free tier: 10 calls/minute)

  constructor() {
    this.client = axios.create({
      baseURL: config.apiFootball.baseUrl,
      headers: {
        'X-Auth-Token': config.apiFootball.apiKey,
      },
      timeout: API_TIMEOUT,
    });

    // Request interceptor for rate limiting
    this.client.interceptors.request.use(async (config) => {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      if (timeSinceLastRequest < this.minRequestInterval) {
        const waitTime = this.minRequestInterval - timeSinceLastRequest;
        logger.debug(`Rate limiting: waiting ${waitTime}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      this.lastRequestTime = Date.now();
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        logger.error('Football-Data API request failed', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
          data: error.response?.data,
        });
        throw error;
      }
    );
  }

  /**
   * Get matches for a competition
   */
  async getMatches(
    competitionCode: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<FootballDataMatch[]> {
    try {
      const cacheKey = `fd:matches:${competitionCode}:${dateFrom || 'all'}:${dateTo || 'all'}`;
      const cached = cacheService.get<FootballDataMatch[]>(cacheKey);

      if (cached) {
        logger.debug('Returning cached matches', { competitionCode });
        return cached;
      }

      logger.info('Fetching matches from Football-Data.org', {
        competitionCode,
        dateFrom,
        dateTo,
      });

      const params: Record<string, string> = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const response = await this.client.get<{ matches: FootballDataMatch[] }>(
        `/competitions/${competitionCode}/matches`,
        { params }
      );

      logger.info(`Fetched ${response.data.matches.length} matches`, { competitionCode });
      cacheService.set(cacheKey, response.data.matches, CACHE_TTL.MATCHES);
      return response.data.matches;
    } catch (error) {
      logger.error('Failed to fetch matches', { error, competitionCode });
      return [];
    }
  }

  /**
   * Get competition info
   */
  async getCompetition(competitionCode: string): Promise<FootballDataCompetition | null> {
    try {
      const cacheKey = `fd:competition:${competitionCode}`;
      const cached = cacheService.get<FootballDataCompetition>(cacheKey);

      if (cached) {
        logger.debug('Returning cached competition', { competitionCode });
        return cached;
      }

      logger.debug('Fetching competition info', { competitionCode });

      const response = await this.client.get<FootballDataCompetition>(
        `/competitions/${competitionCode}`
      );

      cacheService.set(cacheKey, response.data, CACHE_TTL.COMPETITION);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch competition', { error, competitionCode });
      return null;
    }
  }

  /**
   * Get match by ID
   */
  async getMatchById(matchId: number): Promise<FootballDataMatch | null> {
    try {
      const cacheKey = `fd:match:${matchId}`;
      const cached = cacheService.get<FootballDataMatch>(cacheKey);

      if (cached) {
        logger.debug('Returning cached match', { matchId });
        return cached;
      }

      logger.debug('Fetching match by ID', { matchId });

      const response = await this.client.get<FootballDataMatch>(`/matches/${matchId}`);

      cacheService.set(cacheKey, response.data, CACHE_TTL.MATCH_BY_ID);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch match by ID', { error, matchId });
      return null;
    }
  }

  /**
   * Map Football-Data status to our MatchStatus enum
   */
  mapStatusToMatchStatus(status: string): MatchStatus {
    const statusMap: Record<string, MatchStatus> = {
      SCHEDULED: MatchStatus.SCHEDULED,
      TIMED: MatchStatus.SCHEDULED,
      IN_PLAY: MatchStatus.LIVE,
      PAUSED: MatchStatus.LIVE,
      FINISHED: MatchStatus.FINISHED,
      AWARDED: MatchStatus.FINISHED,
      POSTPONED: MatchStatus.POSTPONED,
      CANCELLED: MatchStatus.CANCELLED,
      SUSPENDED: MatchStatus.CANCELLED,
    };

    return statusMap[status] || MatchStatus.SCHEDULED;
  }

  /**
   * Get 90-minute score (regular time only)
   */
  get90MinuteScore(match: FootballDataMatch): { home: number | null; away: number | null } {
    // If extraTime exists, use regularTime (90 minutes)
    if (match.score.regularTime) {
      return {
        home: match.score.regularTime.home,
        away: match.score.regularTime.away,
      };
    }

    // Otherwise, fullTime is the 90-minute result (if no extra time was played)
    if (match.score.duration === 'REGULAR') {
      return {
        home: match.score.fullTime.home,
        away: match.score.fullTime.away,
      };
    }

    // For matches with extra time, if regularTime not available, use fullTime
    return {
      home: match.score.fullTime.home,
      away: match.score.fullTime.away,
    };
  }

  /**
   * Get full-time score including extra time
   */
  getFullTimeScore(match: FootballDataMatch): { home: number | null; away: number | null } {
    // If extra time was played, use extraTime scores
    if (match.score.extraTime && match.score.extraTime.home !== null) {
      return {
        home: match.score.extraTime.home,
        away: match.score.extraTime.away,
      };
    }

    // Otherwise use fullTime
    return {
      home: match.score.fullTime.home,
      away: match.score.fullTime.away,
    };
  }

  /**
   * Get standings for a competition
   */
  async getStandings(competitionCode: string): Promise<unknown> {
    try {
      const cacheKey = `fd:standings:${competitionCode}`;
      const cached = cacheService.get<unknown>(cacheKey);

      if (cached) {
        logger.debug('Returning cached standings', { competitionCode });
        return cached;
      }

      logger.debug('Fetching standings', { competitionCode });

      const response = await this.client.get(`/competitions/${competitionCode}/standings`);

      cacheService.set(cacheKey, response.data, CACHE_TTL.STANDINGS);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch standings', { error, competitionCode });
      throw error;
    }
  }

  /**
   * Get teams for a competition
   */
  async getTeams(competitionCode: string): Promise<unknown[]> {
    try {
      const cacheKey = `fd:teams:${competitionCode}`;
      const cached = cacheService.get<unknown[]>(cacheKey);

      if (cached) {
        logger.debug('Returning cached teams', { competitionCode });
        return cached;
      }

      logger.debug('Fetching teams', { competitionCode });

      const response = await this.client.get(`/competitions/${competitionCode}/teams`);

      if (!response.data || !response.data.teams) {
        logger.warn('Teams not found', { competitionCode });
        return [];
      }

      cacheService.set(cacheKey, response.data.teams, CACHE_TTL.TEAMS);
      return response.data.teams;
    } catch (error) {
      logger.error('Failed to fetch teams', { error, competitionCode });
      throw error;
    }
  }
}

export const footballDataClient = new FootballDataClient();
