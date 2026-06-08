import { Context } from 'telegraf';
import { topGoalscorerPredictionService, userService } from '../../services';
import { logger } from '../../utils/logger';
import { createGoalscorerConfirmKeyboard, createExistingGoalscorerKeyboard } from '../keyboards';
import { SESSION_TIMEOUT, ERROR_MESSAGES } from '../../constants';

// In-memory session store — tracks users waiting to type a player name
interface GoalscorerSession {
  userId: number;
  timestamp: number;
  isModifying: boolean;
}

const gsessions = new Map<number, GoalscorerSession>();
const GS_SESSION_TIMEOUT = SESSION_TIMEOUT.TOURNAMENT_PREDICTION;

export function getGoalscorerSession(userId: number): GoalscorerSession | null {
  const session = gsessions.get(userId);
  if (!session) return null;

  if (Date.now() - session.timestamp > GS_SESSION_TIMEOUT) {
    gsessions.delete(userId);
    return null;
  }

  return session;
}

export function clearGoalscorerSession(userId: number): void {
  gsessions.delete(userId);
}

export async function handleTopGoalscorerPrediction(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const telegramId = ctx.from.id.toString();
    const user = await userService.getUserByTelegramId(telegramId);

    if (!user) {
      await ctx.reply(ERROR_MESSAGES.USER_NOT_FOUND);
      return;
    }

    const canPlace = await topGoalscorerPredictionService.canPlacePrediction();
    if (!canPlace.allowed) {
      await ctx.reply(
        `🥅 TOP GOALSCORER PREDICTION\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `❌ ${canPlace.reason}\n\n` +
          `Predictions must be placed before\n` +
          `the first match starts.\n` +
          `━━━━━━━━━━━━━━━━━━━━`
      );
      return;
    }

    const existing = await topGoalscorerPredictionService.getUserPrediction(user.id);

    if (existing) {
      let message = `🥅 TOP GOALSCORER PREDICTION\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      message += `YOUR PREDICTION\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      message += `⚽ ${existing.predicted_player}\n\n`;

      if (existing.is_scored) {
        message += `✅ FINAL SCORE\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `${existing.bonus_points}/7 bonus points earned! 🎉\n`;
      } else {
        message += `⏳ PENDING\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `7 points if correct\n\n`;
        message += `💡 You can modify until the first match starts\n`;
      }

      message += `━━━━━━━━━━━━━━━━━━━━`;

      await ctx.reply(message, {
        reply_markup: createExistingGoalscorerKeyboard(existing.is_scored),
      });
      return;
    }

    // Start new prediction — ask user to type a name
    gsessions.set(ctx.from.id, {
      userId: user.id,
      timestamp: Date.now(),
      isModifying: false,
    });

    await ctx.reply(
      `🥅 TOP GOALSCORER PREDICTION\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Predict who will score the most goals!\n\n` +
        `📊 SCORING\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `   • 7 pts if correct\n\n` +
        `Type the player's name:`
    );

    logger.debug('Top goalscorer prediction started', { userId: user.id });
  } catch (error) {
    logger.error('Error handling top goalscorer prediction', { error });
    await ctx.reply(
      `❌ Oops! Something went wrong.\n\n` +
        `Please try tapping the 🥅 Top Goalscorer Prediction button again.`
    );
  }
}

