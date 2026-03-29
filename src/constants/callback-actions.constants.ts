/**
 * Callback action constants for bot keyboards
 */

// Callback data prefixes
export const CALLBACK_PREFIX = {
  BET: 'bet',
  BET_SCORE: 'bet_score',
  BET_CONFIRM: 'bet_confirm',
  CANCEL_BET: 'cancel_bet',
  TOURNAMENT_PREDICTION_SELECT: 'tp_select',
  TOURNAMENT_PREDICTION_CONFIRM: 'tp_confirm',
  GROUP_STAGE_PREDICTION_GROUP: 'gsp_group',
  GROUP_STAGE_PREDICTION_SELECT: 'gsp_select',
  RESULT: 'result',
} as const;

// Callback data builders
export const buildCallbackData = {
  bet: (matchId: number) => `${CALLBACK_PREFIX.BET}_${matchId}`,
  betScore: (matchId: number, team: 'home' | 'away', score: number) =>
    `${CALLBACK_PREFIX.BET_SCORE}_${matchId}_${team}_${score}`,
  betConfirm: (matchId: number, homeScore: number, awayScore: number) =>
    `${CALLBACK_PREFIX.BET_CONFIRM}_${matchId}_${homeScore}_${awayScore}`,
  cancelBet: () => CALLBACK_PREFIX.CANCEL_BET,
  tournamentPredictionSelect: (position: string, team: string) =>
    `${CALLBACK_PREFIX.TOURNAMENT_PREDICTION_SELECT}_${position}_${team}`,
  tournamentPredictionConfirm: (predictions: string) =>
    `${CALLBACK_PREFIX.TOURNAMENT_PREDICTION_CONFIRM}_${predictions}`,
  groupStagePredictionGroup: (group: string) =>
    `${CALLBACK_PREFIX.GROUP_STAGE_PREDICTION_GROUP}_${group}`,
  groupStagePredictionSelect: (group: string, position: string, team: string) =>
    `${CALLBACK_PREFIX.GROUP_STAGE_PREDICTION_SELECT}_${group}_${position}_${team}`,
  result: (matchId: number) => `${CALLBACK_PREFIX.RESULT}_${matchId}`,
} as const;
