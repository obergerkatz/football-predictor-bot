import { Context } from 'telegraf';
import { groupStagePredictionService, userService } from '../../services';
import { logger } from '../../utils/logger';
import {
  createGroupSelectionKeyboard,
  createGroupTeamSelectionKeyboard,
  createExistingGroupPredictionKeyboard,
} from '../keyboards';
import { formatTeamWithFlag } from '../../utils/flags';
import { SESSION_TIMEOUT, ERROR_MESSAGES } from '../../constants';

// Session store for group stage prediction flow
interface GroupStagePredictionSession {
  userId: number;
  timestamp: number;
  currentGroup?: string;
  predictions: Record<string, string[]>; // { "A": ["Team1", "Team2"], "B": [...], ... }
}

const gspSessions = new Map<number, GroupStagePredictionSession>();
const GSP_SESSION_TIMEOUT = SESSION_TIMEOUT.GROUP_STAGE_PREDICTION;

function getGspSession(userId: number): GroupStagePredictionSession | null {
  const session = gspSessions.get(userId);
  if (!session) return null;

  if (Date.now() - session.timestamp > GSP_SESSION_TIMEOUT) {
    gspSessions.delete(userId);
    return null;
  }

  return session;
}

function clearGspSession(userId: number): void {
  gspSessions.delete(userId);
}

function getGroupEmoji(group: string): string {
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
}

export async function handleGroupStagePrediction(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const telegramId = ctx.from.id.toString();
    const user = await userService.getUserByTelegramId(telegramId);

    if (!user) {
      await ctx.reply(ERROR_MESSAGES.USER_NOT_FOUND);
      return;
    }

    // Check if predictions are still allowed
    const canPlace = await groupStagePredictionService.canPlacePrediction();
    if (!canPlace.allowed) {
      await ctx.reply(
        `⚽ GROUP STAGE PREDICTION\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `❌ ${canPlace.reason}\n\n` +
          `Predictions must be placed before\n` +
          `the first match starts.\n` +
          `━━━━━━━━━━━━━━━━━━━━`
      );
      return;
    }

    // Check if user already has a prediction
    const existing = await groupStagePredictionService.getUserPrediction(user.id);

    if (existing) {
      let message = `⚽ GROUP STAGE PREDICTION\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      message += `YOUR PREDICTIONS\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;

      // Display all groups dynamically
      const sortedGroups = Object.keys(existing.predictions).sort();
      for (const group of sortedGroups) {
        const teams = existing.predictions[group];
        if (teams && teams.length >= 2) {
          const emoji = getGroupEmoji(group);
          message += `${emoji} Group ${group}:\n`;
          message += `   1️⃣ ${formatTeamWithFlag(teams[0])}\n`;
          message += `   2️⃣ ${formatTeamWithFlag(teams[1])}\n\n`;
        }
      }

      const maxPoints = sortedGroups.length * 4; // 2 teams per group, 2 points each
      if (existing.is_scored) {
        message += `✅ FINAL SCORE\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `${existing.bonus_points}/${maxPoints} bonus points earned! 🎉\n`;
      } else {
        message += `⏳ PENDING\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `2 points for each correct qualifier\n`;
        message += `Maximum: ${maxPoints} bonus points\n\n`;
        message += `💡 You can modify until the first match starts\n`;
      }

      message += `━━━━━━━━━━━━━━━━━━━━`;

      await ctx.reply(message, {
        reply_markup: createExistingGroupPredictionKeyboard(existing.is_scored),
      });
      return;
    }

    // Start new prediction flow
    // Get available groups to calculate max points
    const availableGroups = await groupStagePredictionService.getGroups();
    const allGroups = Object.keys(availableGroups).sort();
    const maxPoints = allGroups.length * 4;

    // Create session
    gspSessions.set(ctx.from.id, {
      userId: user.id,
      timestamp: Date.now(),
      predictions: {},
    });

    await ctx.reply(
      `⚽ GROUP STAGE PREDICTION\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Predict which teams will qualify!\n\n` +
        `📊 SCORING\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `   • 2 pts per correct qualifier\n` +
        `   • Maximum: ${maxPoints} bonus points\n\n` +
        `Select a group to predict:`,
      { reply_markup: createGroupSelectionKeyboard([], allGroups) }
    );

    logger.debug('Group stage prediction started', { userId: user.id });
  } catch (error) {
    logger.error('Error handling group stage prediction', { error });
    await ctx.reply(
      `❌ Oops! Something went wrong.\n\n` +
        `We couldn't load the prediction form.\n` +
        `Please try tapping the ⚽ Group Stage Prediction button again.`
    );
  }
}

