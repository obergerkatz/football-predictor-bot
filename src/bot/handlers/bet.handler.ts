import { Context } from 'telegraf';
import { matchService, betService, userService } from '../../services';
import { logger } from '../../utils/logger';
import {
  createScoreSelectionKeyboard,
  createBetConfirmationKeyboard,
  createExistingBetKeyboard,
} from '../keyboards';
import { formatTeamWithFlag } from '../../utils/flags';
import { SESSION_TIMEOUT, CALLBACK_PREFIX } from '../../constants';
import { formatDateTimeWithWeekday } from '../../utils/date.utils';

// Simple in-memory session store for betting flow
interface BetSession {
  matchId: number;
  userId: number;
  timestamp: number;
  homeScore?: number;
  awayScore?: number;
  waitingForCustomScore?: 'home' | 'away';
  isModifying?: boolean; // Track if this is a bet modification
}

const betSessions = new Map<number, BetSession>();
const BET_SESSION_TIMEOUT = SESSION_TIMEOUT.BET;

function createBetSession(userId: number, matchId: number): void {
  betSessions.set(userId, {
    matchId,
    userId,
    timestamp: Date.now(),
  });
}

function getBetSession(userId: number): BetSession | null {
  const session = betSessions.get(userId);
  if (!session) return null;

  // Check if session expired
  if (Date.now() - session.timestamp > BET_SESSION_TIMEOUT) {
    betSessions.delete(userId);
    return null;
  }

  return session;
}

function clearBetSession(userId: number): void {
  betSessions.delete(userId);
}

// Removed /bet command - users now bet through /matches

export async function handleBetCallback(ctx: Context): Promise<void> {
  try {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    if (!ctx.from) return;

    const callbackData = ctx.callbackQuery.data;
    const matchId = parseInt(callbackData.replace(`${CALLBACK_PREFIX.BET}_`, ''), 10);

    if (isNaN(matchId)) {
      await ctx.answerCbQuery('Invalid match');
      return;
    }

    // Get user
    const telegramId = ctx.from.id.toString();
    const user = await userService.getUserByTelegramId(telegramId);

    if (!user) {
      await ctx.answerCbQuery('User not found. Please tap /start first.');
      return;
    }

    // Get match details
    const match = await matchService.getMatchWithLeagueById(matchId);

    if (!match) {
      await ctx.answerCbQuery('Match not found');
      return;
    }

    // Check if betting is allowed
    const canBet = await matchService.canPlaceBet(matchId);
    if (!canBet.allowed) {
      await ctx.answerCbQuery(canBet.reason || 'Cannot place bet on this match');
      return;
    }

    const matchDate = formatDateTimeWithWeekday(new Date(match.match_date));

    // Check if user already has a bet
    const existingBet = await betService.getUserBetForMatch(user.id, matchId);
    if (existingBet) {
      await ctx.answerCbQuery();
      await ctx.reply(
        `You already have a bet on this match:

${match.league.name}
🏠 ${formatTeamWithFlag(match.home_team)} ${existingBet.predicted_home_score} - ${existingBet.predicted_away_score} 🛫 ${formatTeamWithFlag(match.away_team)}
📅 ${matchDate}

You can modify your bet until the match starts.`,
        { reply_markup: createExistingBetKeyboard(matchId) }
      );
      return;
    }

    // Create betting session using Telegram ID
    createBetSession(ctx.from.id, matchId);

    await ctx.answerCbQuery();
    await ctx.reply(
      `🎯 Place your bet for:

${match.league.name}
🏠 ${formatTeamWithFlag(match.home_team)} vs 🛫 ${formatTeamWithFlag(match.away_team)}
📅 ${matchDate}

Select the score for ${formatTeamWithFlag(match.home_team)} (Home):`,
      { reply_markup: createScoreSelectionKeyboard(matchId, 'home') }
    );

    logger.info('Bet session created', { telegramUserId: ctx.from.id, dbUserId: user.id, matchId });
  } catch (error) {
    logger.error('Error handling bet callback', { error });
    await ctx.answerCbQuery('Error processing bet. Please try again.');
  }
}

