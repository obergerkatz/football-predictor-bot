import { Context } from 'telegraf';
import { matchService, betService, userService } from '../../services';
import { logger } from '../../utils/logger';
import { MatchStatus } from '../../types';
import { createCompletedMatchListKeyboard } from '../keyboards';
import { formatTeamWithFlag } from '../../utils/flags';
import { ERROR_MESSAGES, CALLBACK_PREFIX } from '../../constants';
import { formatDateTimeShort } from '../../utils/date.utils';

export async function handleResults(ctx: Context): Promise<void> {
  try {
    const matches = await matchService.getFinishedAndLiveMatches();

    if (matches.length === 0) {
      await ctx.reply(
        `✅ COMPLETED MATCHES\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `No results yet!\n\n` +
          `Once matches are played, you'll see:\n` +
          `   • Final scores\n` +
          `   • All user predictions\n` +
          `   • Points earned\n\n` +
          `Tap 📅 Upcoming Matches to place your bets!\n` +
          `━━━━━━━━━━━━━━━━━━━━`
      );
      return;
    }

    const keyboard = createCompletedMatchListKeyboard(matches);

    const message =
      `✅ COMPLETED MATCHES\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🔍 ${matches.length} match${matches.length > 1 ? 'es' : ''} with results\n\n` +
      `Tap any match to see:\n` +
      `   • Final score\n` +
      `   • Everyone's predictions\n` +
      `   • Points earned\n\n` +
      `━━━━━━━━━━━━━━━━━━━━`;

    await ctx.reply(message, {
      reply_markup: keyboard,
    });

    logger.debug('Displayed completed matches', {
      userId: ctx.from?.id,
      matchCount: matches.length,
    });
  } catch (error) {
    logger.error('Error handling /results', { error });
    await ctx.reply(
      ERROR_MESSAGES.GENERIC_ERROR +
        `We couldn't load completed matches right now.\n` +
        `Please try tapping the ✅ Completed Matches button again.`
    );
  }
}

export async function handleResultDetails(ctx: Context): Promise<void> {
  try {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    const callbackData = ctx.callbackQuery.data;
    const matchId = parseInt(callbackData.replace(`${CALLBACK_PREFIX.RESULT}_`, ''), 10);

    if (isNaN(matchId)) {
      await ctx.answerCbQuery('Invalid match');
      return;
    }

    // Get match details
    const match = await matchService.getMatchWithLeagueById(matchId);

    if (!match) {
      await ctx.answerCbQuery('Match not found');
      return;
    }

    // Get all bets for this match
    const bets = await betService.getMatchBets(matchId);

    if (bets.length === 0) {
      await ctx.answerCbQuery();
      await ctx.reply(
        `📊 MATCH RESULTS\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `No predictions for this match.\n\n` +
          `Be more active next time! 🎯\n` +
          `━━━━━━━━━━━━━━━━━━━━`
      );
      return;
    }

    // Fetch users and scores for each bet
    interface BetWithUserAndScore {
      username: string | null;
      firstName: string;
      prediction: string;
      points: number | null;
      isExact: boolean;
      userId: number;
    }

    const betDetails: BetWithUserAndScore[] = [];

    for (const bet of bets) {
      const userResult = await userService.getUserById(bet.user_id);
      if (!userResult) continue;

      // Fetch score with score_type if match is finished
      let points: number | null = null;
      let isExact = false;
      if (match.status === MatchStatus.FINISHED) {
        const score = await betService.getBetScore(bet.id);
        if (score) {
          points = score.points_awarded;
        }
        // Check for exact score
        isExact =
          bet.predicted_home_score === match.home_score &&
          bet.predicted_away_score === match.away_score;
      }

      betDetails.push({
        username: userResult.username,
        firstName: userResult.first_name,
        prediction: `${bet.predicted_home_score}-${bet.predicted_away_score}`,
        points,
        isExact,
        userId: bet.user_id,
      });
    }

    // Sort by points (highest first), then by user ID for consistent ordering
    betDetails.sort((a, b) => {
      const aPoints = a.points ?? -1;
      const bPoints = b.points ?? -1;
      if (bPoints !== aPoints) return bPoints - aPoints;
      return a.userId - b.userId;
    });

    const matchDate = formatDateTimeShort(new Date(match.match_date));

    let message = `📊 MATCH RESULTS\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `${formatTeamWithFlag(match.home_team)} vs ${formatTeamWithFlag(match.away_team)}\n`;
    message += `🏆 ${match.league.name}\n`;
    message += `📅 ${matchDate}\n\n`;

    if (match.status === MatchStatus.FINISHED && match.home_score !== null) {
      message += `⚽ FINAL SCORE\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      message += `${match.home_score} - ${match.away_score}`;

      if (
        match.home_score_ft !== null &&
        match.away_score_ft !== null &&
        (match.home_score_ft !== match.home_score || match.away_score_ft !== match.away_score)
      ) {
        message += ` (FT: ${match.home_score_ft}-${match.away_score_ft})`;
      }
      message += `\n\n`;
    } else if (match.status === MatchStatus.LIVE && match.home_score !== null) {
      message += `🔴 LIVE SCORE\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      message += `${match.home_score} - ${match.away_score}\n\n`;
    }

    message += `🎯 ALL PREDICTIONS\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;

    for (const bet of betDetails) {
      const userName = bet.username ? `@${bet.username}` : bet.firstName;
      message += `${userName}: ${bet.prediction}`;

      if (match.status === MatchStatus.FINISHED) {
        message += ` • ${bet.points} pts`;
      }

      message += `\n`;
    }

    message += `\n📈 Total: ${betDetails.length} prediction${betDetails.length > 1 ? 's' : ''}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━`;

    await ctx.answerCbQuery();
    await ctx.reply(message);

    logger.debug('Displayed match bet details', { matchId, betCount: betDetails.length });
  } catch (error) {
    logger.error('Error handling result details', { error });
    await ctx.answerCbQuery('Error loading results');
    await ctx.reply(
      `❌ Oops! Something went wrong.\n\n` +
        `We couldn't load the match results.\n` +
        `Please try selecting the match again.`
    );
  }
}
