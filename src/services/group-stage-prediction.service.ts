import {
  groupStagePredictionRepository,
  matchRepository,
  leagueRepository,
} from '../db/repositories';
import { GroupStagePrediction } from '../types';
import { logger } from '../utils/logger';
import { apiFootballClient } from '../api/api-football.client';
import { cacheService } from './cache.service';

const CACHE_TTL = {
  GROUPS: 24 * 60 * 60, // 24 hours
};

export class GroupStagePredictionService {
  private async getActiveLeagueId(): Promise<number | null> {
    const activeLeagues = await leagueRepository.findActiveByConfiguredLeagues();
    if (activeLeagues.length === 0) {
      logger.warn('No active leagues found matching DEFAULT_LEAGUE_IDS');
      return null;
    }
    return activeLeagues[0].id;
  }

  async getGroups(): Promise<Record<string, string[]>> {
    try {
      const cacheKey = 'groups:data';
      const cached = cacheService.get<Record<string, string[]>>(cacheKey);

      if (cached) {
        logger.debug('Using cached groups data');
        return cached;
      }

      // Fetch from API
      const activeLeagues = await leagueRepository.findActiveByConfiguredLeagues();
      if (activeLeagues.length === 0) {
        logger.warn('No active leagues found matching DEFAULT_LEAGUE_IDS');
        return {};
      }

      const league = activeLeagues[0];
      const groups: Record<string, string[]> = {};

      // Try 1: Get from standings (football-data.org format)
      try {
        logger.debug('Attempting to fetch groups from standings');
        const standings = await apiFootballClient.getStandings(league.api_league_id, league.season);

        if (standings && standings.standings) {
          // Parse football-data.org standings format
          for (const standing of standings.standings) {
            // Extract group letter from "Group A", "Group B", etc.
            const groupMatch = standing.group?.match(/Group\s+([A-L])/i);
            if (groupMatch && standing.table) {
              const groupLetter = groupMatch[1].toUpperCase();
              groups[groupLetter] = standing.table
                .map((entry: unknown) => (entry as { team?: { name?: string } }).team?.name)
                .filter((name: string | undefined): name is string => Boolean(name)); // Filter out null/undefined names
            }
          }

          if (Object.keys(groups).length > 0) {
            logger.info('Fetched groups from standings', {
              groupCount: Object.keys(groups).length,
            });
            cacheService.set(cacheKey, groups, CACHE_TTL.GROUPS);
            return groups;
          }
        }
      } catch (error) {
        logger.warn('Failed to fetch from standings', { error });
      }

      // Try 2: Get from matches (extract groups from round names)
      try {
        logger.debug('Attempting to extract groups from matches');
        const fixtures = await apiFootballClient.getFixtures(league.api_league_id, league.season);

        if (fixtures && fixtures.length > 0) {
          const groupMatches: Record<string, Set<string>> = {};

          for (const fixture of fixtures) {
            // Check if the round contains "Group" (e.g., "Group A", "Group Stage - 1")
            const round = fixture.league.round || '';
            const groupMatch = round.match(/Group\s+([A-Z])/i);

            if (groupMatch) {
              const groupLetter = groupMatch[1].toUpperCase();
              if (!groupMatches[groupLetter]) {
                groupMatches[groupLetter] = new Set<string>();
              }

              groupMatches[groupLetter].add(fixture.teams.home.name);
              groupMatches[groupLetter].add(fixture.teams.away.name);
            }
          }

          // Convert sets to arrays
          for (const [group, teams] of Object.entries(groupMatches)) {
            groups[group] = Array.from(teams);
          }

          if (Object.keys(groups).length > 0) {
            logger.info('Extracted groups from matches', {
              groupCount: Object.keys(groups).length,
            });
            cacheService.set(cacheKey, groups, CACHE_TTL.GROUPS);
            return groups;
          }
        }
      } catch (error) {
        logger.warn('Failed to extract groups from matches', { error });
      }

      // Try 3: Get from teams endpoint
      try {
        logger.debug('Attempting to fetch groups from teams endpoint');
        const teams = await apiFootballClient.getTeams(league.api_league_id, league.season);

        if (teams && teams.length > 0) {
          // Some APIs might have group info in team data
          // For now, just log and continue
          logger.debug('Fetched teams', { count: teams.length });
        }
      } catch (error) {
        logger.warn('Failed to fetch teams', { error });
      }

      // If all methods failed, return empty groups
      if (Object.keys(groups).length === 0) {
        logger.warn('All API methods failed, no groups data available');
        return {};
      }

      cacheService.set(cacheKey, groups, CACHE_TTL.GROUPS);
      return groups;
    } catch (error) {
      logger.error('Failed to fetch groups from API', { error });

      // Try to return any cached data, even if expired
      const cacheKey = 'groups:data';
      const cached = cacheService.get<Record<string, string[]>>(cacheKey);
      if (cached) {
        logger.warn('Using cache data due to error');
        return cached;
      }

      return {};
    }
  }