export async function handleScoreSelection(ctx: Context): Promise<void> {
  try {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    if (!ctx.from) return;

    const callbackData = ctx.callbackQuery.data;
    const parts = callbackData.split('_'); // bet_score_matchId_team_score
    const matchId = parseInt(parts[2], 10);
    const team = parts[3] as 'home' | 'away';
    const score = parseInt(parts[4], 10);

    const userId = ctx.from.id;

    // Get session
    const session = getBetSession(userId);
    if (!session || session.matchId !== matchId) {
      await ctx.answerCbQuery('Session expired. Please try again.');
      return;
    }

    // Get match details
    const match = await matchService.getMatchWithLeagueById(matchId);
    if (!match) {
      await ctx.answerCbQuery('Match not found');
      clearBetSession(userId);
      return;
    }

    if (team === 'home') {
      // Home score selected, now ask for away score
      session.homeScore = score;
      session.timestamp = Date.now(); // Refresh timeout

      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `🎯 Place your bet for:

${match.league.name}
🏠 ${formatTeamWithFlag(match.home_team)} ${score} - ? 🛫 ${formatTeamWithFlag(match.away_team)}

Select the score for ${formatTeamWithFlag(match.away_team)} (Away):`,
        { reply_markup: createScoreSelectionKeyboard(matchId, 'away') }
      );
    } else {
      // Away score selected, show confirmation
      session.awayScore = score;
      session.timestamp = Date.now();

      const homeScore = session.homeScore!;

      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `🎯 Confirm your bet:

${match.league.name}
🏠 ${formatTeamWithFlag(match.home_team)} ${homeScore} - ${score} 🛫 ${formatTeamWithFlag(match.away_team)}

📅 ${formatDateTimeWithWeekday(new Date(match.match_date))}`,
        { reply_markup: createBetConfirmationKeyboard(matchId, homeScore, score) }
      );
    }

    logger.debug('Score selected', { userId, matchId, team, score });
  } catch (error) {
    logger.error('Error handling score selection', { error });
    await ctx.answerCbQuery('Error processing selection. Please try again.');
  }
}

export async function handleBetConfirmation(ctx: Context): Promise<void> {
  try {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    if (!ctx.from) return;

    const callbackData = ctx.callbackQuery.data;
    const parts = callbackData.split('_'); // bet_confirm_matchId_homeScore_awayScore
    const matchId = parseInt(parts[2], 10);
    const homeScore = parseInt(parts[3], 10);
    const awayScore = parseInt(parts[4], 10);

    const userId = ctx.from.id;
    const telegramId = userId.toString();

    // Get session
    const session = getBetSession(userId);
    if (!session || session.matchId !== matchId) {
      await ctx.answerCbQuery('Session expired. Please try again.');
      return;
    }

    // Get user
    const user = await userService.getUserByTelegramId(telegramId);
    if (!user) {
      await ctx.answerCbQuery('User not found. Please tap /start first.');
      clearBetSession(userId);
      return;
    }

    // Get match details
    const match = await matchService.getMatchWithLeagueById(matchId);
    if (!match) {
      await ctx.answerCbQuery('Match not found');
      clearBetSession(userId);
      return;
    }

    // Place or update bet based on session flag
    const isModifying = session.isModifying || false;
    const result = isModifying
      ? await betService.updateBet(user.id, matchId, { home: homeScore, away: awayScore })
      : await betService.placeBet(user.id, matchId, { home: homeScore, away: awayScore });

    if (!result.success) {
      await ctx.answerCbQuery(`Error: ${result.error}`);
      await ctx.editMessageText(`❌ ${result.error}\n\nTap 📅 Upcoming Matches to try again.`);
      clearBetSession(userId);
      return;
    }

    // Success
    await ctx.answerCbQuery(isModifying ? 'Bet updated! 🎉' : 'Bet placed! 🎉');
    await ctx.editMessageText(
      `✅ Bet ${isModifying ? 'updated' : 'placed'} successfully!\n\n` +
        `Match: ${formatTeamWithFlag(match.home_team)} vs ${formatTeamWithFlag(match.away_team)}\n` +
        `Your prediction: ${homeScore}-${awayScore}\n\n` +
        `Good luck! 🍀\n\n` +
        `Tap 🎲 My Bets to view all your predictions.`
    );

    logger.info(isModifying ? 'Bet updated' : 'Bet placed', {
      userId: user.id,
      matchId,
      prediction: `${homeScore}-${awayScore}`,
    });

    clearBetSession(userId);
  } catch (error) {
    logger.error('Error handling bet confirmation', { error });
    await ctx.answerCbQuery('Error placing bet. Please try again.');
  }
}