export async function handleGroupSelection(ctx: Context): Promise<void> {
  try {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    if (!ctx.from) return;

    const callbackData = ctx.callbackQuery.data;
    // gsp_group_A
    const group = callbackData.split('_')[2];

    const session = getGspSession(ctx.from.id);
    if (!session) {
      await ctx.answerCbQuery('Session expired. Please start again.');
      return;
    }

    const groups = await groupStagePredictionService.getGroups();
    session.timestamp = Date.now();
    session.currentGroup = group;

    await ctx.answerCbQuery();

    const groupEmoji = getGroupEmoji(group);
    const groupTeams = groups[group] || [];

    await ctx.editMessageText(
      `⚽ GROUP STAGE PREDICTION\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${groupEmoji} GROUP ${group}\n\n` +
        `Select 1st qualifier:`,
      { reply_markup: createGroupTeamSelectionKeyboard(groupTeams, group, 'first', []) }
    );

    logger.debug('Group selected', { userId: session.userId, group });
  } catch (error) {
    logger.error('Error handling group selection', { error });
    await ctx.answerCbQuery('Error processing selection. Please try again.');
  }
}

export async function handleGroupTeamSelection(ctx: Context): Promise<void> {
  try {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    if (!ctx.from) return;

    const callbackData = ctx.callbackQuery.data;
    // gsp_select_A_first_TeamName or gsp_select_A_second_TeamName
    const parts = callbackData.split('_');
    const group = parts[2];
    const position = parts[3] as 'first' | 'second';
    const teamName = parts.slice(4).join('_');

    const session = getGspSession(ctx.from.id);
    if (!session) {
      await ctx.answerCbQuery('Session expired. Please start again.');
      return;
    }

    const groups = await groupStagePredictionService.getGroups();
    const allGroups = Object.keys(groups).sort();

    // Validate team is in correct group
    const groupTeams = groups[group] || [];
    if (!groupTeams.includes(teamName)) {
      await ctx.answerCbQuery('Invalid team for this group!');
      return;
    }

    session.timestamp = Date.now();

    // Initialize group array if needed
    if (!session.predictions[group]) {
      session.predictions[group] = [];
    }

    // Store the selection
    if (position === 'first') {
      session.predictions[group][0] = teamName;
    } else {
      session.predictions[group][1] = teamName;
    }

    await ctx.answerCbQuery();

    const groupEmoji = getGroupEmoji(group);

    // Determine next step
    if (position === 'first') {
      // Ask for second team
      const firstTeam = session.predictions[group][0];

      await ctx.editMessageText(
        `⚽ GROUP STAGE PREDICTION\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `${groupEmoji} GROUP ${group}\n` +
          `1️⃣ ${formatTeamWithFlag(firstTeam)}\n\n` +
          `Select 2nd qualifier:`,
        { reply_markup: createGroupTeamSelectionKeyboard(groupTeams, group, 'second', [firstTeam]) }
      );
    } else {
      // Second team selected, check completion
      const completedGroups = Object.keys(session.predictions)
        .filter((g) => session.predictions[g].length === 2)
        .sort();

      // Show progress with completed groups marked
      let message = `⚽ GROUP STAGE PREDICTION\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      message += `Progress: ${completedGroups.length}/${allGroups.length} groups\n\n`;

      for (const g of completedGroups) {
        const teams = session.predictions[g];
        const emoji = getGroupEmoji(g);
        message += `✅ ${emoji} Group ${g}: ${formatTeamWithFlag(teams[0])}, ${formatTeamWithFlag(teams[1])}\n`;
      }

      if (completedGroups.length < allGroups.length) {
        message += `\nSelect next group or confirm to save:`;
      } else {
        message += `\n💰 2 points per correct qualifier\n\n`;
        message += `All groups completed! Confirm to save:`;
      }

      await ctx.editMessageText(message, {
        reply_markup: createGroupSelectionKeyboard(completedGroups, allGroups),
      });
    }

    logger.debug('Group team selected', { userId: session.userId, group, position, teamName });
  } catch (error) {
    logger.error('Error handling group team selection', { error });
    await ctx.answerCbQuery('Error processing selection. Please try again.');
  }
}

export async function handleGroupPredictionConfirm(ctx: Context): Promise<void> {
  try {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    if (!ctx.from) return;

    const session = getGspSession(ctx.from.id);
    if (!session) {
      await ctx.answerCbQuery('Session expired. Please start again.');
      return;
    }

    // Place prediction
    const result = await groupStagePredictionService.placePrediction(
      session.userId,
      session.predictions
    );

    if (!result.success) {
      await ctx.answerCbQuery(`Error: ${result.error}`);
      await ctx.editMessageText(
        `❌ Oops! Something went wrong.\n\n` +
          `${result.error}\n\n` +
          `Please try tapping the ⚽ Group Stage Prediction button again.`
      );
      clearGspSession(ctx.from.id);
      return;
    }

    const completedGroups = Object.keys(session.predictions).sort();
    const maxPoints = completedGroups.length * 4;

    let message = `⚽ GROUP STAGE PREDICTION\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `✅ SAVED SUCCESSFULLY!\n\n`;
    message += `YOUR PREDICTIONS\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;

    for (const g of completedGroups) {
      const teams = session.predictions[g];
      const emoji = getGroupEmoji(g);
      message += `${emoji} Group ${g}: ${formatTeamWithFlag(teams[0])}, ${formatTeamWithFlag(teams[1])}\n`;
    }

    message += `\n💰 2 bonus points per correct qualifier\n`;
    message += `🎯 Maximum: ${maxPoints} points\n\n`;
    message += `💡 You can modify until the first match starts\n`;
    message += `━━━━━━━━━━━━━━━━━━━━`;

    await ctx.answerCbQuery('Predictions saved! 🎉');
    await ctx.editMessageText(message);

    logger.info('Group stage prediction saved', { userId: session.userId });
    clearGspSession(ctx.from.id);
  } catch (error) {
    logger.error('Error confirming group stage prediction', { error });
    await ctx.answerCbQuery('Error saving predictions. Please try again.');
  }
}

export async function handleGroupPredictionStart(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const session = getGspSession(ctx.from.id);
    if (!session) {
      await ctx.answerCbQuery('Session expired. Please start again.');
      return;
    }

    // Reset session
    session.predictions = {};
    session.timestamp = Date.now();

    const groups = await groupStagePredictionService.getGroups();
    const allGroups = Object.keys(groups).sort();

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `⚽ GROUP STAGE PREDICTION\n` + `━━━━━━━━━━━━━━━━━━━━\n\n` + `Select a group to predict:`,
      { reply_markup: createGroupSelectionKeyboard([], allGroups) }
    );
  } catch (error) {
    logger.error('Error restarting group stage prediction', { error });
    await ctx.answerCbQuery('Error restarting. Please try again.');
  }
}

