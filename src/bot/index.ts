import { Telegraf } from 'telegraf';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { handleStart, handleHelp } from './handlers/start.handler';
import { handleTodayMatches } from './handlers/today-matches.handler';
import { handleMatches } from './handlers/matches.handler';
import {
  handleBetCallback,
  handleBetInput,
  handleScoreSelection,
  handleBetConfirmation,
  handleChangeScore,
  handleCancelBet,
  handleCustomScoreRequest,
  handleModifyBet,
} from './handlers/bet.handler';
import { handleMyBets } from './handlers/my-bets.handler';
import { handleMe } from './handlers/my-stats.handler';
import { handleLeaderboard } from './handlers/leaderboard.handler';
import { handleResults, handleResultDetails } from './handlers/results.handler';
import {
  handleTournamentPrediction,
  handleTeamSelection,
  handleTournamentPredictionConfirm,
  handleTournamentPredictionStart,
  handleTournamentPredictionCancel,
  handleTournamentPredictionModify,
  handleTournamentPredictionClose,
} from './handlers/tournament-prediction.handler';
import {
  handleGroupStagePrediction,
  handleGroupSelection,
  handleGroupTeamSelection,
  handleGroupPredictionConfirm,
  handleGroupPredictionStart,
  handleGroupPredictionCancel,
  handleGroupPredictionModify,
  handleGroupPredictionClose,
  handleGroupPredictionBack,
} from './handlers/group-stage-prediction.handler';
import {
  handleAdminFetchNewFixtures,
  handleAdminRefreshMatchesStatuses,
  handleAdminCalculateUserPoints,
} from './handlers/admin.handler';

export class TelegramBot {
  private bot: Telegraf;

  constructor() {
    this.bot = new Telegraf(config.telegram.botToken);
    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupHandlers(): void {
    // Command handlers
    this.bot.command('start', handleStart);
    this.bot.command('help', handleHelp);
    this.bot.command('today', handleTodayMatches);
    this.bot.command('matches', handleMatches);
    this.bot.command('mybets', handleMyBets);
    this.bot.command('me', handleMe);
    this.bot.command('leaderboard', handleLeaderboard);
    this.bot.command('results', handleResults);
    this.bot.command('tournament_prediction', handleTournamentPrediction);
    this.bot.command('group_stage', handleGroupStagePrediction);

    // Admin commands
    this.bot.command('admin_fetch_new_fixtures', handleAdminFetchNewFixtures);
    this.bot.command('admin_refresh_matches_statuses', handleAdminRefreshMatchesStatuses);
    this.bot.command('admin_calculate_user_points', handleAdminCalculateUserPoints);

    // Button text handlers (same as commands)
    this.bot.hears('🗓️ Today Matches', handleTodayMatches);
    this.bot.hears('📅 Upcoming Matches', handleMatches);
    this.bot.hears('📊 My Stats', handleMe);
    this.bot.hears('🏆 Leaderboard', handleLeaderboard);
    this.bot.hears('✅ Completed Matches', handleResults);
    this.bot.hears('🎲 My Bets', handleMyBets);
    this.bot.hears('🏅 Top 4 Prediction', handleTournamentPrediction);
    this.bot.hears('⚽ Group Stage Prediction', handleGroupStagePrediction);
    this.bot.hears('❓ Help', handleHelp);

    // Admin button handlers
    this.bot.hears('🤖 Fetch New Fixtures', handleAdminFetchNewFixtures);
    this.bot.hears('🤖 Refresh Match Statuses', handleAdminRefreshMatchesStatuses);
    this.bot.hears('🤖 Calculate User Points', handleAdminCalculateUserPoints);

    // Callback query handlers
    this.bot.action(/^bet_\d+$/, handleBetCallback);
    this.bot.action(/^bet_score_\d+_(home|away)_\d+$/, handleScoreSelection);
    this.bot.action(/^bet_custom_\d+_(home|away)$/, handleCustomScoreRequest);
    this.bot.action(/^bet_confirm_\d+_\d+_\d+$/, handleBetConfirmation);
    this.bot.action(/^bet_change_(home|away)_\d+_\d+$/, handleChangeScore);
    this.bot.action(/^bet_modify_\d+$/, handleModifyBet);
    this.bot.action('cancel_bet', handleCancelBet);
    this.bot.action(/^result_\d+$/, handleResultDetails);
    this.bot.action(/^tp_select_(first|second|third|fourth)_.+$/, handleTeamSelection);
    this.bot.action(/^tp_confirm_.+$/, handleTournamentPredictionConfirm);
    this.bot.action('tp_start', handleTournamentPredictionStart);
    this.bot.action('tp_cancel', handleTournamentPredictionCancel);
    this.bot.action('tp_modify_first', handleTournamentPredictionModify);
    this.bot.action('tp_modify_second', handleTournamentPredictionModify);
    this.bot.action('tp_modify_third', handleTournamentPredictionModify);
    this.bot.action('tp_modify_fourth', handleTournamentPredictionModify);
    this.bot.action('tp_modify_all', handleTournamentPredictionModify);
    this.bot.action('tp_close', handleTournamentPredictionClose);
    this.bot.action(/^gsp_group_[A-L]$/, handleGroupSelection);
    this.bot.action(/^gsp_select_[A-L]_(first|second)_.+$/, handleGroupTeamSelection);
    this.bot.action('gsp_confirm', handleGroupPredictionConfirm);
    this.bot.action('gsp_start', handleGroupPredictionStart);
    this.bot.action('gsp_back', handleGroupPredictionBack);
    this.bot.action('gsp_cancel', handleGroupPredictionCancel);
    this.bot.action('gsp_modify', handleGroupPredictionModify);
    this.bot.action('gsp_close', handleGroupPredictionClose);
    this.bot.action('cancel', async (ctx) => {
      await ctx.answerCbQuery('Cancelled');
      await ctx.reply('Action cancelled.');
    });
    this.bot.action('noop', async (ctx) => {
      await ctx.answerCbQuery();
    });

    // Text message handler (for bet input)
    this.bot.on('text', handleBetInput);

    logger.info('Bot handlers configured');
  }

  private setupErrorHandling(): void {
    this.bot.catch((err, ctx) => {
      logger.error('Bot error', {
        error: err,
        updateType: ctx.updateType,
        chatId: ctx.chat?.id,
      });
    });

    process.once('SIGINT', () => this.stop('SIGINT'));
    process.once('SIGTERM', () => this.stop('SIGTERM'));
  }

  async launch(): Promise<void> {
    try {
      await this.bot.launch();
      logger.info('Telegram bot launched successfully');
      logger.info(`Bot username: @${this.bot.botInfo?.username}`);
    } catch (error) {
      logger.error('Failed to launch bot', { error });
      throw error;
    }
  }

  async stop(signal?: string): Promise<void> {
    logger.info(`Stopping bot${signal ? ` (${signal})` : ''}`);
    await this.bot.stop(signal);
  }

  getBot(): Telegraf {
    return this.bot;
  }
}

export const telegramBot = new TelegramBot();
