import { Context } from 'telegraf';
import {
  betService,
  userService,
  tournamentPredictionService,
  groupStagePredictionService,
} from '../../services';
import { logger } from '../../utils/logger';
import { MatchStatus } from '../../types';
import { formatTeamWithFlag } from '../../utils/flags';
import { ERROR_MESSAGES } from '../../constants';
import { formatDateTimeShort, formatDateWithYear } from '../../utils/date.utils';

export async function handleMyBets(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const telegramId = ctx.from.id.toString();
    const user = await userService.getUserByTelegramId(telegramId);

    if (!user) {
      await ctx.reply(ERROR_MESSAGES.USER_NOT_FOUND);
      return;
    }

    const bets = await betService.getUserBets(user.id);

    if (bets.length === 0) {
      await ctx.reply(
        `🎲 MY BETS\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `No bets yet!\n\n` +
          `Ready to get started?\n` +
          `   • Tap 📅 Upcoming Matches\n` +
          `   • Choose a match\n` +
          `   • Make your prediction\n\n` +
          `Your bets will appear here! 🎯\n` +
          `━━━━━━━━━━━━━━━━━━━━`
      );
      return;
    }

    // Separate pending and completed bets
    const pendingBets = bets
      .filter((b) => b.match.status === MatchStatus.SCHEDULED)
      .sort(
        (a, b) => new Date(a.match.match_date).getTime() - new Date(b.match.match_date).getTime()
      ); // Soonest first

    const completedBets = bets
      .filter((b) => b.match.status === MatchStatus.FINISHED && b.score)
      .sort(
        (a, b) => new Date(b.match.match_date).getTime() - new Date(a.match.match_date).getTime()
      ); // Most recent first

    const liveBets = bets
      .filter((b) => b.match.status === MatchStatus.LIVE)
      .sort(
        (a, b) => new Date(a.match.match_date).getTime() - new Date(b.match.match_date).getTime()
      ); // Earliest start first

    let message = `🎲 MY BETS\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Show tournament prediction first
    const tournamentPrediction = await tournamentPredictionService.getUserPrediction(user.id);
    if (tournamentPrediction) {
      message += `🏅 TOP 4 PREDICTION\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      message += `🥇 1st: ${formatTeamWithFlag(tournamentPrediction.first_place)}\n`;
      message += `🥈 2nd: ${formatTeamWithFlag(tournamentPrediction.second_place)}\n`;
      message += `🥉 3rd: ${formatTeamWithFlag(tournamentPrediction.third_place)}\n`;
      message += `4️⃣  4th: ${formatTeamWithFlag(tournamentPrediction.fourth_place)}\n`;
      if (tournamentPrediction.is_scored) {
        message += `✅ Earned: ${tournamentPrediction.bonus_points}/28 bonus pts\n`;
      } else {
        message += `⏳ Pending (7pts each)\n`;
      }
      message += '\n';
    } else {
      const canPlace = await tournamentPredictionService.canPlacePrediction();
      if (canPlace.allowed) {
        message += `💡 TIP\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `Don't miss out on bonus points!\n`;
        message += `Tap 🏅 Top 4 Prediction to predict\n`;
        message += `the tournament winners (7pts each)\n\n`;
      }
    }

    // Show group stage prediction
    const groupStagePrediction = await groupStagePredictionService.getUserPrediction(user.id);
    if (groupStagePrediction) {
      message += `⚽ GROUP STAGE PREDICTION\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;

      const getGroupEmoji = (group: string): string => {
        const emojis: Record<string, string> = {
          A: '🅰️',
          B: '🅱️',
          C: '🅲',
          D: '🅳',
          E: '🅴',
          F: '🅵',
          G: '🅶',
          H: '🅷',
          I: '🅸',
          J: '🅹',
          K: '🅺',
          L: '🅻',
        };
        return emojis[group] || group;
      };

      const sortedGroups = Object.keys(groupStagePrediction.predictions).sort();
      for (const group of sortedGroups) {
        const teams = groupStagePrediction.predictions[group];
        if (teams && teams.length >= 2) {
          const emoji = getGroupEmoji(group);
          message += `${emoji} Group ${group}: ${formatTeamWithFlag(teams[0])}, ${formatTeamWithFlag(teams[1])}\n`;
        }
      }

      const maxPoints = sortedGroups.length * 4;
      if (groupStagePrediction.is_scored) {
        message += `✅ Earned: ${groupStagePrediction.bonus_points}/${maxPoints} bonus pts\n`;
      } else {
        message += `⏳ Pending (2pts each)\n`;
      }
      message += '\n';
    } else {
      const canPlace = await groupStagePredictionService.canPlacePrediction();
      if (canPlace.allowed) {
        message += `💡 TIP\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `Predict group stage qualifiers!\n`;
        message += `Tap ⚽ Group Stage Prediction to predict\n`;
        message += `which teams advance (2pts each)\n\n`;
      }
    }

    message += `⚽ MATCH BETS\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Pending bets
    if (pendingBets.length > 0) {
      message += `⏳ UPCOMING (${pendingBets.length})\n\n`;
      for (const bet of pendingBets) {
        const matchDate = formatDateTimeShort(new Date(bet.match.match_date));
        message += `⚽ ${formatTeamWithFlag(bet.match.home_team)} vs ${formatTeamWithFlag(bet.match.away_team)}\n`;
        message += `   🎯 Your bet: ${bet.predicted_home_score}-${bet.predicted_away_score}\n`;
        message += `   📅 ${matchDate}\n\n`;
      }
    }

    // Live bets
    if (liveBets.length > 0) {
      message += `🔴 LIVE NOW (${liveBets.length})\n\n`;
      for (const bet of liveBets) {
        const currentScore =
          bet.match.home_score !== null ? `${bet.match.home_score}-${bet.match.away_score}` : 'N/A';
        message += `⚽ ${formatTeamWithFlag(bet.match.home_team)} vs ${formatTeamWithFlag(bet.match.away_team)}\n`;
        message += `   🎯 Your bet: ${bet.predicted_home_score}-${bet.predicted_away_score}\n`;
        message += `   📊 Live score: ${currentScore}\n\n`;
      }
    }

    // Completed bets
    if (completedBets.length > 0) {
      message += `✅ FINISHED (${completedBets.length})\n\n`;
      for (const bet of completedBets) {
        const matchDate = formatDateWithYear(new Date(bet.match.match_date));
        message += `⚽ ${formatTeamWithFlag(bet.match.home_team)} vs ${formatTeamWithFlag(bet.match.away_team)}\n`;
        message += `   📊 Result: ${bet.match.home_score}-${bet.match.away_score}\n`;
        message += `   🎯 Your bet: ${bet.predicted_home_score}-${bet.predicted_away_score}\n`;
        message += `   🏆 Points: ${bet.score?.points_awarded || 0}\n`;
        message += `   📅 ${matchDate}\n\n`;
      }
    }

    message += `📈 Total: ${bets.length} bet${bets.length > 1 ? 's' : ''}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━`;

    // Split message if too long
    if (message.length > 4000) {
      const messages = splitLongMessage(message);
      for (const msg of messages) {
        await ctx.reply(msg);
      }
    } else {
      await ctx.reply(message);
    }

    logger.debug('Displayed user bets', { userId: user.id, betCount: bets.length });
  } catch (error) {
    logger.error('Error handling /mybets', { error });
    await ctx.reply(
      `❌ Oops! Something went wrong.\n\n` +
        `We couldn't load your bets right now.\n` +
        `Please try tapping the 🎲 My Bets button again.`
    );
  }
}

function splitLongMessage(message: string, maxLength: number = 4000): string[] {
  const messages: string[] = [];
  let currentMessage = '';

  const lines = message.split('\n');

  for (const line of lines) {
    if (currentMessage.length + line.length + 1 > maxLength) {
      messages.push(currentMessage);
      currentMessage = line + '\n';
    } else {
      currentMessage += line + '\n';
    }
  }

  if (currentMessage) {
    messages.push(currentMessage);
  }

  return messages;
}
