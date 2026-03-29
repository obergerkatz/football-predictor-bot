import { PreMatchNotificationJob } from '../../src/jobs/pre-match-notification.job';
import { matchRepository, betRepository } from '../../src/db/repositories';
import { db } from '../../src/db/database';
import { NotificationService } from '../../src/services/notification.service';
import { MatchStatus } from '../../src/types';
import { NOTIFICATION_WINDOW } from '../../src/constants';

// Mock dependencies
jest.mock('../../src/db/repositories', () => ({
  matchRepository: {
    findUpcoming: jest.fn(),
  },
  betRepository: {
    findByUserAndMatch: jest.fn(),
  },
}));

jest.mock('../../src/db/database', () => ({
  db: {
    query: jest.fn(),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('PreMatchNotificationJob', () => {
  let preMatchNotificationJob: PreMatchNotificationJob;
  let mockNotificationService: jest.Mocked<NotificationService>;

  beforeEach(() => {
    mockNotificationService = {
      sendPreMatchNoBetNotification: jest.fn().mockResolvedValue(undefined),
    } as any;

    preMatchNotificationJob = new PreMatchNotificationJob(mockNotificationService);
    jest.clearAllMocks();
  });

  describe('run', () => {
    it('should send notifications to users without bets for matches in window', async () => {
      const now = new Date();
      // Match time = 1.5 hours from now (within 1-2 hour window)
      const matchInWindow = new Date(
        now.getTime() +
          NOTIFICATION_WINDOW.PRE_MATCH_MIN +
          (NOTIFICATION_WINDOW.PRE_MATCH_MAX - NOTIFICATION_WINDOW.PRE_MATCH_MIN) / 2
      );

      const mockMatch = {
        id: 100,
        home_team: 'Team A',
        away_team: 'Team B',
        match_date: matchInWindow,
        status: MatchStatus.SCHEDULED,
      };

      const mockUsers = [
        { id: 1, telegram_id: '123', username: 'user1', first_name: 'User 1' },
        { id: 2, telegram_id: '456', username: 'user2', first_name: 'User 2' },
      ];

      (matchRepository.findUpcoming as jest.Mock).mockResolvedValue([mockMatch]);
      (db.query as jest.Mock).mockResolvedValue({ rows: mockUsers });
      (betRepository.findByUserAndMatch as jest.Mock)
        .mockResolvedValueOnce(null) // User 1 has no bet
        .mockResolvedValueOnce({ id: 1 }); // User 2 has a bet

      await preMatchNotificationJob.run();

      // Should only send notification to user 1 (no bet)
      expect(mockNotificationService.sendPreMatchNoBetNotification).toHaveBeenCalledTimes(1);
      expect(mockNotificationService.sendPreMatchNoBetNotification).toHaveBeenCalledWith(
        1,
        '123',
        100,
        'Team A',
        'Team B',
        matchInWindow
      );
    });

    it('should not send notifications for matches outside the 1-2 hour window', async () => {
      const now = new Date();
      const tooSoon = new Date(now.getTime() + NOTIFICATION_WINDOW.PRE_MATCH_MIN / 2); // Half of min window
      const tooLate = new Date(now.getTime() + NOTIFICATION_WINDOW.PRE_MATCH_MAX + 30 * 60 * 1000); // 30 min after max window

      const mockMatches = [
        {
          id: 100,
          home_team: 'Team A',
          away_team: 'Team B',
          match_date: tooSoon,
          status: MatchStatus.SCHEDULED,
        },
        {
          id: 101,
          home_team: 'Team C',
          away_team: 'Team D',
          match_date: tooLate,
          status: MatchStatus.SCHEDULED,
        },
      ];

      (matchRepository.findUpcoming as jest.Mock).mockResolvedValue(mockMatches);
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      await preMatchNotificationJob.run();

      expect(mockNotificationService.sendPreMatchNoBetNotification).not.toHaveBeenCalled();
    });

    it('should not send notifications to users who already have bets', async () => {
      const now = new Date();
      const matchInWindow = new Date(
        now.getTime() +
          NOTIFICATION_WINDOW.PRE_MATCH_MIN +
          (NOTIFICATION_WINDOW.PRE_MATCH_MAX - NOTIFICATION_WINDOW.PRE_MATCH_MIN) / 2
      );

      const mockMatch = {
        id: 100,
        home_team: 'Team A',
        away_team: 'Team B',
        match_date: matchInWindow,
        status: MatchStatus.SCHEDULED,
      };

      const mockUsers = [{ id: 1, telegram_id: '123', username: 'user1', first_name: 'User 1' }];

      (matchRepository.findUpcoming as jest.Mock).mockResolvedValue([mockMatch]);
      (db.query as jest.Mock).mockResolvedValue({ rows: mockUsers });
      (betRepository.findByUserAndMatch as jest.Mock).mockResolvedValue({ id: 1 });

      await preMatchNotificationJob.run();

      expect(mockNotificationService.sendPreMatchNoBetNotification).not.toHaveBeenCalled();
    });

    it('should handle multiple matches and users', async () => {
      const now = new Date();
      const match1 = new Date(now.getTime() + NOTIFICATION_WINDOW.PRE_MATCH_MIN + 10 * 60 * 1000);
      const match2 = new Date(now.getTime() + NOTIFICATION_WINDOW.PRE_MATCH_MAX - 10 * 60 * 1000);

      const mockMatches = [
        {
          id: 100,
          home_team: 'Team A',
          away_team: 'Team B',
          match_date: match1,
          status: MatchStatus.SCHEDULED,
        },
        {
          id: 101,
          home_team: 'Team C',
          away_team: 'Team D',
          match_date: match2,
          status: MatchStatus.SCHEDULED,
        },
      ];

      const mockUsers = [
        { id: 1, telegram_id: '123', username: 'user1', first_name: 'User 1' },
        { id: 2, telegram_id: '456', username: 'user2', first_name: 'User 2' },
      ];

      (matchRepository.findUpcoming as jest.Mock).mockResolvedValue(mockMatches);
      (db.query as jest.Mock).mockResolvedValue({ rows: mockUsers });
      (betRepository.findByUserAndMatch as jest.Mock).mockResolvedValue(null);

      await preMatchNotificationJob.run();

      // 2 matches × 2 users = 4 notifications
      expect(mockNotificationService.sendPreMatchNoBetNotification).toHaveBeenCalledTimes(4);
    });

    it('should continue processing other matches if one match fails', async () => {
      const now = new Date();
      const match1 = new Date(now.getTime() + NOTIFICATION_WINDOW.PRE_MATCH_MIN + 10 * 60 * 1000);
      const match2 = new Date(
        now.getTime() +
          NOTIFICATION_WINDOW.PRE_MATCH_MIN +
          (NOTIFICATION_WINDOW.PRE_MATCH_MAX - NOTIFICATION_WINDOW.PRE_MATCH_MIN) / 2
      );

      const mockMatches = [
        {
          id: 100,
          home_team: 'Team A',
          away_team: 'Team B',
          match_date: match1,
          status: MatchStatus.SCHEDULED,
        },
        {
          id: 101,
          home_team: 'Team C',
          away_team: 'Team D',
          match_date: match2,
          status: MatchStatus.SCHEDULED,
        },
      ];

      const mockUsers = [{ id: 1, telegram_id: '123', username: 'user1', first_name: 'User 1' }];

      (matchRepository.findUpcoming as jest.Mock).mockResolvedValue(mockMatches);
      (db.query as jest.Mock).mockResolvedValue({ rows: mockUsers });
      (betRepository.findByUserAndMatch as jest.Mock).mockResolvedValue(null);

      // First match notification fails, second match should still be processed
      mockNotificationService.sendPreMatchNoBetNotification
        .mockRejectedValueOnce(new Error('Notification failed for match 1'))
        .mockResolvedValueOnce(undefined);

      await preMatchNotificationJob.run();

      // Both matches should attempt to send notifications
      expect(mockNotificationService.sendPreMatchNoBetNotification).toHaveBeenCalledTimes(2);
    });

    it('should handle empty user list', async () => {
      const now = new Date();
      const matchInWindow = new Date(
        now.getTime() +
          NOTIFICATION_WINDOW.PRE_MATCH_MIN +
          (NOTIFICATION_WINDOW.PRE_MATCH_MAX - NOTIFICATION_WINDOW.PRE_MATCH_MIN) / 2
      );

      const mockMatch = {
        id: 100,
        home_team: 'Team A',
        away_team: 'Team B',
        match_date: matchInWindow,
        status: MatchStatus.SCHEDULED,
      };

      (matchRepository.findUpcoming as jest.Mock).mockResolvedValue([mockMatch]);
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      await preMatchNotificationJob.run();

      expect(mockNotificationService.sendPreMatchNoBetNotification).not.toHaveBeenCalled();
    });

    it('should handle empty match list', async () => {
      (matchRepository.findUpcoming as jest.Mock).mockResolvedValue([]);

      await preMatchNotificationJob.run();

      expect(db.query).not.toHaveBeenCalled();
      expect(mockNotificationService.sendPreMatchNoBetNotification).not.toHaveBeenCalled();
    });
  });
});
