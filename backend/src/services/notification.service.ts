import { pool } from '../config/database';

export interface Notification {
    id?: string;
    user_id: string;
    type: 'assigned' | 'commented' | 'deadline' | 'mentioned' | 'status_changed';
    title: string;
    message: string;
    task_id?: string;
    is_read?: boolean;
    created_at?: Date;
}

export const notificationService = {
    // Create a notification
    async create(notification: Notification): Promise<Notification> {
        const result = await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, task_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [notification.user_id, notification.type, notification.title, notification.message, notification.task_id]
        );
        return result.rows[0];
    },

    // Get user's notifications
    async getUserNotifications(userId: string, limit: number = 20): Promise<Notification[]> {
        const result = await pool.query(
            `SELECT n.*, t.title as task_title
       FROM notifications n
       LEFT JOIN tasks t ON n.task_id = t.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2`,
            [userId, limit]
        );
        return result.rows;
    },

    // Get unread count
    async getUnreadCount(userId: string): Promise<number> {
        const result = await pool.query(
            `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
            [userId]
        );
        return parseInt(result.rows[0].count);
    },

    // Mark as read
    async markAsRead(notificationId: string, userId: string): Promise<void> {
        await pool.query(
            `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
            [notificationId, userId]
        );
    },

    // Mark all as read
    async markAllAsRead(userId: string): Promise<void> {
        await pool.query(
            `UPDATE notifications SET is_read = true WHERE user_id = $1`,
            [userId]
        );
    },

    // Create notification for task assignment
    async notifyTaskAssignment(taskId: string, taskTitle: string, assigneeId: string, assignerName: string): Promise<void> {
        await this.create({
            user_id: assigneeId,
            type: 'assigned',
            title: 'New Task Assigned',
            message: `${assignerName} assigned you to "${taskTitle}"`,
            task_id: taskId
        });
    },

    // Create notification for new comment
    async notifyNewComment(taskId: string, taskTitle: string, userId: string, commenterName: string): Promise<void> {
        await this.create({
            user_id: userId,
            type: 'commented',
            title: 'New Comment',
            message: `${commenterName} commented on "${taskTitle}"`,
            task_id: taskId
        });
    }
};

export default notificationService;
