import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import notificationService from '../services/notification.service';

const router = Router();

// Get user's notifications
router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const notifications = await notificationService.getUserNotifications(userId);
        const unreadCount = await notificationService.getUnreadCount(userId);

        res.json({ notifications, unreadCount });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.id;

        await notificationService.markAsRead(id, userId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// Mark all notifications as read
router.post('/read-all', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        await notificationService.markAllAsRead(userId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Failed to mark all as read' });
    }
});

export default router;
