import { NotificationService } from '../../src/services/notification.service';
import { notificationRepository } from '../../src/db/repositories';
import { NotificationType } from '../../src/types';
import { Telegraf } from 'telegraf';

// Mock dependencies
jest.mock('../../src/db/repositories', () => ({
  notificationRepository: {
    hasBeenSent: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockBot: any;

  beforeEach(() => {
    // Create mock bot with telegram.sendMessage
    mockBot = {
      telegram: {
        sendMessage: jest.fn().mockResolvedValue({}),
      },
    };

    notificationService = new NotificationService(mockBot as Telegraf);
    jest.clearAllMocks();
  });

  describe('sendPreMatchNoBetNotification', () => {
    it('should send notification when not already sent', async () => {
      const userId = 1;
      const telegramId = '123456789';
      const matchId = 100;
      const homeTeam = 'Manchester United';
      const awayTeam = 'Liverpool';
      const matchDate = new Date(Date.now() + 65 * 60 * 1000); // 65 minutes from now

      (notificationRepository.hasBeenSent as jest.Mock).mockResolvedValue(false);

      await notificationService.sendPreMatchNoBetNotification(
        userId,
        telegramId,
        matchId,
        homeTeam,
        awayTeam,
        matchDate
      );

      expect(notificationRepository.hasBeenSent).toHaveBeenCalledWith(
        userId,
        matchId,
        NotificationType.PRE_MATCH_NO_BET
      );
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        telegramId,
        expect.stringContaining('Reminder: Match starting'),
        { parse_mode: 'HTML' }
      );
      expect(notificationRepository.create).toHaveBeenCalledWith(
        userId,
        matchId,
        NotificationType.PRE_MATCH_NO_BET,
        expect.any(String)
      );
    });

    it('should not send notification if already sent', async () => {
      const userId = 1;
      const telegramId = '123456789';
      const matchId = 100;
      const matchDate = new Date(Date.now() + 65 * 60 * 1000);

      (notificationRepository.hasBeenSent as jest.Mock).mockResolvedValue(true);

      await notificationService.sendPreMatchNoBetNotification(
        userId,
        telegramId,
        matchId,
        'Team A',
        'Team B',
        matchDate
      );

      expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();
      expect(notificationRepository.create).not.toHaveBeenCalled();
    });

    it('should include team names in message', async () => {
      const homeTeam = 'Barcelona';
      const awayTeam = 'Real Madrid';
      const matchDate = new Date(Date.now() + 70 * 60 * 1000);

      (notificationRepository.hasBeenSent as jest.Mock).mockResolvedValue(false);

      await notificationService.sendPreMatchNoBetNotification(
        1,
        '123',
        100,
        homeTeam,
        awayTeam,
        matchDate
      );

      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        '123',
        expect.stringContaining(homeTeam),
        expect.any(Object)
      );
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        '123',
        expect.stringContaining(awayTeam),
        expect.any(Object)
      );
    });

    it('should handle Telegram API errors gracefully', async () => {
      (notificationRepository.hasBeenSent as jest.Mock).mockResolvedValue(false);
      mockBot.telegram.sendMessage.mockRejectedValue(new Error('Telegram API error'));

      // Should not throw
      await expect(
        notificationService.sendPreMatchNoBetNotification(
          1,
          '123',
          100,
          'Team A',
          'Team B',
          new Date()
        )
      ).resolves.not.toThrow();

      expect(notificationRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('sendPostMatchPointsNotification', () => {
    it('should send notification with correct points', async () => {
      const userId = 1;
      const telegramId = '123456789';
      const matchId = 100;
      const homeTeam = 'Arsenal';
      const awayTeam = 'Chelsea';
      const homeScore = 2;
      const awayScore = 1;
      const pointsEarned = 6;
      const predictedHomeScore = 2;
      const predictedAwayScore = 1;

      (notificationRepository.hasBeenSent as jest.Mock).mockResolvedValue(false);

      await notificationService.sendPostMatchPointsNotification(
        userId,
        telegramId,
        matchId,
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        pointsEarned,
        predictedHomeScore,
        predictedAwayScore
      );

      expect(notificationRepository.hasBeenSent).toHaveBeenCalledWith(
        userId,
        matchId,
        NotificationType.POST_MATCH_POINTS
      );
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        telegramId,
        expect.stringContaining('Match Result'),
        { parse_mode: 'HTML' }
      );
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        telegramId,
        expect.stringContaining('6'),
        expect.any(Object)
      );
      expect(notificationRepository.create).toHaveBeenCalled();
    });

    it('should not send notification if already sent', async () => {
      (notificationRepository.hasBeenSent as jest.Mock).mockResolvedValue(true);

      await notificationService.sendPostMatchPointsNotification(
        1,
        '123',
        100,
        'Team A',
        'Team B',
        2,
        1,
        6,
        2,
        1
      );

      expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();
      expect(notificationRepository.create).not.toHaveBeenCalled();
    });

    it('should show correct emoji for 6 points', async () => {
      (notificationRepository.hasBeenSent as jest.Mock).mockResolvedValue(false);

      await notificationService.sendPostMatchPointsNotification(
        1,
        '123',
        100,
        'Team A',
        'Team B',
        2,
        1,
        6,
        2,
        1
      );

      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        '123',
        expect.stringContaining('🎉'),
        expect.any(Object)
      );
    });

    it('should show correct emoji for 4 points', async () => {
      (notificationRepository.hasBeenSent as jest.Mock).mockResolvedValue(false);

      await notificationService.sendPostMatchPointsNotification(
        1,
        '123',
        100,
        'Team A',
        'Team B',
        2,
        1,
        4,
        3,
        2
      );

      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        '123',
        expect.stringContaining('👏'),
        expect.any(Object)
      );
    });

    it('should show correct emoji for 0 points', async () => {
      (notificationRepository.hasBeenSent as jest.Mock).mockResolvedValue(false);

      await notificationService.sendPostMatchPointsNotification(
        1,
        '123',
        100,
        'Team A',
        'Team B',
        2,
        1,
        0,
        0,
        3
      );

      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        '123',
        expect.stringContaining('😔'),
        expect.any(Object)
      );
    });

    it('should include actual and predicted scores in message', async () => {
      (notificationRepository.hasBeenSent as jest.Mock).mockResolvedValue(false);

      await notificationService.sendPostMatchPointsNotification(
        1,
        '123',
        100,
        'Team A',
        'Team B',
        3,
        2,
        4,
        4,
        3
      );

      const sentMessage = mockBot.telegram.sendMessage.mock.calls[0][1];
      expect(sentMessage).toContain('3');
      expect(sentMessage).toContain('2');
      expect(sentMessage).toContain('4');
    });

    it('should handle Telegram API errors gracefully', async () => {
      (notificationRepository.hasBeenSent as jest.Mock).mockResolvedValue(false);
      mockBot.telegram.sendMessage.mockRejectedValue(new Error('Telegram API error'));

      await expect(
        notificationService.sendPostMatchPointsNotification(1, '123', 100, 'A', 'B', 2, 1, 6, 2, 1)
      ).resolves.not.toThrow();

      expect(notificationRepository.create).not.toHaveBeenCalled();
    });
  });
});
