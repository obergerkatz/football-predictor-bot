import { Context } from 'telegraf';
import { tournamentPredictionService, userService } from '../../services';
import { logger } from '../../utils/logger';
import {
  createTeamSelectionKeyboard,
  createTournamentPredictionConfirmKeyboard,
  createExistingTournamentPredictionKeyboard,
} from '../keyboards';
import { formatTeamWithFlag } from '../../utils/flags';
import { SESSION_TIMEOUT, ERROR_MESSAGES } from '../../constants';

// Session store for tournament prediction flow
interface TournamentPredictionSession {
  userId: number;
  timestamp: number;
  first?: string;
  second?: string;
  third?: string;
  fourth?: string;
  modifyingSinglePosition?: 'first' | 'second' | 'third' | 'fourth'; // Track if modifying single position
}

const tpSessions = new Map<number, TournamentPredictionSession>();
const TP_SESSION_TIMEOUT = SESSION_TIMEOUT.TOURNAMENT_PREDICTION;

function getTpSession(userId: number): TournamentPredictionSession | null {
  const session = tpSessions.get(userId);
  if (!session) return null;

  if (Date.now() - session.timestamp > TP_SESSION_TIMEOUT) {
    tpSessions.delete(userId);
    return null;
  }

  return session;
}

function clearTpSession(userId: number): void {
  tpSessions.delete(userId);
}

export async function handleTournamentPrediction(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const telegramId = ctx.from.id.toString();
    const user = await userService.getUserByTelegramId(telegramId);

    if (!user) {
      await ctx.reply(ERROR_MESSAGES.USER_NOT_FOUND);
      return;
    }

    // Check if predictions are still allowed
    const canPlace = await tournamentPredictionService.canPlacePrediction();
    if (!canPlace.allowed) {
      await ctx.reply(
        `🏅 TOP 4 PREDICTION\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `❌ ${canPlace.reason}\n\n` +
          `Predictions must be placed before\n` +
          `the first match starts.\n` +
          `━━━━━━━━━━━━━━━━━━━━`
      );
      return;
    }

    // Check if user already has a prediction
    const existing = await tournamentPredictionService.getUserPrediction(user.id);

    if (existing) {
      let message = `🏅 TOP 4 PREDICTION\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      message += `YOUR PREDICTION\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      message += `🥇 1st: ${formatTeamWithFlag(existing.first_place)}\n`;
      message += `🥈 2nd: ${formatTeamWithFlag(existing.second_place)}\n`;
      message += `🥉 3rd: ${formatTeamWithFlag(existing.third_place)}\n`;
      message += `4️⃣  4th: ${formatTeamWithFlag(existing.fourth_place)}\n\n`;

      if (existing.is_scored) {
        message += `✅ FINAL SCORE\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `${existing.bonus_points}/28 bonus points earned! 🎉\n`;
      } else {
        message += `⏳ PENDING\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `7 points for each correct position\n`;
        message += `Maximum: 28 bonus points\n\n`;
        message += `💡 You can modify until the first match starts\n`;
      }

      message += `━━━━━━━━━━━━━━━━━━━━`;

      await ctx.reply(message, {
        reply_markup: createExistingTournamentPredictionKeyboard(existing.is_scored),
      });
      return;
    }

    // Start new prediction flow
    const teams = await tournamentPredictionService.getAvailableTeams();

    // Create session
    tpSessions.set(ctx.from.id, {
      userId: user.id,
      timestamp: Date.now(),
    });

    await ctx.reply(
      `🏅 TOP 4 PREDICTION\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Predict the tournament top 4!\n\n` +
        `📊 SCORING\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `   • 7 pts per correct position\n` +
        `   • Maximum: 28 bonus points\n\n` +
        `Select the 1st place team:\n` +
        `━━━━━━━━━━━━━━━━━━━━`,
      { reply_markup: createTeamSelectionKeyboard(teams, 'first') }
    );

    logger.debug('Tournament prediction started', { userId: user.id });
  } catch (error) {
    logger.error('Error handling tournament prediction', { error });
    await ctx.reply(
      `❌ Oops! Something went wrong.\n\n` +
        `We couldn't load the prediction form.\n` +
        `Please try tapping the 🏅 Top 4 Prediction button again.`
    );
  }
}

