import { Context } from 'telegraf';
import { leaderboardService } from '../../services';
import { logger } from '../../utils/logger';
import { ERROR_MESSAGES } from '../../constants';

export async function handleLeaderboard(ctx: Context): Promise<void> {
  try {
    const leaderboard = await leaderboardService.getLeaderboard(15);

    if (leaderboard.length === 0) {
      await ctx.reply(
        `🏆 LEADERBOARD\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `No players yet!\n\n` +
          `Be the first to place a bet and claim the top spot! 🎯\n\n` +
          `Tap 📅 Upcoming Matches to get started.`
      );
      return;
    }

    // Build header
    let message = `🏆 LEADERBOARD\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `Top ${leaderboard.length} Players\n\n`;

    // Build entries
    for (const entry of leaderboard) {
      const medal =
        entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '  ';
      const name = entry.username ? `@${entry.username}` : entry.first_name;

      message += `${medal} #${entry.rank} ${name}\n`;
      message += `   📊 ${entry.total_points} pts • ${entry.total_bets} bets • 🎯 | 6:${entry.exact_scores} | 4:${entry.goal_diffs}`;

      if (entry.bonus_points > 0) {
        message += ` | 🏅 +${entry.bonus_points}`;
      }
      message += '\n\n';
    }

    message += `━━━━━━━━━━━━━━━━━━━━`;

    await ctx.reply(message);

    logger.debug('Displayed leaderboard', { entryCount: leaderboard.length });
  } catch (error) {
    logger.error('Error handling /leaderboard', { error });
    await ctx.reply(
      ERROR_MESSAGES.GENERIC_ERROR +
        `We couldn't load the leaderboard right now.\n` +
        `Please try tapping the 🏆 Leaderboard button again.`
    );
  }
}
