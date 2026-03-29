import { Context } from 'telegraf';
import { matchService, betService, userService } from '../../services';
import { logger } from '../../utils/logger';
import { MatchStatus } from '../../types';
import { formatTeamWithFlag } from '../../utils/flags';
import { InlineKeyboardMarkup } from 'telegraf/types';
import { ERROR_MESSAGES, MATCH_STATUS_DISPLAY } from '../../constants';
import { formatTime24Hour } from '../../utils/date.utils';

export async function handleTodayMatches(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const telegramId = ctx.from.id.toString();
    const user = await userService.getUserByTelegramId(telegramId);

    if (!user) {
      await ctx.reply(ERROR_MESSAGES.USER_NOT_FOUND);
      return;
    }

    const matches = await matchService.getTodayMatches();

    if (matches.length === 0) {
      await ctx.reply(
        `🗓️ No Matches Today\n\n` +
          `There are no matches scheduled for today.\n\n` +
          `💡 Use the 📅 Upcoming Matches button to see future matches!`
      );
      return;
    }

    // Build message with matches and user's bets
    let message =
      `🗓️ TODAY'S MATCHES\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📅 ${matches.length} match${matches.length > 1 ? 'es' : ''} today\n\n`;

    const bettableMatches = [];

    for (const match of matches) {
      const matchTime = formatTime24Hour(new Date(match.match_date));

      // Status emoji
      let statusEmoji = '';
      let statusText = '';
      if (match.status === MatchStatus.LIVE) {
        statusEmoji = '🔴';
        statusText = MATCH_STATUS_DISPLAY.LIVE;
      } else if (match.status === MatchStatus.FINISHED) {
        statusEmoji = '✅';
        statusText = 'FT';
      } else {
        statusEmoji = '⏰';
        statusText = matchTime;
      }

      message += `${statusEmoji} ${formatTeamWithFlag(match.home_team)} vs ${formatTeamWithFlag(match.away_team)}\n`;
      message += `   ${statusText}`;

      // Show score if match is live or finished
      if (match.status === MatchStatus.FINISHED || match.status === MatchStatus.LIVE) {
        if (match.home_score !== null && match.away_score !== null) {
          message += ` • Score: ${match.home_score}-${match.away_score}`;
        }
      }

      message += '\n';

      // Check if user has bet on this match
      const existingBet = await betService.getUserBetForMatchWithScore(user.id, match.id);
      if (existingBet) {
        message += `   🎲 Your bet: ${existingBet.predicted_home_score}-${existingBet.predicted_away_score}`;

        // Show points if match is scored
        if (existingBet.score) {
          message += ` • ${existingBet.score.points_awarded}pts`;
        }
        message += '\n';
      } else {
        // Can still bet if match hasn't started
        if (match.status === MatchStatus.SCHEDULED && new Date(match.match_date) > new Date()) {
          message += `   ⚠️ No bet placed yet\n`;
          bettableMatches.push(match);
        }
      }

      message += '\n';
    }

    message += `━━━━━━━━━━━━━━━━━━━━`;

    // Create inline keyboard for matches without bets
    let keyboard: InlineKeyboardMarkup | undefined;
    if (bettableMatches.length > 0) {
      message += `\n\n📌 Tap a match below to place your bet:`;

      const buttons = bettableMatches.map((match) => {
        const matchTime = new Date(match.match_date).toLocaleString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Asia/Jerusalem',
        });
        return [
          {
            text: `${formatTeamWithFlag(match.home_team)} vs ${formatTeamWithFlag(match.away_team)} - ${matchTime}`,
            callback_data: `bet_${match.id}`,
          },
        ];
      });

      keyboard = { inline_keyboard: buttons };
    }

    if (keyboard) {
      await ctx.reply(message, { reply_markup: keyboard });
    } else {
      await ctx.reply(message);
    }

    logger.debug('Displayed today matches', {
      userId: ctx.from.id,
      matchCount: matches.length,
      bettableCount: bettableMatches.length,
    });
  } catch (error) {
    logger.error('Error handling today matches', { error });
    await ctx.reply(
      ERROR_MESSAGES.GENERIC_ERROR +
        `We couldn't load today's matches.\n` +
        `Please try tapping the 🗓️ Today Matches button again.`
    );
  }
}
