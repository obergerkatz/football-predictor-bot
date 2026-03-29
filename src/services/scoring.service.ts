import { scoreRepository, betRepository } from '../db/repositories';
import { ScorePrediction, ScoringResult, ScoreType, Match, Bet } from '../types';
import { logger } from '../utils/logger';
import { SCORING_POINTS, SERVICE_ERROR_PREFIX } from '../constants';

export class ScoringService {
  /**
   * Calculates points for a bet based on predicted vs actual scores
   *
   * Scoring rules:
   * - Exact score: 6 points
   * - Correct goal difference: 4 points
   * - Correct one side + correct result: 3 points
   * - Correct one side only (wrong result): 1 point
   * - Maximum points per match: 6
   */
  calculateScore(predicted: ScorePrediction, actual: ScorePrediction): ScoringResult {
    // Exact score match
    if (predicted.home === actual.home && predicted.away === actual.away) {
      return {
        points: SCORING_POINTS.EXACT_MATCH,
        type: ScoreType.EXACT,
        details: 'Exact score match',
      };
    }

    // Goal difference match
    const predictedDiff = predicted.home - predicted.away;
    const actualDiff = actual.home - actual.away;

    if (predictedDiff === actualDiff) {
      return {
        points: SCORING_POINTS.GOAL_DIFFERENCE,
        type: ScoreType.GOAL_DIFF,
        details: 'Correct goal difference',
      };
    }

    // Helper function to determine match result (win/draw/loss)
    const getMatchResult = (home: number, away: number): number => {
      if (home > away) return 1; // Home win
      if (home < away) return -1; // Away win
      return 0; // Draw
    };

    const predictedResult = getMatchResult(predicted.home, predicted.away);
    const actualResult = getMatchResult(actual.home, actual.away);
    const resultMatch = predictedResult === actualResult;

    // Partial match with result consideration
    let points = 0;
    const details: string[] = [];

    // Check home score
    if (predicted.home === actual.home) {
      if (resultMatch) {
        points = Math.max(points, SCORING_POINTS.CORRECT_WINNER); // Correct side + correct result
        details.push('home score + correct result');
      } else {
        points = Math.max(points, SCORING_POINTS.PARTICIPATION); // Correct side only
        details.push('home score only');
      }
    }

    // Check away score
    if (predicted.away === actual.away) {
      if (resultMatch) {
        points = Math.max(points, SCORING_POINTS.CORRECT_WINNER); // Correct side + correct result
        details.push('away score + correct result');
      } else {
        points = Math.max(points, SCORING_POINTS.PARTICIPATION); // Correct side only
        details.push('away score only');
      }
    }

    if (points > 0) {
      return {
        points,
        type: ScoreType.PARTIAL,
        details: details.join(' or '),
      };
    }

    // No match
    return {
      points: 0,
      type: ScoreType.NONE,
      details: 'No match',
    };
  }

  /**
   * Scores a single bet for a finished match
   */
  async scoreBet(bet: Bet, match: Match): Promise<void> {
    try {
      // Check if match has valid scores
      if (match.home_score === null || match.away_score === null) {
        logger.warn('Match does not have valid scores yet', { matchId: match.id });
        return;
      }

      // Check if bet already scored
      const existingScore = await scoreRepository.findByBetId(bet.id);
      if (existingScore) {
        logger.debug('Bet already scored', { betId: bet.id });
        return;
      }

      // Calculate score
      const predicted: ScorePrediction = {
        home: bet.predicted_home_score,
        away: bet.predicted_away_score,
      };

      const actual: ScorePrediction = {
        home: match.home_score,
        away: match.away_score,
      };

      const result = this.calculateScore(predicted, actual);

      // Save score
      await scoreRepository.create(bet.id, result.points, result.type);

      logger.info('Bet scored successfully', {
        betId: bet.id,
        userId: bet.user_id,
        matchId: match.id,
        points: result.points,
        type: result.type,
      });
    } catch (error) {
      logger.error(SERVICE_ERROR_PREFIX.FAILED_TO_SCORE_BET, {
        error,
        betId: bet.id,
        matchId: match.id,
      });
      throw error;
    }
  }

  /**
   * Scores all unscored bets for a finished match
   */
  async scoreMatchBets(match: Match): Promise<number> {
    try {
      if (match.home_score === null || match.away_score === null) {
        logger.warn('Cannot score match without valid scores', { matchId: match.id });
        return 0;
      }

      const unscoredBets = await betRepository.findUnscoredForMatch(match.id);

      if (unscoredBets.length === 0) {
        logger.debug('No unscored bets for match', { matchId: match.id });
        return 0;
      }

      logger.info(`Scoring ${unscoredBets.length} bets for match`, {
        matchId: match.id,
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        score: `${match.home_score}-${match.away_score}`,
      });

      for (const bet of unscoredBets) {
        await this.scoreBet(bet, match);
      }

      return unscoredBets.length;
    } catch (error) {
      logger.error(SERVICE_ERROR_PREFIX.FAILED_TO_SCORE_MATCH_BETS, { error, matchId: match.id });
      throw error;
    }
  }
}

export const scoringService = new ScoringService();
