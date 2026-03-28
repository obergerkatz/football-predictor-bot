import { db } from '../database';
import { Notification, NotificationType } from '../../types';

export class NotificationRepository {
  async create(
    userId: number,
    matchId: number | null,
    notificationType: NotificationType,
    message: string
  ): Promise<Notification> {
    const result = await db.query<Notification>(
      `INSERT INTO notifications (user_id, match_id, notification_type, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, matchId, notificationType, message]
    );
    return result.rows[0];
  }

  async hasBeenSent(
    userId: number,
    matchId: number,
    notificationType: NotificationType
  ): Promise<boolean> {
    const result = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM notifications
       WHERE user_id = $1 AND match_id = $2 AND notification_type = $3`,
      [userId, matchId, notificationType]
    );
    return parseInt(result.rows[0].count, 10) > 0;
  }

  async findByUser(userId: number, limit: number = 50): Promise<Notification[]> {
    const result = await db.query<Notification>(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY sent_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  async findByMatch(matchId: number): Promise<Notification[]> {
    const result = await db.query<Notification>(
      `SELECT * FROM notifications
       WHERE match_id = $1
       ORDER BY sent_at DESC`,
      [matchId]
    );
    return result.rows;
  }
}

export const notificationRepository = new NotificationRepository();
