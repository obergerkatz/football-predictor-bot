import { Context } from 'telegraf';
import { matchService, betService, userService } from '../../services';
import { createMatchListKeyboard } from '../keyboards';
import { logger } from '../../utils/logger';
import { MatchStatus } from '../../types';
import { formatTeamWithFlag } from '../../utils/flags';
import { InlineKeyboardMarkup } from 'telegraf/types';
import { ERROR_MESSAGES, MATCH_STATUS_DISPLAY } from '../../constants';
import { formatTime24Hour } from '../../utils/date.utils';

export async function handleNext48HourMatches(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const matches = await matchService.getNext48HourMatches();

    if (matches.length === 0) {
      await ctx.reply(
        `⏰ No Matches in the Next 48 Hours\n\n` +
          `There are no matches in the next 48 hours.\n\n` +
          `💡 Use 📅 Upcoming Matches to see all future matches!`
      );
      return;
    }

    const telegramId = ctx.from.id.toString();
    const user = await userService.getUserByTelegramId(telegramId);

    let message =
      `⏰ NEXT 48H MATCHES\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📅 ${matches.length} match${matches.length > 1 ? 'es' : ''}\n\n`;

    const bettableMatches = [];

    for (const match of matches) {
      const matchTime = formatTime24Hour(new Date(match.match_date));

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

      if (match.status === MatchStatus.FINISHED || match.status === MatchStatus.LIVE) {
        if (match.home_score !== null && match.away_score !== null) {
          message += ` • Score: ${match.home_score}-${match.away_score}`;
        }
      }

      message += '\n';

      if (user) {
        const existingBet = await betService.getUserBetForMatchWithScore(user.id, match.id);
        const isBettable =
          match.status === MatchStatus.SCHEDULED && new Date(match.match_date) > new Date();

        if (existingBet) {
          message += `   🎲 Your bet: ${existingBet.predicted_home_score}-${existingBet.predicted_away_score}`;
          if (existingBet.score) {
            message += ` • ${existingBet.score.points_awarded}pts`;
          }
          message += '\n';
          if (isBettable) bettableMatches.push(match);
        } else if (isBettable) {
          message += `   ⚠️ No bet placed yet\n`;
          bettableMatches.push(match);
        }
      }

      message += '\n';
    }

    message += `━━━━━━━━━━━━━━━━━━━━`;

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

    logger.debug('Displayed next 48h matches', {
      userId: ctx.from.id,
      matchCount: matches.length,
      bettableCount: bettableMatches.length,
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
