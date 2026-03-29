/**
 * Scoring system constants
 */

export const SCORING_POINTS = {
  EXACT_MATCH: 6, // Exact score match
  GOAL_DIFFERENCE: 4, // Correct goal difference
  CORRECT_WINNER: 3, // Correct winner/draw
  PARTICIPATION: 1, // Participated but wrong prediction
} as const;
