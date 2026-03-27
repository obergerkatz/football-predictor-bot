import { Context } from 'telegraf';
import { fixtureSyncJob } from '../../jobs/fixture-sync.job';
import { matchUpdateJob } from '../../jobs/match-update.job';
import { scoringJob } from '../../jobs/scoring.job';
import { config } from '../../utils/config';
import { logger } from '../../utils/logger';

function isAdmin(telegramId: string): boolean {
  return config.admin.telegramIds.includes(telegramId);
}

export async function handleAdminFetchNewFixtures(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const telegramId = ctx.from.id.toString();

    if (!isAdmin(telegramId)) {
      await ctx.reply('You are not authorized to use this command.');
      return;
    }

    await ctx.reply('🔄 Fetching new fixtures from API...');

    await fixtureSyncJob.run();

    await ctx.reply('✅ New fixtures fetched and synced successfully!');

    logger.info('Admin triggered fetch new fixtures', { telegramId });
  } catch (error) {
    logger.error('Error in admin fetch new fixtures', { error });
    await ctx.reply('❌ Fetch new fixtures failed. Check logs for details.');
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