export async function handleTeamSelection(ctx: Context): Promise<void> {
  try {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    if (!ctx.from) return;

    const callbackData = ctx.callbackQuery.data;
    const parts = callbackData.split('_'); // tp_select_position_TeamName
    const position = parts[2] as 'first' | 'second' | 'third' | 'fourth';
    const teamName = parts.slice(3).join('_');

    const session = getTpSession(ctx.from.id);
    if (!session) {
      await ctx.answerCbQuery('Session expired. Please start again.');
      return;
    }

    const teams = await tournamentPredictionService.getAvailableTeams();

    // Update session
    session[position] = teamName;
    session.timestamp = Date.now();

    await ctx.answerCbQuery();

    // If modifying a single position, skip to confirmation
    if (
      session.modifyingSinglePosition &&
      session.first &&
      session.second &&
      session.third &&
      session.fourth
    ) {
      await ctx.editMessageText(
        `🏅 TOP 4 PREDICTION\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `UPDATED PREDICTION\n` +
          `🥇 1st: ${formatTeamWithFlag(session.first)}\n` +
          `🥈 2nd: ${formatTeamWithFlag(session.second)}\n` +
          `🥉 3rd: ${formatTeamWithFlag(session.third)}\n` +
          `4️⃣  4th: ${formatTeamWithFlag(session.fourth)}\n\n` +
          `💰 7 points per correct position\n\n` +
          `Confirm to save your updated prediction!`,
        {
          reply_markup: createTournamentPredictionConfirmKeyboard(
            session.first,
            session.second,
            session.third,
            session.fourth
          ),
        }
      );
      return;
    }

    // Determine next step
    if (!session.first) {
      await ctx.editMessageText(
        `🏅 TOP 4 PREDICTION\n` + `━━━━━━━━━━━━━━━━━━━━\n\n` + `Select the 1st place team:`,
        { reply_markup: createTeamSelectionKeyboard(teams, 'first') }
      );
    } else if (!session.second) {
      await ctx.editMessageText(
        `🏅 TOP 4 PREDICTION\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🥇 1st: ${formatTeamWithFlag(session.first!)}\n\n` +
          `Select the 2nd place team:`,
        { reply_markup: createTeamSelectionKeyboard(teams, 'second', [session.first!]) }
      );
    } else if (!session.third) {
      await ctx.editMessageText(
        `🏅 TOP 4 PREDICTION\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🥇 1st: ${formatTeamWithFlag(session.first!)}\n` +
          `🥈 2nd: ${formatTeamWithFlag(session.second!)}\n\n` +
          `Select the 3rd place team:`,
        {
          reply_markup: createTeamSelectionKeyboard(teams, 'third', [
            session.first!,
            session.second!,
          ]),
        }
      );
    } else if (!session.fourth) {
      await ctx.editMessageText(
        `🏅 TOP 4 PREDICTION\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🥇 1st: ${formatTeamWithFlag(session.first!)}\n` +
          `🥈 2nd: ${formatTeamWithFlag(session.second!)}\n` +
          `🥉 3rd: ${formatTeamWithFlag(session.third!)}\n\n` +
          `Select the 4th place team:`,
        {
          reply_markup: createTeamSelectionKeyboard(teams, 'fourth', [
            session.first!,
            session.second!,
            session.third!,
          ]),
        }
      );
    } else {
      // All selections made, show confirmation
      await ctx.editMessageText(
        `🏅 TOP 4 PREDICTION\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `YOUR PREDICTION\n` +
          `🥇 1st: ${formatTeamWithFlag(session.first)}\n` +
          `🥈 2nd: ${formatTeamWithFlag(session.second)}\n` +
          `🥉 3rd: ${formatTeamWithFlag(session.third)}\n` +
          `4️⃣  4th: ${formatTeamWithFlag(session.fourth)}\n\n` +
          `💰 7 points per correct position\n\n` +
          `Confirm to save your prediction!`,
        {
          reply_markup: createTournamentPredictionConfirmKeyboard(
            session.first,
            session.second,
            session.third,
            session.fourth
          ),
        }
      );
    }

    logger.debug('Team selected', { userId: session.userId, position, teamName });
  } catch (error) {
    logger.error('Error handling team selection', { error });
    await ctx.answerCbQuery('Error processing selection. Please try again.');
  }
}