export async function handleGoalscorerTextInput(ctx: Context): Promise<void> {
  try {
    if (!ctx.from || !ctx.message || !('text' in ctx.message)) return;

    const userId = ctx.from.id;
    const session = gsessions.get(userId);
    if (!session) return;

    session.timestamp = Date.now();
    const input = ctx.message.text.trim();

    // Try to find the player
    const matchedPlayer = await topGoalscorerPredictionService.findPlayer(input);

    if (matchedPlayer) {
      await ctx.reply(
        `🥅 TOP GOALSCORER PREDICTION\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `Found: ⚽ ${matchedPlayer}\n\n` +
          `Confirm your prediction?`,
        { reply_markup: createGoalscorerConfirmKeyboard(matchedPlayer) }
      );
    } else {
      const suggestions = await topGoalscorerPredictionService.getSuggestions(input);
      let message = `❌ Player "${input}" not found.\n\n`;

      if (suggestions.length > 0) {
        message += `Did you mean:\n`;
        suggestions.forEach((s) => (message += `   • ${s}\n`));
        message += `\nTry typing the name again:`;
      } else {
        message += `No players found matching that name.\nTry typing the name again:`;
      }

      await ctx.reply(message);
    }
  } catch (error) {
    logger.error('Error handling goalscorer text input', { error });
  }
}

export async function handleGoalscorerConfirm(ctx: Context): Promise<void> {
  try {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    if (!ctx.from) return;

    const playerName = ctx.callbackQuery.data.replace('gs_confirm_', '');
    const userId = ctx.from.id;

    const session = gsessions.get(userId);
    if (!session) {
      await ctx.answerCbQuery('Session expired. Please start again.');
      return;
    }

    const result = await topGoalscorerPredictionService.placePrediction(session.userId, playerName);

    if (!result.success) {
      await ctx.answerCbQuery(`Error: ${result.error}`);
      clearGoalscorerSession(userId);
      return;
    }

    clearGoalscorerSession(userId);
    await ctx.answerCbQuery('Prediction saved! 🎉');
    await ctx.editMessageText(
      `🥅 TOP GOALSCORER PREDICTION\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✅ SAVED SUCCESSFULLY!\n\n` +
        `YOUR PREDICTION\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚽ ${playerName}\n\n` +
        `💰 7 bonus points if correct\n\n` +
        `💡 You can modify until the first match starts\n` +
        `━━━━━━━━━━━━━━━━━━━━`
    );

    logger.info('Top goalscorer prediction saved', { userId: session.userId, playerName });
  } catch (error) {
    logger.error('Error confirming goalscorer prediction', { error });
    await ctx.answerCbQuery('Error saving prediction. Please try again.');
  }
}

export async function handleGoalscorerCancel(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    clearGoalscorerSession(ctx.from.id);

    await ctx.answerCbQuery('Cancelled');
    await ctx.editMessageText(
      `🥅 TOP GOALSCORER PREDICTION\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `❌ Cancelled\n\n` +
        `Tap 🥅 Top Goalscorer Prediction to try again.\n` +
        `━━━━━━━━━━━━━━━━━━━━`
    );
  } catch (error) {
    logger.error('Error cancelling goalscorer prediction', { error });
    await ctx.answerCbQuery('Error cancelling');
  }
}

export async function handleGoalscorerModify(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const telegramId = ctx.from.id.toString();
    const user = await userService.getUserByTelegramId(telegramId);
    if (!user) {
      await ctx.answerCbQuery('User not found');
      return;
    }

    const canPlace = await topGoalscorerPredictionService.canPlacePrediction();
    if (!canPlace.allowed) {
      await ctx.answerCbQuery(canPlace.reason);
      return;
    }

    gsessions.set(ctx.from.id, {
      userId: user.id,
      timestamp: Date.now(),
      isModifying: true,
    });

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `🥅 TOP GOALSCORER PREDICTION\n` + `━━━━━━━━━━━━━━━━━━━━\n\n` + `Type the new player name:`
    );
  } catch (error) {
    logger.error('Error modifying goalscorer prediction', { error });
    await ctx.answerCbQuery('Error starting modification. Please try again.');
  }
}

export async function handleGoalscorerClose(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    clearGoalscorerSession(ctx.from.id);

    await ctx.answerCbQuery('Closed');
    await ctx.editMessageText(
      `🥅 TOP GOALSCORER PREDICTION\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✅ Closed\n\n` +
        `Tap 🥅 Top Goalscorer Prediction anytime to:\n` +
        `   • View your prediction\n` +
        `   • Modify it (before first match)\n` +
        `━━━━━━━━━━━━━━━━━━━━`
    );
  } catch (error) {
    logger.error('Error closing goalscorer prediction', { error });
    await ctx.answerCbQuery('Error closing');
  }
}
