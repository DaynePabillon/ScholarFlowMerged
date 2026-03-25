import { pool } from '../config/database';

export interface ActivityLogEntry {
    id?: string;
    organization_id: string;
    user_id: string;
    user_name: string;
    action: 'created' | 'updated' | 'deleted' | 'assigned' | 'unassigned' | 'status_changed' | 'commented';
    entity_type: 'task' | 'project' | 'member' | 'comment';
    entity_id?: string;
    entity_name?: string;
    details?: Record<string, any>;
    created_at?: Date;
}

export const activityService = {
    // Log an activity
    async log(entry: ActivityLogEntry): Promise<void> {
        try {
            await pool.query(
                `INSERT INTO activity_log (organization_id, user_id, user_name, action, entity_type, entity_id, entity_name, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    entry.organization_id,
                    entry.user_id,
                    entry.user_name,
                    entry.action,
                    entry.entity_type,
                    entry.entity_id,
                    entry.entity_name,
                    JSON.stringify(entry.details || {})
                ]
            );
        } catch (error) {
            console.error('Error logging activity:', error);
            // Don't throw - activity logging should not break main operations
        }
    },

    // Get activity feed for an organization
    async getActivityFeed(organizationId: string, limit: number = 50): Promise<ActivityLogEntry[]> {
        const result = await pool.query(
            `SELECT * FROM activity_log 
       WHERE organization_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
            [organizationId, limit]
        );
        return result.rows;
    },

    // Get recent activity for a specific entity
    async getEntityActivity(entityType: string, entityId: string, limit: number = 20): Promise<ActivityLogEntry[]> {
        const result = await pool.query(
            `SELECT * FROM activity_log 
       WHERE entity_type = $1 AND entity_id = $2 
       ORDER BY created_at DESC 
       LIMIT $3`,
            [entityType, entityId, limit]
        );
        return result.rows;
    }
};

export default activityService;