export async function handleTournamentPredictionConfirm(ctx: Context): Promise<void> {
  try {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    if (!ctx.from) return;

    const callbackData = ctx.callbackQuery.data;
    const parts = callbackData.split('_'); // tp_confirm_first_second_third_fourth
    const first = parts[2];
    const second = parts[3];
    const third = parts[4];
    const fourth = parts[5];

    const session = getTpSession(ctx.from.id);
    if (!session) {
      await ctx.answerCbQuery('Session expired. Please start again.');
      return;
    }

    // Place prediction
    const result = await tournamentPredictionService.placePrediction(
      session.userId,
      first,
      second,
      third,
      fourth
    );

    if (!result.success) {
      await ctx.answerCbQuery(`Error: ${result.error}`);
      await ctx.editMessageText(
        `❌ Oops! Something went wrong.\n\n` +
          `${result.error}\n\n` +
          `Please try tapping the 🏅 Top 4 Prediction button again.`
      );
      clearTpSession(ctx.from.id);
      return;
    }

    await ctx.answerCbQuery('Prediction saved! 🎉');
    await ctx.editMessageText(
      `🏅 TOP 4 PREDICTION\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✅ SAVED SUCCESSFULLY!\n\n` +
        `YOUR PREDICTION\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🥇 1st: ${formatTeamWithFlag(first)}\n` +
        `🥈 2nd: ${formatTeamWithFlag(second)}\n` +
        `🥉 3rd: ${formatTeamWithFlag(third)}\n` +
        `4️⃣  4th: ${formatTeamWithFlag(fourth)}\n\n` +
        `💰 7 bonus points per correct position\n` +
        `🎯 Maximum: 28 points\n\n` +
        `💡 You can modify until the first match starts\n` +
        `━━━━━━━━━━━━━━━━━━━━`
    );

    logger.info('Tournament prediction saved', { userId: session.userId });
    clearTpSession(ctx.from.id);
  } catch (error) {
    logger.error('Error confirming tournament prediction', { error });
    await ctx.answerCbQuery('Error saving prediction. Please try again.');
  }
}

export async function handleTournamentPredictionStart(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const session = getTpSession(ctx.from.id);
    if (!session) {
      await ctx.answerCbQuery('Session expired. Please start again.');
      return;
    }

    // Reset session
    session.first = undefined;
    session.second = undefined;
    session.third = undefined;
    session.fourth = undefined;
    session.timestamp = Date.now();

    const teams = await tournamentPredictionService.getAvailableTeams();

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `🏅 TOP 4 PREDICTION\n` + `━━━━━━━━━━━━━━━━━━━━\n\n` + `Select the 1st place team:`,
      { reply_markup: createTeamSelectionKeyboard(teams, 'first') }
    );
  } catch (error) {
    logger.error('Error restarting tournament prediction', { error });
    await ctx.answerCbQuery('Error restarting. Please try again.');
  }
}

