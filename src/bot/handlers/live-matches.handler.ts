import { Context } from 'telegraf';
import { matchService } from '../../services';
import { logger } from '../../utils/logger';
import { createCompletedMatchListKeyboard } from '../keyboards';
import { ERROR_MESSAGES } from '../../constants';

export async function handleLiveMatches(ctx: Context): Promise<void> {
  try {
    const matches = await matchService.getLiveMatches();

    if (matches.length === 0) {
      await ctx.reply(
        `🔴 LIVE MATCHES\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `No matches are live right now.\n\n` +
          `💡 Use ⏰ Next 48H Matches to see upcoming games.`
      );
      return;
    }

    const keyboard = createCompletedMatchListKeyboard(matches);

    const message =
      `🔴 LIVE MATCHES\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${matches.length} match${matches.length > 1 ? 'es' : ''} in progress\n\n` +
      `Tap any match to see:\n` +
      `   • Live score\n` +
      `   • Everyone's predictions\n\n` +
      `━━━━━━━━━━━━━━━━━━━━`;

    await ctx.reply(message, { reply_markup: keyboard });

    logger.debug('Displayed live matches', { matchCount: matches.length });
  } catch (error) {
    logger.error('Error handling live matches', { error });
    await ctx.reply(
      ERROR_MESSAGES.GENERIC_ERROR +
        `We couldn't load live matches right now.\n` +
        `Please try tapping the 🔴 Live Matches button again.`
    );
  }
}
