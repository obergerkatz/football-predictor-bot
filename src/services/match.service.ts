import { matchRepository } from '../db/repositories';
import { Match, MatchWithLeague, MatchStatus } from '../types';
import { logger } from '../utils/logger';
import { cacheService } from './cache.service';
import { CACHE_TTL, SERVICE_ERROR_PREFIX } from '../constants';

export class MatchService {
  async getTodayMatches(): Promise<MatchWithLeague[]> {
    try {
      const cacheKey = 'matches:today';
      const cached = cacheService.get<MatchWithLeague[]>(cacheKey);

      if (cached) {
        logger.debug('Returning cached today matches');
        return cached;
      }

      const matches = await matchRepository.findToday();
      logger.debug(`Retrieved ${matches.length} today matches`);

      cacheService.set(cacheKey, matches, CACHE_TTL.TODAY_MATCHES);
      return matches;
    } catch (error) {
      logger.error(SERVICE_ERROR_PREFIX.FAILED_TO_GET_TODAY_MATCHES, { error });
      throw error;
    }
  }

  async getUpcomingMatches(): Promise<MatchWithLeague[]> {
    try {
      const cacheKey = 'matches:upcoming';
      const cached = cacheService.get<MatchWithLeague[]>(cacheKey);

      if (cached) {
        logger.debug('Returning cached upcoming matches');
        return cached;
      }

      const matches = await matchRepository.findUpcoming();
      logger.debug(`Retrieved ${matches.length} upcoming matches`);

      cacheService.set(cacheKey, matches, CACHE_TTL.UPCOMING_MATCHES);
      return matches;
    } catch (error) {
      logger.error(SERVICE_ERROR_PREFIX.FAILED_TO_GET_UPCOMING_MATCHES, { error });
      throw error;
    }
  }

  async getRecentFinishedMatches(limit: number = 10): Promise<MatchWithLeague[]> {
    try {
      const cacheKey = `matches:finished:${limit}`;
      const cached = cacheService.get<MatchWithLeague[]>(cacheKey);

      if (cached) {
        logger.debug('Returning cached finished matches');
        return cached;
      }

      const matches = await matchRepository.findRecentFinished(limit);
      logger.debug(`Retrieved ${matches.length} recent finished matches`);

      cacheService.set(cacheKey, matches, CACHE_TTL.FINISHED_MATCHES);
      return matches;
    } catch (error) {
      logger.error(SERVICE_ERROR_PREFIX.FAILED_TO_GET_RECENT_FINISHED_MATCHES, { error });
      throw error;
    }
  }

  async getMatchById(matchId: number): Promise<Match | null> {
    const cacheKey = `match:${matchId}`;
    const cached = cacheService.get<Match>(cacheKey);

    if (cached) {
      logger.debug('Returning cached match', { matchId });
      return cached;
    }

    const match = await matchRepository.findById(matchId);
    if (match) {
      // Use shorter TTL for live matches
      const ttl =
        match.status === MatchStatus.LIVE ? CACHE_TTL.LIVE_MATCHES : CACHE_TTL.MATCH_BY_ID;
      cacheService.set(cacheKey, match, ttl);
    }
    return match;
  }

  async getMatchWithLeagueById(matchId: number): Promise<MatchWithLeague | null> {
    const cacheKey = `match:league:${matchId}`;
    const cached = cacheService.get<MatchWithLeague>(cacheKey);

    if (cached) {
      logger.debug('Returning cached match with league', { matchId });
      return cached;
    }

    const match = await matchRepository.findByIdWithLeague(matchId);
    if (match) {
      // Use shorter TTL for live matches
      const ttl =
        match.status === MatchStatus.LIVE ? CACHE_TTL.LIVE_MATCHES : CACHE_TTL.MATCH_BY_ID;
      cacheService.set(cacheKey, match, ttl);
    }
    return match;
  }

  async canPlaceBet(matchId: number): Promise<{ allowed: boolean; reason?: string }> {
    const match = await this.getMatchById(matchId);

    if (!match) {
      return { allowed: false, reason: 'Match not found' };
    }

    if (match.status !== MatchStatus.SCHEDULED) {
      return { allowed: false, reason: 'Match has already started or finished' };
    }

    const now = new Date();
    if (match.match_date <= now) {
      return { allowed: false, reason: 'Match has already started' };
    }

    return { allowed: true };
  }

  async isMatchFinished(matchId: number): Promise<boolean> {
    const match = await this.getMatchById(matchId);
    return match?.status === MatchStatus.FINISHED;
  }

  async getFinishedAndLiveMatches(): Promise<MatchWithLeague[]> {
    try {
      const cacheKey = `matches:finished-live:all`;
      const cached = cacheService.get<MatchWithLeague[]>(cacheKey);

      if (cached) {
        logger.debug('Returning cached finished and live matches');
        return cached;
      }

      const matches = await matchRepository.findFinishedAndLive();
      logger.debug(`Retrieved ${matches.length} finished and live matches`);

      // Use shorter TTL if there are live matches
      const hasLiveMatches = matches.some((m) => m.status === MatchStatus.LIVE);
      const ttl = hasLiveMatches ? CACHE_TTL.LIVE_MATCHES : CACHE_TTL.FINISHED_MATCHES;

      cacheService.set(cacheKey, matches, ttl);
      return matches;
    } catch (error) {
      logger.error('Failed to get finished and live matches', { error });
      throw error;
    }
  }

  async getMatchesForScoring(): Promise<Match[]> {
    try {
      // Get all finished matches that might have unscored bets
      const finishedMatches = await matchRepository.findByStatus(MatchStatus.FINISHED);
      logger.debug(`Found ${finishedMatches.length} finished matches for potential scoring`);
      return finishedMatches;
    } catch (error) {
      logger.error('Failed to get matches for scoring', { error });
      throw error;
    }
  }

  /**
   * Clear cache for a specific match (call after update)
   */
  clearMatchCache(matchId: number): void {
    cacheService.delete(`match:${matchId}`);
    cacheService.delete(`match:league:${matchId}`);
    logger.debug('Cleared match cache', { matchId });
  }

  /**
   * Clear all match list caches (call after sync or bulk updates)
   */
  clearMatchListCaches(): void {
    cacheService.delete('matches:today');
    cacheService.delete('matches:upcoming');
    // Clear common finished match cache keys
    for (let i = 5; i <= 50; i += 5) {
      cacheService.delete(`matches:finished:${i}`);
      cacheService.delete(`matches:finished-live:${i}`);
    }
    logger.debug('Cleared match list caches');
  }
}

export const matchService = new MatchService();