export async function handleTournamentPredictionCancel(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    clearTpSession(ctx.from.id);

    await ctx.answerCbQuery('Prediction cancelled');
    await ctx.editMessageText(
      `🏅 TOP 4 PREDICTION\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `❌ Cancelled\n\n` +
        `Tap 🏅 Top 4 Prediction to try again.\n` +
        `━━━━━━━━━━━━━━━━━━━━`
    );
  } catch (error) {
    logger.error('Error cancelling tournament prediction', { error });
    await ctx.answerCbQuery('Error cancelling');
  }
}

export async function handleTournamentPredictionModify(ctx: Context): Promise<void> {
  try {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    if (!ctx.from) return;

    const callbackData = ctx.callbackQuery.data;
    const telegramId = ctx.from.id.toString();
    const user = await userService.getUserByTelegramId(telegramId);

    if (!user) {
      await ctx.answerCbQuery('User not found');
      return;
    }

    // Check if modifications are still allowed
    const canPlace = await tournamentPredictionService.canPlacePrediction();
    if (!canPlace.allowed) {
      await ctx.answerCbQuery(`${canPlace.reason}`);
      await ctx.editMessageText(
        `🏅 TOP 4 PREDICTION\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `❌ ${canPlace.reason}\n\n` +
          `Predictions are now locked.\n` +
          `━━━━━━━━━━━━━━━━━━━━`
      );
      return;
    }

    // Get existing prediction
    const existing = await tournamentPredictionService.getUserPrediction(user.id);
    if (!existing) {
      await ctx.answerCbQuery('No existing prediction found');
      return;
    }

    const teams = await tournamentPredictionService.getAvailableTeams();

    // Check if modifying all or single position
    if (callbackData === 'tp_modify_all') {
      // Start full modification flow
      tpSessions.set(ctx.from.id, {
        userId: user.id,
        timestamp: Date.now(),
      });

      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `🏅 TOP 4 PREDICTION\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `Modify your prediction\n\n` +
          `Select the 1st place team:`,
        { reply_markup: createTeamSelectionKeyboard(teams, 'first') }
      );
    } else {
      // Single position modification
      const positionMap: Record<string, 'first' | 'second' | 'third' | 'fourth'> = {
        tp_modify_first: 'first',
        tp_modify_second: 'second',
        tp_modify_third: 'third',
        tp_modify_fourth: 'fourth',
      };

      const position = positionMap[callbackData];
      if (!position) {
        await ctx.answerCbQuery('Invalid action');
        return;
      }

      // Create session with existing predictions and mark which position we're modifying
      const session: TournamentPredictionSession = {
        userId: user.id,
        timestamp: Date.now(),
        first: existing.first_place,
        second: existing.second_place,
        third: existing.third_place,
        fourth: existing.fourth_place,
        modifyingSinglePosition: position,
      };

      tpSessions.set(ctx.from.id, session);

      const positionLabels = {
        first: '1st',
        second: '2nd',
        third: '3rd',
        fourth: '4th',
      };

      const positionEmojis = {
        first: '🥇',
        second: '🥈',
        third: '🥉',
        fourth: '4️⃣',
      };

      // Get teams to exclude (all other positions)
      const excludeTeams: string[] = [];
      if (position !== 'first') excludeTeams.push(existing.first_place);
      if (position !== 'second') excludeTeams.push(existing.second_place);
      if (position !== 'third') excludeTeams.push(existing.third_place);
      if (position !== 'fourth') excludeTeams.push(existing.fourth_place);

      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `🏅 TOP 4 PREDICTION\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `Modify ${positionLabels[position]} place ${positionEmojis[position]}\n\n` +
          `Current: ${formatTeamWithFlag(session[position]!)}\n\n` +
          `Select new team:`,
        { reply_markup: createTeamSelectionKeyboard(teams, position, excludeTeams) }
      );
    }

    logger.debug('Tournament prediction modification started', {
      userId: user.id,
      mode: callbackData,
    });
  } catch (error) {
    logger.error('Error handling tournament prediction modify', { error });
    await ctx.answerCbQuery('Error starting modification. Please try again.');
  }
}

export async function handleTournamentPredictionClose(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    clearTpSession(ctx.from.id);

    await ctx.answerCbQuery('Closed');
    await ctx.editMessageText(
      `🏅 TOP 4 PREDICTION\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✅ Closed\n\n` +
        `Tap 🏅 Top 4 Prediction anytime to:\n` +
        `   • View your prediction\n` +
        `   • Modify it (before first match)\n` +
        `━━━━━━━━━━━━━━━━━━━━`
    );
  } catch (error) {
    logger.error('Error closing tournament prediction', { error });
    await ctx.answerCbQuery('Error closing');
  }
}
