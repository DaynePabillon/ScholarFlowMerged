import { Response } from 'express';

interface SSEClient {
  id: string;
  res: Response;
  userId?: string;
  orgId?: string;
  taskId?: string;
}

class SSEService {
  private announcementClients: Map<string, SSEClient> = new Map();
  private notificationClients: Map<string, SSEClient> = new Map();
  private taskClients: Map<string, SSEClient> = new Map();
  private commentClients: Map<string, SSEClient> = new Map();

  private sendEvent(res: Response, event: string, data: any) {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (_) {}
  }

  addAnnouncementClient(id: string, res: Response, orgId?: string) {
    this.announcementClients.set(id, { id, res, orgId });
  }

  removeAnnouncementClient(id: string) {
    this.announcementClients.delete(id);
  }

  broadcastAnnouncement(announcement: any) {
    this.announcementClients.forEach((client) => {
      if (announcement === null) {
        // Deactivation — notify all clients
        this.sendEvent(client.res, 'announcement', null);
      } else {
        const annOrgId: string | null = announcement.organization_id || null;
        const clientOrgId = client.orgId || null;
        // Send if global announcement, or org matches
        if (!annOrgId || clientOrgId === annOrgId) {
          this.sendEvent(client.res, 'announcement', announcement);
        }
      }
    });
  }

  addNotificationClient(id: string, res: Response, userId: string) {
    this.notificationClients.set(id, { id, res, userId });
  }

  removeNotificationClient(id: string) {
    this.notificationClients.delete(id);
  }

  pushNotification(userId: string, notification: any) {
    this.notificationClients.forEach((client) => {
      if (client.userId === userId) {
        this.sendEvent(client.res, 'notification', notification);
      }
    });
  }

  addTaskClient(id: string, res: Response, orgId: string) {
    this.taskClients.set(id, { id, res, orgId });
  }

  removeTaskClient(id: string) {
    this.taskClients.delete(id);
  }

  broadcastTaskUpdate(orgId: string, task: any, eventType: 'task_created' | 'task_updated' | 'task_deleted') {
    this.taskClients.forEach((client) => {
      if (client.orgId === orgId) {
        this.sendEvent(client.res, eventType, task);
      }
    });
  }

  addCommentClient(id: string, res: Response, taskId: string) {
    this.commentClients.set(id, { id, res, taskId });
  }

  removeCommentClient(id: string) {
    this.commentClients.delete(id);
  }

  broadcastComment(taskId: string, comment: any) {
    this.commentClients.forEach((client) => {
      if (client.taskId === taskId) {
        this.sendEvent(client.res, 'comment', comment);
      }
    });
  }
}

export const sseService = new SSEService();
export default sseService;
