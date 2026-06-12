import { Context } from 'telegraf';
import { matchService } from '../../services';
import { logger } from '../../utils/logger';
import { formatTeamWithFlag } from '../../utils/flags';
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

    let message =
      `🔴 LIVE MATCHES\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${matches.length} match${matches.length > 1 ? 'es' : ''} in progress\n\n`;

    for (const match of matches) {
      message += `🔴 ${formatTeamWithFlag(match.home_team)} vs ${formatTeamWithFlag(match.away_team)}\n`;

      if (match.home_score !== null && match.away_score !== null) {
        message += `   Score: ${match.home_score} - ${match.away_score}\n`;
      }

      message += '\n';
    }

    message += `━━━━━━━━━━━━━━━━━━━━`;

    await ctx.reply(message);

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
