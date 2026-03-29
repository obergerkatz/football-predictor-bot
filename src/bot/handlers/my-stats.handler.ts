import { Context } from 'telegraf';
import {
  userService,
  tournamentPredictionService,
  groupStagePredictionService,
} from '../../services';
import { logger } from '../../utils/logger';
import { formatTeamWithFlag } from '../../utils/flags';

export async function handleMe(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const telegramId = ctx.from.id.toString();
    const user = await userService.getUserByTelegramId(telegramId);

    if (!user) {
      await ctx.reply(`❌ User Not Found\n\n` + `Please tap the /start button to register first.`);
      return;
    }

    const stats = await userService.getUserStats(user.id);

    if (!stats) {
      await ctx.reply(
        `❌ Oops! Something went wrong.\n\n` +
          `We couldn't load your stats right now.\n` +
          `Please try tapping the 📊 My Stats button again.`
      );
      return;
    }

    // Build message with beautiful formatting
    let message = `👤 YOUR PROFILE\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Player info
    message += `👋 ${stats.user.first_name}${stats.user.username ? ` (@${stats.user.username})` : ''}\n`;
    message += `🏆 Rank #${stats.rank} of ${stats.total_users}\n\n`;

    // Main stats box
    message += `📊 OVERALL PERFORMANCE\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🎯 Total Points: ${stats.total_points}\n`;
    message += `📋 Total Bets: ${stats.total_bets}\n`;
    message += `   ✅ Finished: ${stats.scored_bets}\n`;
    message += `   ⏳ Upcoming: ${stats.pending_bets}\n\n`;

    // Point breakdown
    message += `🎯 MATCH PREDICTIONS\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🎯 6pts (Exact): ${stats.exact_scores}\n`;
    message += `🎯 4pts (Goal Diff): ${stats.goal_diffs}\n`;
    message += `🎯 3pts (Side+Result): ${stats.three_pt_scores}\n`;
    message += `🎯 1pt (Side Only): ${stats.one_pt_scores}\n`;
    message += `🎯 0pts (Wrong): ${stats.zero_scores}\n`;

    // Tournament prediction section
    const tournamentPrediction = await tournamentPredictionService.getUserPrediction(user.id);
    if (tournamentPrediction) {
      message += `\n🏅 TOP 4 PREDICTION\n`;
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
    } else {
      const canPlace = await tournamentPredictionService.canPlacePrediction();
      if (canPlace.allowed) {
        message += `\n💡 TIP\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `Don't miss out on bonus points!\n`;
        message += `Tap 🏅 Top 4 Prediction to predict\n`;
        message += `the tournament winners (7pts each)\n`;
      }
    }

    // Group stage prediction section
    const groupStagePrediction = await groupStagePredictionService.getUserPrediction(user.id);
    if (groupStagePrediction) {
      message += `\n⚽ GROUP STAGE PREDICTION\n`;
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
          message += `${emoji} ${group}: ${formatTeamWithFlag(teams[0])}, ${formatTeamWithFlag(teams[1])}\n`;
        }
      }

      const maxPoints = sortedGroups.length * 4;
      if (groupStagePrediction.is_scored) {
        message += `✅ Earned: ${groupStagePrediction.bonus_points}/${maxPoints} bonus pts\n`;
      } else {
        message += `⏳ Pending (2pts each)\n`;
      }
    } else {
      const canPlace = await groupStagePredictionService.canPlacePrediction();
      if (canPlace.allowed) {
        message += `\n💡 TIP\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `Predict group stage qualifiers!\n`;
        message += `Tap ⚽ Group Stage Prediction to predict\n`;
        message += `which teams advance (2pts each)\n`;
      }
    }

    message += `\n━━━━━━━━━━━━━━━━━━━━`;

    await ctx.reply(message);

    logger.debug('Displayed user stats', { userId: user.id });
  } catch (error) {
    logger.error('Error handling /me', { error });
    await ctx.reply(
      `❌ Oops! Something went wrong.\n\n` +
        `We couldn't load your stats right now.\n` +
        `Please try tapping the 📊 My Stats button again.`
    );
  }
}
