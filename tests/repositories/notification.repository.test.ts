import { NotificationRepository } from '../../src/db/repositories/notification.repository';
import { db } from '../../src/db/database';
import { NotificationType } from '../../src/types';

// Mock database
jest.mock('../../src/db/database', () => ({
  db: {
    query: jest.fn(),
  },
}));

describe('NotificationRepository', () => {
  let notificationRepository: NotificationRepository;

  beforeEach(() => {
    notificationRepository = new NotificationRepository();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new notification', async () => {
      const userId = 1;
      const matchId = 100;
      const notificationType = NotificationType.PRE_MATCH_NO_BET;
      const message = 'Test notification message';

      const mockNotification = {
        id: 1,
        user_id: userId,
        match_id: matchId,
        notification_type: notificationType,
        message: message,
        sent_at: new Date(),
      };

      (db.query as jest.Mock).mockResolvedValue({ rows: [mockNotification] });

      const result = await notificationRepository.create(userId, matchId, notificationType, message);

      expect(result).toEqual(mockNotification);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        [userId, matchId, notificationType, message]
      );
    });

    it('should handle null match_id', async () => {
      const mockNotification = {
        id: 1,
        user_id: 1,
        match_id: null,
        notification_type: NotificationType.PRE_MATCH_NO_BET,
        message: 'Test',
        sent_at: new Date(),
      };

      (db.query as jest.Mock).mockResolvedValue({ rows: [mockNotification] });

      const result = await notificationRepository.create(
        1,
        null,
        NotificationType.PRE_MATCH_NO_BET,
        'Test'
      );

      expect(result.match_id).toBeNull();
    });
  });

  describe('hasBeenSent', () => {
    it('should return true if notification exists', async () => {
      const userId = 1;
      const matchId = 100;
      const notificationType = NotificationType.POST_MATCH_POINTS;

      (db.query as jest.Mock).mockResolvedValue({ rows: [{ count: '1' }] });

      const result = await notificationRepository.hasBeenSent(userId, matchId, notificationType);

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*)'),
        [userId, matchId, notificationType]
      );
    });

    it('should return false if notification does not exist', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [{ count: '0' }] });

      const result = await notificationRepository.hasBeenSent(1, 100, NotificationType.PRE_MATCH_NO_BET);

      expect(result).toBe(false);
    });

    it('should return false for multiple notifications of different types', async () => {
      // User has received post-match notification but not pre-match
      (db.query as jest.Mock).mockResolvedValue({ rows: [{ count: '0' }] });

      const result = await notificationRepository.hasBeenSent(1, 100, NotificationType.PRE_MATCH_NO_BET);

      expect(result).toBe(false);
    });
  });

  describe('findByUser', () => {
    it('should return user notifications ordered by sent_at DESC', async () => {
      const userId = 1;
      const mockNotifications = [
        {
          id: 2,
          user_id: userId,
          match_id: 101,
          notification_type: NotificationType.POST_MATCH_POINTS,
          message: 'Recent notification',
          sent_at: new Date('2024-01-02'),
        },
        {
          id: 1,
          user_id: userId,
          match_id: 100,
          notification_type: NotificationType.PRE_MATCH_NO_BET,
          message: 'Older notification',
          sent_at: new Date('2024-01-01'),
        },
      ];

      (db.query as jest.Mock).mockResolvedValue({ rows: mockNotifications });

      const result = await notificationRepository.findByUser(userId);

      expect(result).toEqual(mockNotifications);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY sent_at DESC'),
        [userId, 50]
      );
    });

    it('should return empty array for user with no notifications', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await notificationRepository.findByUser(999);

      expect(result).toEqual([]);
    });

    it('should respect custom limit parameter', async () => {
      const customLimit = 10;
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      await notificationRepository.findByUser(1, customLimit);

      expect(db.query).toHaveBeenCalledWith(expect.any(String), [1, customLimit]);
    });
  });

  describe('findByMatch', () => {
    it('should return all notifications for a match', async () => {
      const matchId = 100;
      const mockNotifications = [
        {
          id: 1,
          user_id: 1,
          match_id: matchId,
          notification_type: NotificationType.PRE_MATCH_NO_BET,
          message: 'User 1 pre-match',
          sent_at: new Date(),
        },
        {
          id: 2,
          user_id: 2,
          match_id: matchId,
          notification_type: NotificationType.POST_MATCH_POINTS,
          message: 'User 2 post-match',
          sent_at: new Date(),
        },
      ];

      (db.query as jest.Mock).mockResolvedValue({ rows: mockNotifications });

      const result = await notificationRepository.findByMatch(matchId);

      expect(result).toEqual(mockNotifications);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE match_id = $1'),
        [matchId]
      );
    });

    it('should return empty array for match with no notifications', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await notificationRepository.findByMatch(999);

      expect(result).toEqual([]);
    });
  });
});