export async function handleChangeScore(ctx: Context): Promise<void> {
  try {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    if (!ctx.from) return;

    const callbackData = ctx.callbackQuery.data;
    const parts = callbackData.split('_'); // bet_change_team_matchId_otherScore
    const team = parts[2] as 'home' | 'away';
    const matchId = parseInt(parts[3], 10);
    const otherScore = parseInt(parts[4], 10);

    const userId = ctx.from.id;

    // Get session
    const session = getBetSession(userId);
    if (!session || session.matchId !== matchId) {
      await ctx.answerCbQuery('Session expired. Please try again.');
      return;
    }

    // Get match details
    const match = await matchService.getMatchWithLeagueById(matchId);
    if (!match) {
      await ctx.answerCbQuery('Match not found');
      clearBetSession(userId);
      return;
    }

    session.timestamp = Date.now(); // Refresh timeout

    if (team === 'home') {
      // Change home score, keep away score
      session.awayScore = otherScore;
      session.homeScore = undefined;

      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `🎯 Place your bet for:

${match.league.name}
🏠 ${formatTeamWithFlag(match.home_team)} ? - ${otherScore} 🛫 ${formatTeamWithFlag(match.away_team)}

Select the score for ${formatTeamWithFlag(match.home_team)} (Home):`,
        { reply_markup: createScoreSelectionKeyboard(matchId, 'home') }
      );
    } else {
      // Change away score, keep home score
      session.homeScore = otherScore;
      session.awayScore = undefined;

      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `🎯 Place your bet for:

${match.league.name}
🏠 ${formatTeamWithFlag(match.home_team)} ${otherScore} - ? 🛫 ${formatTeamWithFlag(match.away_team)}

Select the score for ${formatTeamWithFlag(match.away_team)} (Away):`,
        { reply_markup: createScoreSelectionKeyboard(matchId, 'away') }
      );
    }

    logger.debug('Change score requested', { userId, matchId, team });
  } catch (error) {
    logger.error('Error handling change score', { error });
    await ctx.answerCbQuery('Error processing request. Please try again.');
  }
}

export async function handleModifyBet(ctx: Context): Promise<void> {
  try {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    if (!ctx.from) return;

    const callbackData = ctx.callbackQuery.data;
    const parts = callbackData.split('_'); // bet_modify_matchId
    const matchId = parseInt(parts[2], 10);

    const userId = ctx.from.id;

    // Get match details
    const match = await matchService.getMatchWithLeagueById(matchId);
    if (!match) {
      await ctx.answerCbQuery('Match not found');
      return;
    }

    // Create betting session for modification
    createBetSession(userId, matchId);
    const session = getBetSession(userId);
    if (session) {
      session.isModifying = true;
    }

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `✏️ Modify your bet for:

${match.league.name}
🏠 ${formatTeamWithFlag(match.home_team)} vs 🛫 ${formatTeamWithFlag(match.away_team)}

Select the new score for ${formatTeamWithFlag(match.home_team)} (Home):`,
      { reply_markup: createScoreSelectionKeyboard(matchId, 'home') }
    );

    logger.debug('Bet modification started', { userId, matchId });
  } catch (error) {
    logger.error('Error handling modify bet', { error });
    await ctx.answerCbQuery('Error starting modification. Please try again.');
  }
}

