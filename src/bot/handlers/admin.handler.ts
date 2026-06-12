import { Context } from 'telegraf';
import { fixtureSyncJob } from '../../jobs/fixture-sync.job';
import { matchUpdateJob } from '../../jobs/match-update.job';
import { scoringJob } from '../../jobs/scoring.job';
import { config } from '../../utils/config';
import { logger } from '../../utils/logger';
import { telegramBot } from '../index';
import { createNotificationService } from '../../services/notification.service';
import { createPreMatchNotificationJob } from '../../jobs/pre-match-notification.job';
import { createPostMatchNotificationJob } from '../../jobs/post-match-notification.job';
import { tournamentPredictionRepository } from '../../db/repositories/tournament-prediction.repository';
import { groupStagePredictionRepository } from '../../db/repositories/group-stage-prediction.repository';
import { topGoalscorerPredictionRepository } from '../../db/repositories/top-goalscorer-prediction.repository';
import { userService } from '../../services';
import { formatTeamWithFlag } from '../../utils/flags';

function isAdmin(telegramId: string): boolean {
  return config.admin.telegramIds.includes(telegramId);
}

export async function handleAdminFetchNewMatches(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const telegramId = ctx.from.id.toString();

    if (!isAdmin(telegramId)) {
      await ctx.reply('You are not authorized to use this command.');
      return;
    }

    await ctx.reply('🔄 Fetching new matches from API...');

    await fixtureSyncJob.run();

    await ctx.reply('✅ New matches fetched and synced successfully!');

    logger.info('Admin triggered fetch new matches', { telegramId });
  } catch (error) {
    logger.error('Error in admin fetch new matches', { error });
    await ctx.reply('❌ Fetch new matches failed. Check logs for details.');
  }
}

export async function handleAdminRefreshMatchesStatuses(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const telegramId = ctx.from.id.toString();

    if (!isAdmin(telegramId)) {
      await ctx.reply('You are not authorized to use this command.');
      return;
    }

    await ctx.reply('🔄 Refreshing match statuses and scores...');

    await matchUpdateJob.run();

    await ctx.reply('✅ Match statuses refreshed successfully!');

    logger.info('Admin triggered refresh match statuses', { telegramId });
  } catch (error) {
    logger.error('Error in admin refresh match statuses', { error });
    await ctx.reply('❌ Refresh match statuses failed. Check logs for details.');
  }
}

export async function handleAdminCalculateUserPoints(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const telegramId = ctx.from.id.toString();

    if (!isAdmin(telegramId)) {
      await ctx.reply('You are not authorized to use this command.');
      return;
    }

    await ctx.reply('🔄 Calculating user points...');

    await scoringJob.run();

    await ctx.reply('✅ User points calculated successfully!');

    logger.info('Admin triggered calculate user points', { telegramId });
  } catch (error) {
    logger.error('Error in admin calculate user points', { error });
    await ctx.reply('❌ Calculate user points failed. Check logs for details.');
  }
}

export async function handleAdminSendPreMatchNotifications(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const telegramId = ctx.from.id.toString();

    if (!isAdmin(telegramId)) {
      await ctx.reply('You are not authorized to use this command.');
      return;
    }

    await ctx.reply('🔄 Sending pre-match notifications...');

    const bot = telegramBot.getBot();
    const notificationService = createNotificationService(bot);
    const preMatchNotificationJob = createPreMatchNotificationJob(notificationService);

    await preMatchNotificationJob.run();

    await ctx.reply('✅ Pre-match notifications sent successfully!');

    logger.info('Admin triggered pre-match notifications', { telegramId });
  } catch (error) {
    logger.error('Error in admin pre-match notifications', { error });
    await ctx.reply('❌ Pre-match notifications failed. Check logs for details.');
  }
}

export async function handleAdminSendPostMatchNotifications(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const telegramId = ctx.from.id.toString();

    if (!isAdmin(telegramId)) {
      await ctx.reply('You are not authorized to use this command.');
      return;
    }

    await ctx.reply('🔄 Sending post-match notifications...');

    const bot = telegramBot.getBot();
    const notificationService = createNotificationService(bot);
    const postMatchNotificationJob = createPostMatchNotificationJob(notificationService);

    await postMatchNotificationJob.run();

    await ctx.reply('✅ Post-match notifications sent successfully!');

    logger.info('Admin triggered post-match notifications', { telegramId });
  } catch (error) {
    logger.error('Error in admin post-match notifications', { error });
    await ctx.reply('❌ Post-match notifications failed. Check logs for details.');
  }
}

