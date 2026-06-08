import {
  topGoalscorerPredictionRepository,
  matchRepository,
  leagueRepository,
} from '../db/repositories';
import { TopGoalscorerPrediction } from '../db/repositories/top-goalscorer-prediction.repository';
import { footballDataClient } from '../api/football-data.client';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

export class TopGoalscorerPredictionService {
  private async getActiveLeagueId(): Promise<number | null> {
    const activeLeagues = await leagueRepository.findActiveByConfiguredLeagues();
    if (activeLeagues.length === 0) {
      logger.warn('No active leagues found matching DEFAULT_LEAGUE_IDS');
      return null;
    }
    return activeLeagues[0].id;
  }

  private getCompetitionCode(): string {
    return config.leagues.defaultLeagueIds[0] || 'CL';
  }

  async getAvailablePlayers(): Promise<string[]> {
    try {
      const competitionCode = this.getCompetitionCode();
      return await footballDataClient.getPlayers(competitionCode);
    } catch (error) {
      logger.error('Failed to get available players', { error });
      return [];
    }
  }

  /**
   * Fuzzy match a player name against the available players list.
   * Returns the matched player name or null.
   */
  async findPlayer(input: string): Promise<string | null> {
    const players = await this.getAvailablePlayers();
    const normalised = input.trim().toLowerCase();

    // Exact match (case-insensitive)
    const exact = players.find((p) => p.toLowerCase() === normalised);
    if (exact) return exact;

    // Partial match — input is contained in player name or vice versa
    const partial = players.filter(
      (p) => p.toLowerCase().includes(normalised) || normalised.includes(p.toLowerCase())
    );
    if (partial.length === 1) return partial[0];

    return null;
  }

  /**
   * Returns up to 5 suggestions for a given input (for "not found" messages).
   */
  async getSuggestions(input: string): Promise<string[]> {
    const players = await this.getAvailablePlayers();
    const normalised = input.trim().toLowerCase();
    return players
      .filter(
        (p) =>
          p.toLowerCase().includes(normalised) ||
          normalised.includes(p.toLowerCase().split(' ')[1] || '')
      )
      .slice(0, 5);
  }

  async canPlacePrediction(): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const leagueId = await this.getActiveLeagueId();
      if (!leagueId) {
        return { allowed: false, reason: 'No active league found' };
      }

      const firstMatch = await matchRepository.getFirstMatchByLeague(leagueId);
      if (!firstMatch) {
        return { allowed: true };
      }

      const now = new Date();
      const matchDate = new Date(firstMatch.match_date);

      if (now >= matchDate) {
        return {
          allowed: false,
          reason: 'Top goalscorer predictions closed - first match has started',
        };
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Error checking if prediction is allowed', { error });
      return { allowed: false, reason: 'Error checking tournament status' };
    }
  }

  async getUserPrediction(userId: number): Promise<TopGoalscorerPrediction | null> {
    const leagueId = await this.getActiveLeagueId();
    if (!leagueId) return null;
    return topGoalscorerPredictionRepository.findByUserId(userId, leagueId);
  }

  async placePrediction(
    userId: number,
    playerName: string
  ): Promise<{ success: boolean; prediction?: TopGoalscorerPrediction; error?: string }> {
    try {
      const canPlace = await this.canPlacePrediction();
      if (!canPlace.allowed) {
        return { success: false, error: canPlace.reason };
      }

      const leagueId = await this.getActiveLeagueId();
      if (!leagueId) {
        return { success: false, error: 'No active league found' };
      }

      const existing = await topGoalscorerPredictionRepository.findByUserId(userId, leagueId);

      let prediction: TopGoalscorerPrediction;
      if (existing) {
        prediction = await topGoalscorerPredictionRepository.update(userId, leagueId, playerName);
        logger.info('Top goalscorer prediction updated', { userId, leagueId, playerName });
      } else {
        prediction = await topGoalscorerPredictionRepository.create(userId, leagueId, playerName);
        logger.info('Top goalscorer prediction created', { userId, leagueId, playerName });
      }

      return { success: true, prediction };
    } catch (error) {
      logger.error('Failed to place top goalscorer prediction', { error, userId });
      return { success: false, error: 'Failed to save prediction. Please try again.' };
    }
  }

  async scorePredictions(leagueId: number, actualTopScorer: string): Promise<void> {
    try {
      const predictions = await topGoalscorerPredictionRepository.getAllByLeague(leagueId);

      for (const prediction of predictions) {
        if (prediction.is_scored) continue;

        const isCorrect =
          prediction.predicted_player.toLowerCase() === actualTopScorer.toLowerCase();
        const bonusPoints = isCorrect ? 7 : 0;

        await topGoalscorerPredictionRepository.updateBonusPoints(
          prediction.user_id,
          leagueId,
          bonusPoints
        );

        logger.info('Top goalscorer prediction scored', {
          userId: prediction.user_id,
          leagueId,
          bonusPoints,
          isCorrect,
        });
      }
    } catch (error) {
      logger.error('Failed to score top goalscorer predictions', { error, leagueId });
      throw error;
    }
  }
}

export const topGoalscorerPredictionService = new TopGoalscorerPredictionService();