export async function handleGroupPredictionCancel(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    clearGspSession(ctx.from.id);

    await ctx.answerCbQuery('Predictions cancelled');
    await ctx.editMessageText(
      `⚽ GROUP STAGE PREDICTION\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `❌ Cancelled\n\n` +
        `Tap ⚽ Group Stage Prediction to try again.\n` +
        `━━━━━━━━━━━━━━━━━━━━`
    );
  } catch (error) {
    logger.error('Error cancelling group stage prediction', { error });
    await ctx.answerCbQuery('Error cancelling');
  }
}

export async function handleGroupPredictionModify(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const telegramId = ctx.from.id.toString();
    const user = await userService.getUserByTelegramId(telegramId);

    if (!user) {
      await ctx.answerCbQuery('User not found');
      return;
    }

    // Check if modifications are still allowed
    const canPlace = await groupStagePredictionService.canPlacePrediction();
    if (!canPlace.allowed) {
      await ctx.answerCbQuery(`${canPlace.reason}`);
      await ctx.editMessageText(
        `⚽ GROUP STAGE PREDICTION\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `❌ ${canPlace.reason}\n\n` +
          `Predictions are now locked.\n` +
          `━━━━━━━━━━━━━━━━━━━━`
      );
      return;
    }

    // Get existing predictions
    const existing = await groupStagePredictionService.getUserPrediction(user.id);
    if (!existing) {
      await ctx.answerCbQuery('No existing predictions found');
      return;
    }

    // Start modification flow
    const groups = await groupStagePredictionService.getGroups();
    const allGroups = Object.keys(groups).sort();

    // Create session with existing predictions loaded
    gspSessions.set(ctx.from.id, {
      userId: user.id,
      timestamp: Date.now(),
      predictions: { ...existing.predictions }, // Clone existing predictions
    });

    // Get completed groups from existing predictions
    const completedGroups = Object.keys(existing.predictions)
      .filter((g) => existing.predictions[g] && existing.predictions[g].length === 2)
      .sort();

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `⚽ GROUP STAGE PREDICTION\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Modify your predictions\n\n` +
        `✅ = Already predicted\n` +
        `Select a group to modify:`,
      { reply_markup: createGroupSelectionKeyboard(completedGroups, allGroups) }
    );

    logger.debug('Group stage prediction modification started', { userId: user.id });
  } catch (error) {
    logger.error('Error handling group stage prediction modify', { error });
    await ctx.answerCbQuery('Error starting modification. Please try again.');
  }
}

