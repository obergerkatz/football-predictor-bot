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
    let message = `🏆 LEADERBOARD — Top ${leaderboard.length} Players\n\n`;

    // Determine padding widths for alignment
    const maxRankLen = String(leaderboard[leaderboard.length - 1].rank).length;
    const maxNameLen = Math.max(
      ...leaderboard.map((e) => (e.username ? `@${e.username}` : e.first_name).length)
    );
    const maxPtsLen = Math.max(...leaderboard.map((e) => String(e.total_points).length));

    // Build entries in monospace block
    let table = '';
    for (const entry of leaderboard) {
      const medal =
        entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '  ';
      const rank = `#${String(entry.rank).padEnd(maxRankLen)}`;
      const name = (entry.username ? `@${entry.username}` : entry.first_name).padEnd(maxNameLen);
      const pts = `${String(entry.total_points).padStart(maxPtsLen)}pts`;
      const breakdown = `6:${entry.exact_scores} 4:${entry.goal_diffs} 3:${entry.three_pt_scores} 1:${entry.one_pt_scores}`;
      const bonus = entry.bonus_points > 0 ? ` +${entry.bonus_points}🏅` : '';

      table += `${medal} ${rank}  ${name} - ${pts} | ${breakdown}${bonus}\n`;
    }

    message += `\`\`\`\n${table}\`\`\``;

    await ctx.reply(message, { parse_mode: 'MarkdownV2' });

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
