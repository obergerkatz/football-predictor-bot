import { Context } from 'telegraf';
import { userService } from '../../services';
import { logger } from '../../utils/logger';
import { config } from '../../utils/config';
import { createMainMenuKeyboard } from '../keyboards';
import { ERROR_MESSAGES } from '../../constants';

export async function handleStart(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const telegramId = ctx.from.id.toString();
    const username = ctx.from.username || null;
    const firstName = ctx.from.first_name || 'User';
    const isAdmin = config.admin.telegramIds.includes(telegramId);

    // Create or update user
    await userService.getOrCreateUser(telegramId, username, firstName);

    const welcomeMessage =
      `⚽ FOOTBALL PREDICTOR\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Welcome ${firstName}! 👋\n\n` +
      `Predict match scores and compete\n` +
      `with friends on the leaderboard!\n\n` +
      `🎯 QUICK START\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `1. Tap 📅 Upcoming Matches\n` +
      `2. Select a match\n` +
      `3. Predict the score\n` +
      `4. Earn points when you're right!\n\n` +
      `📊 SCORING\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `6pts • Exact score\n` +
      `4pts • Correct goal difference\n` +
      `3pts • One side + result\n` +
      `1pt  • One side only\n\n` +
      `🏅 Don't forget to predict\n` +
      `   group qualifiers and top 4\n` +
      `   for bonus points!\n\n` +
      `⚠️ Bet only BEFORE kickoff!\n\n` +
      `Good luck! 🍀\n` +
      `━━━━━━━━━━━━━━━━━━━━`;

    await ctx.reply(welcomeMessage, createMainMenuKeyboard(isAdmin));

    logger.info('User started bot', { telegramId, username });
  } catch (error) {
    logger.error('Error handling /start', { error });
    await ctx.reply(
      ERROR_MESSAGES.GENERIC_ERROR +
        `We couldn't start the bot.\n` +
        `Please try tapping /start again.`
    );
  }
}

export async function handleHelp(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const telegramId = ctx.from.id.toString();
    const isAdmin = config.admin.telegramIds.includes(telegramId);

    let helpMessage =
      `❓ HELP\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🎮 HOW TO PLAY\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `1. Tap 📅 Upcoming Matches\n` +
      `2. Choose a match\n` +
      `3. Select your predicted score\n` +
      `4. Confirm your bet\n\n` +
      `🎯 SCORING SYSTEM\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `6pts • Exact score (e.g., 2-1)\n` +
      `4pts • Correct goal difference\n` +
      `3pts • One side + result correct\n` +
      `1pt  • One side only correct\n` +
      `0pts • Wrong prediction\n\n` +
      `🏅 BONUS POINTS\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `1️⃣ Group Stage Prediction\n` +
      `   2pts per correct qualifier\n` +
      `   Max: 48 bonus points (12 groups)\n` +
      `   Tap ⚽ Group Stage Prediction\n\n` +
      `2️⃣ Top 4 Prediction\n` +
      `   7pts per correct position\n` +
      `   Max: 28 bonus points\n` +
      `   Tap 🏅 Top 4 Prediction\n\n` +
      `📱 MENU BUTTONS\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🗓️ Today Matches\n` +
      `   Quick view of today's games & bets\n\n` +
      `📅 Upcoming Matches\n` +
      `   View and bet on upcoming games\n\n` +
      `✅ Completed Matches\n` +
      `   Results and everyone's bets\n\n` +
      `🎲 My Bets\n` +
      `   See all your predictions\n\n` +
      `📊 My Stats\n` +
      `   Your points, rank & performance\n\n` +
      `🏆 Leaderboard\n` +
      `   Top players rankings\n\n` +
      `⚽ Group Stage Prediction\n` +
      `   Predict group qualifiers\n\n` +
      `🏅 Top 4 Prediction\n` +
      `   Tournament winner prediction\n\n`;

    if (isAdmin) {
      helpMessage +=
        `🤖 ADMIN TOOLS\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🤖 Fetch New Matches\n` +
        `   Fetch and sync new matches from API\n\n` +
        `🤖 Refresh Match Statuses\n` +
        `   Update live match statuses and scores\n\n` +
        `🤖 Calculate User Points\n` +
        `   Calculate points for finished matches\n\n` +
        `🤖 Send Pre-Match Notifications\n` +
        `   Send reminders for upcoming matches\n\n` +
        `🤖 Send Post-Match Notifications\n` +
        `   Send points earned for finished matches\n\n`;
    }

    helpMessage +=
      `⚠️ IMPORTANT RULES\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `• Bet only BEFORE kickoff\n` +
      `• One bet per match\n` +
      `• Scoring based on 90min result\n` +
      `  (no extra time or penalties)\n\n` +
      `Good luck! 🍀\n` +
      `━━━━━━━━━━━━━━━━━━━━`;

    await ctx.reply(helpMessage, createMainMenuKeyboard(isAdmin));
  } catch (error) {
    logger.error('Error handling /help', { error });
    await ctx.reply(
      `❌ Oops! Something went wrong.\n\n` +
        `We couldn't load the help information.\n` +
        `Please try tapping the ❓ Help button again.`
    );
  }
}
