import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { sseService } from '../services/sse.service';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

const router = Router();

function sseAuth(req: AuthRequest, res: Response): boolean {
  const token = (req.query.token as string) || (req.headers.authorization?.split(' ')[1]);
  if (!token) { res.status(401).json({ error: 'Token required' }); return false; }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key') as any;
    return true;
  } catch (_) {
    res.status(401).json({ error: 'Invalid token' }); return false;
  }
}

function sseHeaders(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

function heartbeat(res: Response): NodeJS.Timeout {
  return setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) {}
  }, 25000);
}

/**
 * GET /api/sse/announcements
 * Global stream — pushes active announcement to all authenticated users
 */
router.get('/announcements', (req: AuthRequest, res: Response) => {
  if (!sseAuth(req, res)) return;
  sseHeaders(res);
  const id = randomUUID();
  sseService.addAnnouncementClient(id, res);
  const hb = heartbeat(res);
  req.on('close', () => {
    clearInterval(hb);
    sseService.removeAnnouncementClient(id);
  });
});

/**
 * GET /api/sse/notifications
 * Per-user stream — pushes notifications to the authenticated user
 */
router.get('/notifications', (req: AuthRequest, res: Response) => {
  if (!sseAuth(req, res)) return;
  sseHeaders(res);
  const id = randomUUID();
  const userId = req.user!.id;
  sseService.addNotificationClient(id, res, userId);
  const hb = heartbeat(res);
  req.on('close', () => {
    clearInterval(hb);
    sseService.removeNotificationClient(id);
  });
});

/**
 * GET /api/sse/tasks/:orgId
 * Per-org stream — pushes task create/update/delete events to org members
 */
router.get('/tasks/:orgId', (req: AuthRequest, res: Response) => {
  if (!sseAuth(req, res)) return;
  sseHeaders(res);
  const id = randomUUID();
  const { orgId } = req.params;
  sseService.addTaskClient(id, res, orgId);
  const hb = heartbeat(res);
  req.on('close', () => {
    clearInterval(hb);
    sseService.removeTaskClient(id);
  });
});

/**
 * GET /api/sse/comments/:taskId
 * Per-task stream — pushes new comments to anyone viewing that task
 */
router.get('/comments/:taskId', (req: AuthRequest, res: Response) => {
  if (!sseAuth(req, res)) return;
  sseHeaders(res);
  const id = randomUUID();
  const { taskId } = req.params;
  sseService.addCommentClient(id, res, taskId);
  const hb = heartbeat(res);
  req.on('close', () => {
    clearInterval(hb);
    sseService.removeCommentClient(id);
  });
});

export default router;
