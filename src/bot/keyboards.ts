import { InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup } from 'telegraf/types';
import { MatchWithLeague } from '../types';
import { formatTeamWithFlag } from '../utils/flags';
import { formatDateTimeShort, formatDateOnly } from '../utils/date.utils';
import { buildCallbackData } from '../constants';

export function createMainMenuKeyboard(isAdmin: boolean = false): {
  reply_markup: ReplyKeyboardMarkup;
} {
  const keyboard = [
    [{ text: '🗓️ Today Matches' }, { text: '📅 Upcoming Matches' }],
    [{ text: '✅ Completed Matches' }, { text: '🎲 My Bets' }],
    [{ text: '📊 My Stats' }, { text: '🏆 Leaderboard' }],
    [{ text: '⚽ Group Stage Prediction' }, { text: '🏅 Top 4 Prediction' }],
    [{ text: '❓ Help' }],
  ];

  // Add admin buttons if user is admin
  if (isAdmin) {
    keyboard.push([{ text: '🤖 Fetch New Matches' }, { text: '🤖 Refresh Match Statuses' }]);
    keyboard.push([{ text: '🤖 Calculate User Points' }]);
    keyboard.push([
      { text: '🤖 Send Pre-Match Notifications' },
      { text: '🤖 Send Post-Match Notifications' },
    ]);
  }

  return {
    reply_markup: {
      keyboard,
      resize_keyboard: true,
      is_persistent: true,
    },
  };
}

export function createMatchListKeyboard(matches: MatchWithLeague[]): InlineKeyboardMarkup {
  const buttons: InlineKeyboardButton[][] = matches.map((match) => {
    const dateStr = formatDateTimeShort(new Date(match.match_date));

    return [
      {
        text: `${formatTeamWithFlag(match.home_team)} vs ${formatTeamWithFlag(match.away_team)} - ${dateStr}`,
        callback_data: buildCallbackData.bet(match.id),
      },
    ];
  });

  return { inline_keyboard: buttons };
}

export function createCompletedMatchListKeyboard(matches: MatchWithLeague[]): InlineKeyboardMarkup {
  const buttons: InlineKeyboardButton[][] = matches.map((match) => {
    const dateStr = formatDateOnly(new Date(match.match_date));

    const scoreText =
      match.home_score !== null && match.away_score !== null
        ? `${match.home_score}-${match.away_score}`
        : 'N/A';

    return [
      {
        text: `${formatTeamWithFlag(match.home_team)} vs ${formatTeamWithFlag(match.away_team)} (${scoreText}) - ${dateStr}`,
        callback_data: buildCallbackData.result(match.id),
      },
    ];
  });

  return { inline_keyboard: buttons };
}

export function createTeamSelectionKeyboard(
  teams: string[],
  position: 'first' | 'second' | 'third' | 'fourth',
  excludeTeams: string[] = []
): InlineKeyboardMarkup {
  const availableTeams = teams.filter((team) => !excludeTeams.includes(team));
  const buttons: InlineKeyboardButton[][] = [];

  // Create rows of 2 teams each
  for (let i = 0; i < availableTeams.length; i += 2) {
    const row: InlineKeyboardButton[] = [];
    row.push({
      text: formatTeamWithFlag(availableTeams[i]),
      callback_data: buildCallbackData.tournamentPredictionSelect(position, availableTeams[i]),
    });
    if (i + 1 < availableTeams.length) {
      row.push({
        text: formatTeamWithFlag(availableTeams[i + 1]),
        callback_data: buildCallbackData.tournamentPredictionSelect(
          position,
          availableTeams[i + 1]
        ),
      });
    }
    buttons.push(row);
  }

  // Add cancel button
  buttons.push([{ text: '❌ Cancel', callback_data: 'tp_cancel' }]);

  return { inline_keyboard: buttons };
}

export function createTournamentPredictionConfirmKeyboard(
  first: string,
  second: string,
  third: string,
  fourth: string
): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: '✅ Confirm Prediction',
          callback_data: buildCallbackData.tournamentPredictionConfirm(
            `${first}_${second}_${third}_${fourth}`
          ),
        },
      ],
      [{ text: '🔄 Start Over', callback_data: 'tp_start' }],
      [{ text: '❌ Cancel', callback_data: 'tp_cancel' }],
    ],
  };
}

export function createExistingTournamentPredictionKeyboard(
  isScored: boolean = false
): InlineKeyboardMarkup {
  if (isScored) {
    return {
      inline_keyboard: [[{ text: '❌ Close', callback_data: 'tp_close' }]],
    };
  }

  return {
    inline_keyboard: [
      [{ text: '✏️ Modify 1st Place', callback_data: 'tp_modify_first' }],
      [{ text: '✏️ Modify 2nd Place', callback_data: 'tp_modify_second' }],
      [{ text: '✏️ Modify 3rd Place', callback_data: 'tp_modify_third' }],
      [{ text: '✏️ Modify 4th Place', callback_data: 'tp_modify_fourth' }],
      [{ text: '🔄 Modify All', callback_data: 'tp_modify_all' }],
      [{ text: '❌ Close', callback_data: 'tp_close' }],
    ],
  };
}

