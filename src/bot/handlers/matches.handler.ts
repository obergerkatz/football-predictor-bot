import { Context } from 'telegraf';
import { matchService } from '../../services';
import { createMatchListKeyboard } from '../keyboards';
import { logger } from '../../utils/logger';
import { ERROR_MESSAGES } from '../../constants';

export async function handleNext48HourMatches(ctx: Context): Promise<void> {
  try {
    const matches = await matchService.getNext48HourMatches();

    if (matches.length === 0) {
      await ctx.reply(
        `⏰ No Matches in the Next 48 Hours\n\n` +
          `There are no matches starting in the next 48 hours.\n\n` +
          `💡 Use 📅 Upcoming Matches to see all future matches!`
      );
      return;
    }

    const keyboard = createMatchListKeyboard(matches);

    const message =
      `⏰ NEXT 48H MATCHES\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `⚽ ${matches.length} match${matches.length > 1 ? 'es' : ''} today and in the next 48 hours\n\n` +
      `🎯 Tap any scheduled match below to:\n` +
      `   • Place a new bet\n` +
      `   • Modify an existing bet\n\n` +
      `⏰ Remember: You can only bet before kickoff!\n` +
      `━━━━━━━━━━━━━━━━━━━━`;

    await ctx.reply(message, {
      reply_markup: keyboard,
    });

    logger.debug('Displayed next 48h matches list', {
      userId: ctx.from?.id,
      matchCount: matches.length,
    });
  } catch (error) {
    logger.error('Error handling next 48h matches', { error });
    await ctx.reply(
      ERROR_MESSAGES.GENERIC_ERROR +
        `We couldn't load the matches right now.\n` +
        `Please try tapping the ⏰ Next 48H Matches button again.`
    );
  }
}

export async function handleMatches(ctx: Context): Promise<void> {
  try {
    const matches = await matchService.getUpcomingMatches();

    if (matches.length === 0) {
      await ctx.reply(
        `📅 No Upcoming Matches\n\n` +
          `There are no matches available for betting right now.\n\n` +
          `💡 Check back soon or use the ✅ Completed Matches button to see recent results!`
      );
      return;
    }

    const keyboard = createMatchListKeyboard(matches);

    const message =
      `📅 UPCOMING MATCHES\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `⚽ ${matches.length} match${matches.length > 1 ? 'es' : ''} available for betting\n\n` +
      `🎯 Tap any match below to:\n` +
      `   • Place a new bet\n` +
      `   • Modify an existing bet\n\n` +
      `⏰ Remember: You can only bet before kickoff!\n` +
      `━━━━━━━━━━━━━━━━━━━━`;

    await ctx.reply(message, {
      reply_markup: keyboard,
    });

    logger.debug('Displayed upcoming matches list', {
      userId: ctx.from?.id,
      matchCount: matches.length,
    });
  } catch (error) {
    logger.error('Error handling /matches', { error });
    await ctx.reply(
      ERROR_MESSAGES.GENERIC_ERROR +
        `We couldn't load the matches right now.\n` +
        `Please try tapping the 📅 Upcoming Matches button again.`
    );
  }
}
