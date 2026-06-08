import {
  tournamentPredictionRepository,
  matchRepository,
  leagueRepository,
} from '../db/repositories';
import { TournamentPrediction } from '../types';
import { logger } from '../utils/logger';

export class TournamentPredictionService {
  private async getActiveLeagueId(): Promise<number | null> {
    const activeLeagues = await leagueRepository.findActiveByConfiguredLeagues();
    if (activeLeagues.length === 0) {
      logger.warn('No active leagues found matching DEFAULT_LEAGUE_IDS');
      return null;
    }
    return activeLeagues[0].id;
  }
  async getAvailableTeams(): Promise<string[]> {
    try {
      const teams = await matchRepository.getAllTeams();
      logger.debug('Fetched teams from database', { count: teams.length });
      return teams;
    } catch (error) {
      logger.error('Failed to get available teams from database', { error });
      return [];
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
          reason: 'Tournament predictions closed - first match has started',
        };
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Error checking if prediction is allowed', { error });
      return { allowed: false, reason: 'Error checking tournament status' };
    }
  }

  async getUserPrediction(userId: number): Promise<TournamentPrediction | null> {
    const leagueId = await this.getActiveLeagueId();
    if (!leagueId) return null;
    return tournamentPredictionRepository.findByUserId(userId, leagueId);
  }

  async placePrediction(
    userId: number,
    firstPlace: string,
    secondPlace: string
  ): Promise<{ success: boolean; prediction?: TournamentPrediction; error?: string }> {
    try {
      // Validate can still place prediction
      const canPlace = await this.canPlacePrediction();
      if (!canPlace.allowed) {
        return { success: false, error: canPlace.reason };
      }

      // Validate all teams are different
      const teams = [firstPlace, secondPlace];
      const uniqueTeams = new Set(teams);
      if (uniqueTeams.size !== 2) {
        return { success: false, error: 'Each position must have a different team' };
      }

      // Validate all teams are valid
      const availableTeams = await this.getAvailableTeams();
      if (availableTeams.length === 0) {
        return { success: false, error: 'No teams available for prediction' };
      }

      for (const team of teams) {
        if (!availableTeams.includes(team)) {
          return { success: false, error: `Invalid team: ${team}` };
        }
      }

      // Get active league
      const leagueId = await this.getActiveLeagueId();
      if (!leagueId) {
        return { success: false, error: 'No active league found' };
      }

      // Check if user already has a prediction
      const existing = await tournamentPredictionRepository.findByUserId(userId, leagueId);

      let prediction: TournamentPrediction;
      if (existing) {
        prediction = await tournamentPredictionRepository.update(
          userId,
          leagueId,
          firstPlace,
          secondPlace
        );
        logger.info('Tournament prediction updated', { userId, leagueId });
      } else {
        prediction = await tournamentPredictionRepository.create(
          userId,
          leagueId,
          firstPlace,
          secondPlace
        );
        logger.info('Tournament prediction created', { userId, leagueId });
      }

      return { success: true, prediction };
    } catch (error) {
      logger.error('Failed to place tournament prediction', { error, userId });
      return { success: false, error: 'Failed to save prediction. Please try again.' };
    }
  }

  async scorePredictions(
    leagueId: number,
    actualFirstPlace: string,
    actualSecondPlace: string
  ): Promise<void> {
    try {
      const predictions = await tournamentPredictionRepository.getAllByLeague(leagueId);

      for (const prediction of predictions) {
        if (prediction.is_scored) continue;

        let bonusPoints = 0;

        if (prediction.first_place === actualFirstPlace) bonusPoints += 7;
        if (prediction.second_place === actualSecondPlace) bonusPoints += 7;

        await tournamentPredictionRepository.updateBonusPoints(
          prediction.user_id,
          leagueId,
          bonusPoints
        );

        logger.info('Tournament prediction scored', {
          userId: prediction.user_id,
          leagueId,
          bonusPoints,
        });
      }
    } catch (error) {
      logger.error('Failed to score tournament predictions', { error, leagueId });
      throw error;
    }
  }
}

export const tournamentPredictionService = new TournamentPredictionService();