export function createCancelKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[{ text: 'Cancel', callback_data: 'cancel' }]],
  };
}

export function createScoreSelectionKeyboard(
  matchId: number,
  team: 'home' | 'away'
): InlineKeyboardMarkup {
  const scores = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const rows: InlineKeyboardButton[][] = [];

  // Create rows of 3 buttons each
  for (let i = 0; i < scores.length; i += 3) {
    const row: InlineKeyboardButton[] = scores.slice(i, i + 3).map((score) => ({
      text: score.toString(),
      callback_data: buildCallbackData.betScore(matchId, team, score),
    }));
    rows.push(row);
  }

  // Add "10+" button for custom input
  rows.push([{ text: '10+ (Enter custom)', callback_data: `bet_custom_${matchId}_${team}` }]);

  // Add cancel button
  rows.push([{ text: '❌ Cancel', callback_data: buildCallbackData.cancelBet() }]);

  return { inline_keyboard: rows };
}

export function createBetConfirmationKeyboard(
  matchId: number,
  homeScore: number,
  awayScore: number
): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: '✅ Confirm Bet',
          callback_data: buildCallbackData.betConfirm(matchId, homeScore, awayScore),
        },
      ],
      [
        { text: '🔄 Change Home Score', callback_data: `bet_change_home_${matchId}_${awayScore}` },
        { text: '🔄 Change Away Score', callback_data: `bet_change_away_${matchId}_${homeScore}` },
      ],
      [{ text: '❌ Cancel', callback_data: buildCallbackData.cancelBet() }],
    ],
  };
}

export function createExistingBetKeyboard(matchId: number): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '✏️ Modify Bet', callback_data: `bet_modify_${matchId}` }],
      [{ text: '❌ Cancel', callback_data: buildCallbackData.cancelBet() }],
    ],
  };
}

export function createGroupSelectionKeyboard(
  completedGroups: string[] = [],
  availableGroups: string[] = []
): InlineKeyboardMarkup {
  const buttons: InlineKeyboardButton[][] = [];

  // Create rows of 4 groups each
  for (let i = 0; i < availableGroups.length; i += 4) {
    const row: InlineKeyboardButton[] = [];
    for (let j = i; j < Math.min(i + 4, availableGroups.length); j++) {
      const group = availableGroups[j];
      const isCompleted = completedGroups.includes(group);
      row.push({
        text: isCompleted ? `✅ ${group}` : group,
        callback_data: buildCallbackData.groupStagePredictionGroup(group),
      });
    }
    buttons.push(row);
  }

  // Add confirm/cancel buttons
  if (completedGroups.length > 0) {
    const confirmText =
      completedGroups.length === availableGroups.length
        ? '✅ Confirm All Predictions'
        : `✅ Confirm (${completedGroups.length}/${availableGroups.length} groups)`;
    buttons.push([{ text: confirmText, callback_data: 'gsp_confirm' }]);
  }
  buttons.push([{ text: '❌ Cancel', callback_data: 'gsp_cancel' }]);

  return { inline_keyboard: buttons };
}

export function createGroupTeamSelectionKeyboard(
  teams: string[],
  group: string,
  position: 'first' | 'second',
  excludeTeams: string[] = []
): InlineKeyboardMarkup {
  const availableTeams = teams.filter((team) => !excludeTeams.includes(team));
  const buttons: InlineKeyboardButton[][] = [];

  // Create rows of 2 teams each
  for (let i = 0; i < availableTeams.length; i += 2) {
    const row: InlineKeyboardButton[] = [];
    row.push({
      text: formatTeamWithFlag(availableTeams[i]),
      callback_data: buildCallbackData.groupStagePredictionSelect(
        group,
        position,
        availableTeams[i]
      ),
    });
    if (i + 1 < availableTeams.length) {
      row.push({
        text: formatTeamWithFlag(availableTeams[i + 1]),
        callback_data: buildCallbackData.groupStagePredictionSelect(
          group,
          position,
          availableTeams[i + 1]
        ),
      });
    }
    buttons.push(row);
  }

  // Add back button
  buttons.push([{ text: '⬅️ Back to Groups', callback_data: 'gsp_back' }]);
  buttons.push([{ text: '❌ Cancel', callback_data: 'gsp_cancel' }]);

  return { inline_keyboard: buttons };
}

export function createGroupPredictionConfirmKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: '✅ Confirm Predictions', callback_data: 'gsp_confirm' }],
      [{ text: '🔄 Start Over', callback_data: 'gsp_start' }],
      [{ text: '❌ Cancel', callback_data: 'gsp_cancel' }],
    ],
  };
}

export function createExistingGroupPredictionKeyboard(
  isScored: boolean = false
): InlineKeyboardMarkup {
  if (isScored) {
    return {
      inline_keyboard: [[{ text: '❌ Close', callback_data: 'gsp_close' }]],
    };
  }

  return {
    inline_keyboard: [
      [{ text: '✏️ Modify Predictions', callback_data: 'gsp_modify' }],
      [{ text: '❌ Close', callback_data: 'gsp_close' }],
    ],
  };
}
