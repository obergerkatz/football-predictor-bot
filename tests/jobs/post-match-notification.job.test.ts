import { PostMatchNotificationJob } from '../../src/jobs/post-match-notification.job';
import { matchRepository, betRepository, scoreRepository } from '../../src/db/repositories';
import { db } from '../../src/db/database';
import { NotificationService } from '../../src/services/notification.service';
import { MatchStatus, ScoreType } from '../../src/types';
import { SCORING_POINTS } from '../../src/constants';

// Mock dependencies
jest.mock('../../src/db/repositories', () => ({
  matchRepository: {
    findRecentFinished: jest.fn(),
  },
  betRepository: {
    findByMatch: jest.fn(),
  },
  scoreRepository: {
    findByBetId: jest.fn(),
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
    warn: jest.fn(),
  },
}));

describe('PostMatchNotificationJob', () => {
  let postMatchNotificationJob: PostMatchNotificationJob;
  let mockNotificationService: jest.Mocked<NotificationService>;

  beforeEach(() => {
    mockNotificationService = {
      sendPostMatchPointsNotification: jest.fn().mockResolvedValue(undefined),
    } as any;

    postMatchNotificationJob = new PostMatchNotificationJob(mockNotificationService);
    jest.clearAllMocks();
  });

  describe('run', () => {
    it('should send notifications for recently finished matches with scores', async () => {
      const recentTime = new Date();
      const mockMatch = {
        id: 100,
        home_team: 'Team A',
        away_team: 'Team B',
        home_score_ft: 2,
        away_score_ft: 1,
        status: MatchStatus.FINISHED,
        updated_at: recentTime,
      };

      const mockBet = {
        id: 1,
        user_id: 1,
        match_id: 100,
        predicted_home_score: 2,
        predicted_away_score: 1,
      };

      const mockScore = {
        id: 1,
        bet_id: 1,
        points_awarded: SCORING_POINTS.EXACT_MATCH,
        score_type: ScoreType.EXACT,
        calculated_at: new Date(),
      };

      const mockUser = {
        id: 1,
        telegram_id: '123456',
        username: 'testuser',
        first_name: 'Test',
      };

      (matchRepository.findRecentFinished as jest.Mock).mockResolvedValue([mockMatch]);
      (betRepository.findByMatch as jest.Mock).mockResolvedValue([mockBet]);
      (scoreRepository.findByBetId as jest.Mock).mockResolvedValue(mockScore);
      (db.query as jest.Mock).mockResolvedValue({ rows: [mockUser] });

      await postMatchNotificationJob.run();

      expect(mockNotificationService.sendPostMatchPointsNotification).toHaveBeenCalledWith(
        1,
        '123456',
        100,
        'Team A',
        'Team B',
        2,
        1,
        6,
        2,
        1
      );
    });

    it('should skip matches without final scores', async () => {
      const mockMatch = {
        id: 100,
        home_team: 'Team A',
        away_team: 'Team B',
        home_score_ft: null,
        away_score_ft: null,
        status: MatchStatus.FINISHED,
        updated_at: new Date(),
      };

      (matchRepository.findRecentFinished as jest.Mock).mockResolvedValue([mockMatch]);

      await postMatchNotificationJob.run();

      expect(betRepository.findByMatch).not.toHaveBeenCalled();
      expect(mockNotificationService.sendPostMatchPointsNotification).not.toHaveBeenCalled();
    });

    it('should skip bets without scores calculated', async () => {
      const mockMatch = {
        id: 100,
        home_team: 'Team A',
        away_team: 'Team B',
        home_score_ft: 2,
        away_score_ft: 1,
        status: MatchStatus.FINISHED,
        updated_at: new Date(),
      };

      const mockBet = {
        id: 1,
        user_id: 1,
        match_id: 100,
        predicted_home_score: 2,
        predicted_away_score: 1,
      };

      (matchRepository.findRecentFinished as jest.Mock).mockResolvedValue([mockMatch]);
      (betRepository.findByMatch as jest.Mock).mockResolvedValue([mockBet]);
      (scoreRepository.findByBetId as jest.Mock).mockResolvedValue(null);

      await postMatchNotificationJob.run();

      expect(mockNotificationService.sendPostMatchPointsNotification).not.toHaveBeenCalled();
    });

    it('should handle multiple bets for the same match', async () => {
      const mockMatch = {
        id: 100,
        home_team: 'Team A',
        away_team: 'Team B',
        home_score_ft: 2,
        away_score_ft: 1,
        status: MatchStatus.FINISHED,
        updated_at: new Date(),
      };

      const mockBets = [
        { id: 1, user_id: 1, match_id: 100, predicted_home_score: 2, predicted_away_score: 1 },
        { id: 2, user_id: 2, match_id: 100, predicted_home_score: 1, predicted_away_score: 1 },
      ];

      const mockUsers = [
        { id: 1, telegram_id: '111', username: 'user1', first_name: 'User 1' },
        { id: 2, telegram_id: '222', username: 'user2', first_name: 'User 2' },
      ];

      (matchRepository.findRecentFinished as jest.Mock).mockResolvedValue([mockMatch]);
      (betRepository.findByMatch as jest.Mock).mockResolvedValue(mockBets);
      (scoreRepository.findByBetId as jest.Mock)
        .mockResolvedValueOnce({
          id: 1,
          bet_id: 1,
          points_awarded: SCORING_POINTS.EXACT_MATCH,
          score_type: ScoreType.EXACT,
          calculated_at: new Date(),
        })
        .mockResolvedValueOnce({
          id: 2,
          bet_id: 2,
          points_awarded: SCORING_POINTS.PARTICIPATION,
          score_type: ScoreType.PARTIAL,
          calculated_at: new Date(),
        });
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockUsers[0]] })
        .mockResolvedValueOnce({ rows: [mockUsers[1]] });

      await postMatchNotificationJob.run();

      expect(mockNotificationService.sendPostMatchPointsNotification).toHaveBeenCalledTimes(2);
    });

    it('should filter out matches updated more than 2 hours ago', async () => {
      const oldTime = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      const recentTime = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago

      const mockMatches = [
        {
          id: 100,
          home_team: 'Old Match',
          away_team: 'Team B',
          home_score_ft: 2,
          away_score_ft: 1,
          status: MatchStatus.FINISHED,
          updated_at: oldTime,
        },
        {
          id: 101,
          home_team: 'Recent Match',
          away_team: 'Team D',
          home_score_ft: 1,
          away_score_ft: 0,
          status: MatchStatus.FINISHED,
          updated_at: recentTime,
        },
      ];

      (matchRepository.findRecentFinished as jest.Mock).mockResolvedValue(mockMatches);
      (betRepository.findByMatch as jest.Mock).mockResolvedValue([]);

      await postMatchNotificationJob.run();

      // Only the recent match should be processed
      expect(betRepository.findByMatch).toHaveBeenCalledTimes(1);
      expect(betRepository.findByMatch).toHaveBeenCalledWith(101);
    });

    it('should continue processing if notification fails for one bet', async () => {
      const mockMatch = {
        id: 100,
        home_team: 'Team A',
        away_team: 'Team B',
        home_score_ft: 2,
        away_score_ft: 1,
        status: MatchStatus.FINISHED,
        updated_at: new Date(),
      };

      const mockBets = [
        { id: 1, user_id: 1, match_id: 100, predicted_home_score: 2, predicted_away_score: 1 },
        { id: 2, user_id: 2, match_id: 100, predicted_home_score: 1, predicted_away_score: 1 },
      ];

      const mockScore = {
        id: 1,
        bet_id: 1,
        points_awarded: SCORING_POINTS.EXACT_MATCH,
        score_type: ScoreType.EXACT,
        calculated_at: new Date(),
      };

      const mockUsers = [
        { id: 1, telegram_id: '111', username: 'user1', first_name: 'User 1' },
        { id: 2, telegram_id: '222', username: 'user2', first_name: 'User 2' },
      ];

      (matchRepository.findRecentFinished as jest.Mock).mockResolvedValue([mockMatch]);
      (betRepository.findByMatch as jest.Mock).mockResolvedValue(mockBets);
      (scoreRepository.findByBetId as jest.Mock).mockResolvedValue(mockScore);
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockUsers[0]] })
        .mockResolvedValueOnce({ rows: [mockUsers[1]] });

      mockNotificationService.sendPostMatchPointsNotification
        .mockRejectedValueOnce(new Error('Notification failed'))
        .mockResolvedValueOnce(undefined);

      await postMatchNotificationJob.run();

      expect(mockNotificationService.sendPostMatchPointsNotification).toHaveBeenCalledTimes(2);
    });

    it('should handle missing user gracefully', async () => {
      const mockMatch = {
        id: 100,
        home_team: 'Team A',
        away_team: 'Team B',
        home_score_ft: 2,
        away_score_ft: 1,
        status: MatchStatus.FINISHED,
        updated_at: new Date(),
      };

      const mockBet = {
        id: 1,
        user_id: 999,
        match_id: 100,
        predicted_home_score: 2,
        predicted_away_score: 1,
      };

      const mockScore = {
        id: 1,
        bet_id: 1,
        points_awarded: SCORING_POINTS.EXACT_MATCH,
        score_type: ScoreType.EXACT,
        calculated_at: new Date(),
      };

      (matchRepository.findRecentFinished as jest.Mock).mockResolvedValue([mockMatch]);
      (betRepository.findByMatch as jest.Mock).mockResolvedValue([mockBet]);
      (scoreRepository.findByBetId as jest.Mock).mockResolvedValue(mockScore);
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      await postMatchNotificationJob.run();

      expect(mockNotificationService.sendPostMatchPointsNotification).not.toHaveBeenCalled();
    });
  });
});