export async function handleAdminTop4Predictions(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    if (!(await hasTournamentStarted())) {
      await ctx.reply('⏳ Tournament has not started yet. Predictions are still open.');
      return;
    }

    const predictions = await tournamentPredictionRepository.getAll();

    if (predictions.length === 0) {
      await ctx.reply('🏅 TOP 4 PREDICTIONS\n━━━━━━━━━━━━━━━━━━━━\n\nNo predictions submitted yet.');
      return;
    }

    let message = `🏅 TOP 4 PREDICTIONS\n━━━━━━━━━━━━━━━━━━━━\n${predictions.length} predictions submitted\n\n`;

    for (const p of predictions) {
      const user = await userService.getUserById(p.user_id);
      if (!user) continue;
      const name = user.username ? `@${user.username}` : user.first_name;
      message += `${name}\n`;
      message += `  🥇 ${formatTeamWithFlag(p.first_place)}  🥈 ${formatTeamWithFlag(p.second_place)}  🥉 ${formatTeamWithFlag(p.third_place)}  4️⃣ ${formatTeamWithFlag(p.fourth_place)}\n\n`;
    }

    message += `━━━━━━━━━━━━━━━━━━━━`;
    await ctx.reply(message);
    logger.info('Admin viewed top 4 predictions', { telegramId: ctx.from.id.toString() });
  } catch (error) {
    logger.error('Error in admin top 4 predictions', { error });
    await ctx.reply('❌ Failed to load top 4 predictions. Check logs for details.');
  }
}

export async function handleAdminTopScorerPredictions(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    if (!(await hasTournamentStarted())) {
      await ctx.reply('⏳ Tournament has not started yet. Predictions are still open.');
      return;
    }

    const predictions = await topGoalscorerPredictionRepository.getAllByLeague(
      await getActiveLeagueId()
    );

    if (predictions.length === 0) {
      await ctx.reply('🥅 TOP GOALSCORER PREDICTIONS\n━━━━━━━━━━━━━━━━━━━━\n\nNo predictions submitted yet.');
      return;
    }

    let message = `🥅 TOP GOALSCORER PREDICTIONS\n━━━━━━━━━━━━━━━━━━━━\n${predictions.length} predictions submitted\n\n`;

    for (const p of predictions) {
      const user = await userService.getUserById(p.user_id);
      if (!user) continue;
      const name = user.username ? `@${user.username}` : user.first_name;
      message += `${name} — ${p.predicted_player}\n`;
    }

    message += `\n━━━━━━━━━━━━━━━━━━━━`;
    await ctx.reply(message);
    logger.info('Admin viewed top scorer predictions', { telegramId: ctx.from.id.toString() });
  } catch (error) {
    logger.error('Error in admin top scorer predictions', { error });
    await ctx.reply('❌ Failed to load top scorer predictions. Check logs for details.');
  }
}

export async function handleAdminGroupStagePredictions(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    if (!(await hasTournamentStarted())) {
      await ctx.reply('⏳ Tournament has not started yet. Predictions are still open.');
      return;
    }

    const predictions = await groupStagePredictionRepository.getAll();

    if (predictions.length === 0) {
      await ctx.reply('⚽ GROUP STAGE PREDICTIONS\n━━━━━━━━━━━━━━━━━━━━\n\nNo predictions submitted yet.');
      return;
    }

    let message = `⚽ GROUP STAGE PREDICTIONS\n━━━━━━━━━━━━━━━━━━━━\n${predictions.length} predictions submitted\n\n`;

    for (const p of predictions) {
      const user = await userService.getUserById(p.user_id);
      if (!user) continue;
      const name = user.username ? `@${user.username}` : user.first_name;
      message += `${name}\n`;
      for (const [group, teams] of Object.entries(p.predictions as Record<string, string[]>)) {
        message += `  ${group}: ${(teams as string[]).join(', ')}\n`;
      }
      message += '\n';
    }

    message += `━━━━━━━━━━━━━━━━━━━━`;
    await ctx.reply(message);
    logger.info('Admin viewed group stage predictions', { telegramId: ctx.from.id.toString() });
  } catch (error) {
    logger.error('Error in admin group stage predictions', { error });
    await ctx.reply('❌ Failed to load group stage predictions. Check logs for details.');
  }
}

async function getActiveLeagueId(): Promise<number> {
  const { leagueRepository } = await import('../../db/repositories');
  const activeLeagues = await leagueRepository.findActiveByConfiguredLeagues();
  if (activeLeagues.length === 0) throw new Error('No active league found');
  return activeLeagues[0].id;
}

async function hasTournamentStarted(): Promise<boolean> {
  const { matchRepository } = await import('../../db/repositories');
  const firstMatch = await matchRepository.getFirstMatch();
  if (!firstMatch) return false;
  return new Date() >= new Date(firstMatch.match_date);
}