  async canPlacePrediction(): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // Get active league
      const leagueId = await this.getActiveLeagueId();
      if (!leagueId) {
        return { allowed: false, reason: 'No active league found' };
      }

      // Check if any match in the active league has started
      const firstMatch = await matchRepository.getFirstMatchByLeague(leagueId);

      if (!firstMatch) {
        return { allowed: true };
      }

      const now = new Date();
      const matchDate = new Date(firstMatch.match_date);

      if (now >= matchDate) {
        return {
          allowed: false,
          reason: 'Group stage predictions closed - first match has started',
        };
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Error checking if group stage prediction can be placed', { error });
      return { allowed: false, reason: 'Error checking prediction availability' };
    }
  }

  async getUserPrediction(userId: number): Promise<GroupStagePrediction | null> {
    try {
      const leagueId = await this.getActiveLeagueId();
      if (!leagueId) return null;
      return await groupStagePredictionRepository.findByUserId(userId, leagueId);
    } catch (error) {
      logger.error('Error fetching user group stage prediction', { error, userId });
      throw error;
    }
  }

  async placePrediction(
    userId: number,
    predictions: Record<string, string[]>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if predictions are still allowed
      const canPlace = await this.canPlacePrediction();
      if (!canPlace.allowed) {
        return { success: false, error: canPlace.reason };
      }

      // Get active league
      const leagueId = await this.getActiveLeagueId();
      if (!leagueId) {
        return { success: false, error: 'No active league found' };
      }

      // Fetch groups for validation
      const availableGroups = await this.getGroups();

      // Validate all predictions
      for (const [groupLetter, teams] of Object.entries(predictions)) {
        if (!availableGroups[groupLetter]) {
          return { success: false, error: `Invalid group: ${groupLetter}` };
        }

        if (teams.length !== 2) {
          return { success: false, error: `Group ${groupLetter} must have exactly 2 teams` };
        }

        // Check if teams exist in the group
        for (const team of teams) {
          if (!availableGroups[groupLetter].includes(team)) {
            return { success: false, error: `Invalid team for Group ${groupLetter}: ${team}` };
          }
        }

        // Check for duplicates within group
        if (teams[0] === teams[1]) {
          return {
            success: false,
            error: `Cannot select same team twice for Group ${groupLetter}`,
          };
        }
      }

      await groupStagePredictionRepository.create(userId, leagueId, predictions);

      logger.info('Group stage prediction placed', {
        userId,
        leagueId,
        groupCount: Object.keys(predictions).length,
      });
      return { success: true };
    } catch (error) {
      logger.error('Error placing group stage prediction', { error, userId });
      return { success: false, error: 'Failed to save prediction' };
    }
  }

  async scorePrediction(
    userId: number,
    leagueId: number,
    actualQualifiers: Record<string, string[]>
  ): Promise<number> {
    try {
      const prediction = await groupStagePredictionRepository.findByUserId(userId, leagueId);
      if (!prediction || prediction.is_scored) {
        return 0;
      }

      let points = 0;

      // Iterate through all predicted groups
      for (const [group, predictedTeams] of Object.entries(prediction.predictions)) {
        const actualTeams = actualQualifiers[group];
        if (!actualTeams) continue;

        // 4 points for each correct qualifier (top 2 finishers only)
        const top2Teams = actualTeams.slice(0, 2);
        for (const predictedTeam of predictedTeams) {
          if (top2Teams.includes(predictedTeam)) {
            points += 4;
          }
        }
      }

      await groupStagePredictionRepository.updateBonusPoints(userId, leagueId, points);

      logger.info('Group stage prediction scored', { userId, leagueId, points });
      return points;
    } catch (error) {
      logger.error('Error scoring group stage prediction', { error, userId, leagueId });
      throw error;
    }
  }
}

export const groupStagePredictionService = new GroupStagePredictionService();
