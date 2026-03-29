import { ScoringService } from '../src/services/scoring.service';
import { ScorePrediction, ScoreType } from '../src/types';
import { SCORING_POINTS } from '../src/constants';

describe('ScoringService', () => {
  let scoringService: ScoringService;

  beforeEach(() => {
    scoringService = new ScoringService();
  });

  describe('calculateScore', () => {
    describe(`Exact score match (${SCORING_POINTS.EXACT_MATCH} points)`, () => {
      it(`should award ${SCORING_POINTS.EXACT_MATCH} points for exact score prediction`, () => {
        const predicted: ScorePrediction = { home: 2, away: 1 };
        const actual: ScorePrediction = { home: 2, away: 1 };

        const result = scoringService.calculateScore(predicted, actual);

        expect(result.points).toBe(SCORING_POINTS.EXACT_MATCH);
        expect(result.type).toBe(ScoreType.EXACT);
      });

      it(`should award ${SCORING_POINTS.EXACT_MATCH} points for 0-0 exact prediction`, () => {
        const predicted: ScorePrediction = { home: 0, away: 0 };
        const actual: ScorePrediction = { home: 0, away: 0 };

        const result = scoringService.calculateScore(predicted, actual);

        expect(result.points).toBe(SCORING_POINTS.EXACT_MATCH);
        expect(result.type).toBe(ScoreType.EXACT);
      });
    });

    describe(`Goal difference match (${SCORING_POINTS.GOAL_DIFFERENCE} points)`, () => {
      it(`should award ${SCORING_POINTS.GOAL_DIFFERENCE} points for correct goal difference (+1)`, () => {
        const predicted: ScorePrediction = { home: 2, away: 1 };
        const actual: ScorePrediction = { home: 3, away: 2 };

        const result = scoringService.calculateScore(predicted, actual);

        expect(result.points).toBe(SCORING_POINTS.GOAL_DIFFERENCE);
        expect(result.type).toBe(ScoreType.GOAL_DIFF);
      });

      it(`should award ${SCORING_POINTS.GOAL_DIFFERENCE} points for correct goal difference (-2)`, () => {
        const predicted: ScorePrediction = { home: 0, away: 2 };
        const actual: ScorePrediction = { home: 1, away: 3 };

        const result = scoringService.calculateScore(predicted, actual);

        expect(result.points).toBe(SCORING_POINTS.GOAL_DIFFERENCE);
        expect(result.type).toBe(ScoreType.GOAL_DIFF);
      });

      it(`should award ${SCORING_POINTS.GOAL_DIFFERENCE} points for correct draw (0 difference)`, () => {
        const predicted: ScorePrediction = { home: 1, away: 1 };
        const actual: ScorePrediction = { home: 2, away: 2 };

        const result = scoringService.calculateScore(predicted, actual);

        expect(result.points).toBe(SCORING_POINTS.GOAL_DIFFERENCE);
        expect(result.type).toBe(ScoreType.GOAL_DIFF);
      });
    });

    describe(`Correct one side + correct result (${SCORING_POINTS.CORRECT_WINNER} points)`, () => {
      it(`should award ${SCORING_POINTS.CORRECT_WINNER} points for home score correct with home win`, () => {
        const predicted: ScorePrediction = { home: 2, away: 0 };
        const actual: ScorePrediction = { home: 2, away: 1 };

        const result = scoringService.calculateScore(predicted, actual);

        expect(result.points).toBe(SCORING_POINTS.CORRECT_WINNER);
        expect(result.type).toBe(ScoreType.PARTIAL);
      });

      it(`should award ${SCORING_POINTS.CORRECT_WINNER} points for away score correct with away win`, () => {
        const predicted: ScorePrediction = { home: 0, away: 3 };
        const actual: ScorePrediction = { home: 1, away: 3 };

        const result = scoringService.calculateScore(predicted, actual);

        expect(result.points).toBe(SCORING_POINTS.CORRECT_WINNER);
        expect(result.type).toBe(ScoreType.PARTIAL);
      });

      it(`should award ${SCORING_POINTS.PARTICIPATION} point for home score correct with draw`, () => {
        const predicted: ScorePrediction = { home: 1, away: 1 };
        const actual: ScorePrediction = { home: 1, away: 2 };

        // Both predicted and actual are not the same result
        // Predicted: draw (1-1), Actual: away win (1-2)
        // This should be 1 point, not 3
        const result = scoringService.calculateScore(predicted, actual);

        expect(result.points).toBe(SCORING_POINTS.PARTICIPATION);
        expect(result.type).toBe(ScoreType.PARTIAL);
      });

      it(`should award ${SCORING_POINTS.EXACT_MATCH} points for correct draw prediction with same home score`, () => {
        const predicted: ScorePrediction = { home: 2, away: 2 };
        const actual: ScorePrediction = { home: 2, away: 2 };

        // This is exact match
        const result = scoringService.calculateScore(predicted, actual);

        expect(result.points).toBe(SCORING_POINTS.EXACT_MATCH);
        expect(result.type).toBe(ScoreType.EXACT);
      });

      it(`should award ${SCORING_POINTS.EXACT_MATCH} points for home score + both draws`, () => {
        const predicted: ScorePrediction = { home: 1, away: 1 };
        const actual: ScorePrediction = { home: 1, away: 1 };

        // Exact match
        const result = scoringService.calculateScore(predicted, actual);

        expect(result.points).toBe(SCORING_POINTS.EXACT_MATCH);
        expect(result.type).toBe(ScoreType.EXACT);
      });
    });

    describe(`Correct one side only - wrong result (${SCORING_POINTS.PARTICIPATION} point)`, () => {
      it(`should award ${SCORING_POINTS.PARTICIPATION} point when home score correct but predicted win, got loss`, () => {
        const predicted: ScorePrediction = { home: 1, away: 0 }; // Home win
        const actual: ScorePrediction = { home: 1, away: 2 };     // Away win

        const result = scoringService.calculateScore(predicted, actual);

        expect(result.points).toBe(SCORING_POINTS.PARTICIPATION);
        expect(result.type).toBe(ScoreType.PARTIAL);
      });

      it(`should award ${SCORING_POINTS.PARTICIPATION} point when away score correct but predicted loss, got win`, () => {
        const predicted: ScorePrediction = { home: 3, away: 1 }; // Home win
        const actual: ScorePrediction = { home: 0, away: 1 };     // Away win

        const result = scoringService.calculateScore(predicted, actual);

        expect(result.points).toBe(SCORING_POINTS.PARTICIPATION);
        expect(result.type).toBe(ScoreType.PARTIAL);
      });

      it(`should award ${SCORING_POINTS.PARTICIPATION} point when home score correct but predicted win, got draw`, () => {
        const predicted: ScorePrediction = { home: 2, away: 0 }; // Home win
        const actual: ScorePrediction = { home: 2, away: 2 };     // Draw

        const result = scoringService.calculateScore(predicted, actual);

        expect(result.points).toBe(SCORING_POINTS.PARTICIPATION);
        expect(result.type).toBe(ScoreType.PARTIAL);
      });

      it(`should award ${SCORING_POINTS.PARTICIPATION} point when away score correct but predicted draw, got win`, () => {
        const predicted: ScorePrediction = { home: 1, away: 1 }; // Draw
        const actual: ScorePrediction = { home: 0, away: 1 };     // Away win

        const result = scoringService.calculateScore(predicted, actual);

        expect(result.points).toBe(SCORING_POINTS.PARTICIPATION);
        expect(result.type).toBe(ScoreType.PARTIAL);
      });
    });

    describe('No match (0 points)', () => {
      it('should award 0 points when nothing matches', () => {
        const predicted: ScorePrediction = { home: 2, away: 1 };
        const actual: ScorePrediction = { home: 0, away: 3 };

        const result = scoringService.calculateScore(predicted, actual);

        expect(result.points).toBe(0);
        expect(result.type).toBe(ScoreType.NONE);
      });

      it('should award 0 points for opposite results', () => {
        const predicted: ScorePrediction = { home: 5, away: 0 };
        const actual: ScorePrediction = { home: 0, away: 5 };

        const result = scoringService.calculateScore(predicted, actual);

        expect(result.points).toBe(0);
        expect(result.type).toBe(ScoreType.NONE);
      });
    });

    describe('Priority and edge cases', () => {
      it('should prioritize exact match over everything', () => {
        const predicted: ScorePrediction = { home: 3, away: 1 };
        const actual: ScorePrediction = { home: 3, away: 1 };

        const result = scoringService.calculateScore(predicted, actual);

        expect(result.type).toBe(ScoreType.EXACT);
        expect(result.points).toBe(SCORING_POINTS.EXACT_MATCH);
      });

      it('should prioritize goal difference over partial', () => {
        const predicted: ScorePrediction = { home: 3, away: 0 };
        const actual: ScorePrediction = { home: 6, away: 3 };

        const result = scoringService.calculateScore(predicted, actual);

        expect(result.type).toBe(ScoreType.GOAL_DIFF);
        expect(result.points).toBe(SCORING_POINTS.GOAL_DIFFERENCE);
      });

      it(`should never award more than ${SCORING_POINTS.EXACT_MATCH} points`, () => {
        const testCases: Array<{ predicted: ScorePrediction; actual: ScorePrediction }> = [
          { predicted: { home: 5, away: 3 }, actual: { home: 5, away: 3 } },
          { predicted: { home: 2, away: 1 }, actual: { home: 3, away: 2 } },
          { predicted: { home: 1, away: 0 }, actual: { home: 1, away: 2 } },
        ];

        for (const testCase of testCases) {
          const result = scoringService.calculateScore(testCase.predicted, testCase.actual);
          expect(result.points).toBeLessThanOrEqual(SCORING_POINTS.EXACT_MATCH);
        }
      });
    });

    describe('Real-world scenarios with new scoring', () => {
      it(`Example 1: Predicted 2-0 (home win), Actual 2-1 (home win) = ${SCORING_POINTS.CORRECT_WINNER} points`, () => {
        const predicted: ScorePrediction = { home: 2, away: 0 };
        const actual: ScorePrediction = { home: 2, away: 1 };

        const result = scoringService.calculateScore(predicted, actual);

        expect(result.points).toBe(SCORING_POINTS.CORRECT_WINNER);
        expect(result.type).toBe(ScoreType.PARTIAL);
      });

      it(`Example 2: Predicted 1-0 (home win), Actual 1-2 (away win) = ${SCORING_POINTS.PARTICIPATION} point`, () => {
        const predicted: ScorePrediction = { home: 1, away: 0 };
        const actual: ScorePrediction = { home: 1, away: 2 };

        const result = scoringService.calculateScore(predicted, actual);

        expect(result.points).toBe(SCORING_POINTS.PARTICIPATION);
        expect(result.type).toBe(ScoreType.PARTIAL);
      });

      it(`Example 3: Predicted 3-1 (home win), Actual 3-0 (home win) = ${SCORING_POINTS.CORRECT_WINNER} points`, () => {
        const predicted: ScorePrediction = { home: 3, away: 1 };
        const actual: ScorePrediction = { home: 3, away: 0 };

        const result = scoringService.calculateScore(predicted, actual);

        expect(result.points).toBe(SCORING_POINTS.CORRECT_WINNER);
        expect(result.type).toBe(ScoreType.PARTIAL);
      });

      it(`Example 4: Predicted 0-2 (away win), Actual 1-2 (away win) = ${SCORING_POINTS.CORRECT_WINNER} points`, () => {
        const predicted: ScorePrediction = { home: 0, away: 2 };
        const actual: ScorePrediction = { home: 1, away: 2 };

        const result = scoringService.calculateScore(predicted, actual);

        expect(result.points).toBe(SCORING_POINTS.CORRECT_WINNER);
        expect(result.type).toBe(ScoreType.PARTIAL);
      });
    });
  });
});