export async function handleGroupPredictionClose(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    clearGspSession(ctx.from.id);

    await ctx.answerCbQuery('Closed');
    await ctx.editMessageText(
      `⚽ GROUP STAGE PREDICTION\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✅ Closed\n\n` +
        `Tap ⚽ Group Stage Prediction anytime to:\n` +
        `   • View your predictions\n` +
        `   • Modify them (before first match)\n` +
        `━━━━━━━━━━━━━━━━━━━━`
    );
  } catch (error) {
    logger.error('Error closing group stage prediction', { error });
    await ctx.answerCbQuery('Error closing');
  }
}

export async function handleGroupPredictionBack(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) return;

    const session = getGspSession(ctx.from.id);
    if (!session) {
      await ctx.answerCbQuery('Session expired. Please start again.');
      return;
    }

    // Check which groups are complete
    const completedGroups = Object.keys(session.predictions)
      .filter((g) => session.predictions[g].length === 2)
      .sort();

    const groups = await groupStagePredictionService.getGroups();
    const allGroups = Object.keys(groups).sort();

    await ctx.answerCbQuery();

    let message = `⚽ GROUP STAGE PREDICTION\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `Progress: ${completedGroups.length}/${allGroups.length} groups\n\n`;

    for (const g of completedGroups) {
      const teams = session.predictions[g];
      const emoji = getGroupEmoji(g);
      message += `✅ ${emoji} Group ${g}: ${formatTeamWithFlag(teams[0])}, ${formatTeamWithFlag(teams[1])}\n`;
    }

    message += `\nSelect ${completedGroups.length === 0 ? 'a' : 'next'} group to predict:`;

    await ctx.editMessageText(message, {
      reply_markup: createGroupSelectionKeyboard(completedGroups, allGroups),
    });
  } catch (error) {
    logger.error('Error handling back button', { error });
    await ctx.answerCbQuery('Error going back');
  }
}