export async function handleCancelBet(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const userId = ctx.from.id;
    clearBetSession(userId);

    await ctx.answerCbQuery('Bet cancelled');
    await ctx.editMessageText('❌ Bet cancelled.\n\nTap 📅 Upcoming Matches to try again.');

    logger.debug('Bet cancelled', { userId });
  } catch (error) {
    logger.error('Error handling cancel bet', { error });
    await ctx.answerCbQuery('Error cancelling bet');
  }
}

export async function handleCustomScoreRequest(ctx: Context): Promise<void> {
  try {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    if (!ctx.from) return;

    const callbackData = ctx.callbackQuery.data;
    const parts = callbackData.split('_'); // bet_custom_matchId_team
    const matchId = parseInt(parts[2], 10);
    const team = parts[3] as 'home' | 'away';

    const userId = ctx.from.id;

    // Get session
    const session = getBetSession(userId);
    if (!session || session.matchId !== matchId) {
      await ctx.answerCbQuery('Session expired. Please try again.');
      return;
    }

    // Get match details
    const match = await matchService.getMatchWithLeagueById(matchId);
    if (!match) {
      await ctx.answerCbQuery('Match not found');
      clearBetSession(userId);
      return;
    }

    // Mark session as waiting for custom score
    session.waitingForCustomScore = team;
    session.timestamp = Date.now();

    await ctx.answerCbQuery();
    await ctx.reply(
      `Please enter the score for ${team === 'home' ? match.home_team : match.away_team}:\n\nJust type a number (e.g., 10, 15, 20...)`
    );

    logger.debug('Waiting for custom score', { userId, matchId, team });
  } catch (error) {
    logger.error('Error handling custom score request', { error });
    await ctx.answerCbQuery('Error processing request. Please try again.');
  }
}

export async function handleBetInput(ctx: Context): Promise<void> {
  try {
    if (!ctx.from || !ctx.message || !('text' in ctx.message)) return;

    const userId = ctx.from.id;
    const input = ctx.message.text.trim();

    // Get betting session
    const session = getBetSession(userId);
    if (!session || !session.waitingForCustomScore) {
      // Not waiting for custom score input, ignore
      return;
    }

    // Validate input is a number
    const score = parseInt(input, 10);
    if (isNaN(score) || score < 0 || score > 999) {
      await ctx.reply('❌ Please enter a valid number between 0 and 999.');
      return;
    }

    const team = session.waitingForCustomScore;
    const matchId = session.matchId;

    // Get match details
    const match = await matchService.getMatchWithLeagueById(matchId);
    if (!match) {
      await ctx.reply('Match not found.');
      clearBetSession(userId);
      return;
    }

    // Clear waiting flag
    session.waitingForCustomScore = undefined;
    session.timestamp = Date.now();

    if (team === 'home') {
      // Home score entered, now ask for away score
      session.homeScore = score;

      await ctx.reply(
        `🎯 Place your bet for:

${match.league.name}
🏠 ${formatTeamWithFlag(match.home_team)} ${score} - ? 🛫 ${formatTeamWithFlag(match.away_team)}

Select the score for ${formatTeamWithFlag(match.away_team)} (Away):`,
        { reply_markup: createScoreSelectionKeyboard(matchId, 'away') }
      );
    } else {
      // Away score entered, show confirmation
      session.awayScore = score;

      const homeScore = session.homeScore!;

      await ctx.reply(
        `🎯 Confirm your bet:

${match.league.name}
🏠 ${formatTeamWithFlag(match.home_team)} ${homeScore} - ${score} 🛫 ${formatTeamWithFlag(match.away_team)}

📅 ${formatDateTimeWithWeekday(new Date(match.match_date))}`,
        { reply_markup: createBetConfirmationKeyboard(matchId, homeScore, score) }
      );
    }

    logger.debug('Custom score entered', { userId, matchId, team, score });
  } catch (error) {
    logger.error('Error handling bet input', { error });
    await ctx.reply('Sorry, something went wrong. Tap 📅 Upcoming Matches to try again.');
    if (ctx.from) {
      clearBetSession(ctx.from.id);
    }
  }
}
