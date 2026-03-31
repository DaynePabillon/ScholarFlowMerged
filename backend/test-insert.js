const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function runInsertTest() {
    try {
        console.log("Simulating INSERT from workspace.service.ts...");
        
        // Use the actual synced_sheet_id & team_id from synced_sheets
        const syncedSheetId = '7f13b629-1b09-441e-bb65-33b6946fe683';
        const projectId = null; 
        const teamId = 'f7f7ee8d-1155-43be-b1c2-d2fcedae9b38';
        
        const task = {
            sheetRowIndex: 1,
            title: 'Project Planning',
            description: 'Overall project planning phase',
            status: 'in progress',
            priority: 'high',
            assigneeEmail: undefined,
            dueDate: undefined,
            startDate: undefined,
            wbs_code: '1',
            complexityWeight: 1,
            isAbsolute: true,
            progress_percent: 0,
            luxury_weight: 1
        };
        const parentTaskId = null;
        
        const params = [
            syncedSheetId, projectId, teamId, task.sheetRowIndex, task.title, task.description, 
            task.status, task.priority, task.assigneeEmail, task.dueDate, task.startDate,
            task.wbs_code || null, parentTaskId, task.complexityWeight || 1, task.isAbsolute || false,
            task.progress_percent || 0, task.luxury_weight || 1
        ];

        console.log("Params:", params);

        const queryStr = `
            INSERT INTO sheet_tasks (
            synced_sheet_id, project_id, team_id, sheet_row_index, title, description,
            status, priority, assignee_email, due_date, start_date,
            wbs_code, parent_task_id, complexity_weight, is_absolute,
            progress_percent, luxury_weight, synced_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
        ON CONFLICT(synced_sheet_id, sheet_row_index) 
        DO UPDATE SET 
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            status = EXCLUDED.status,
            priority = EXCLUDED.priority,
            assignee_email = EXCLUDED.assignee_email,
            due_date = EXCLUDED.due_date,
            start_date = EXCLUDED.start_date,
            wbs_code = EXCLUDED.wbs_code,
            parent_task_id = EXCLUDED.parent_task_id,
            team_id = EXCLUDED.team_id,
            complexity_weight = EXCLUDED.complexity_weight,
            is_absolute = EXCLUDED.is_absolute,
            progress_percent = EXCLUDED.progress_percent,
            luxury_weight = EXCLUDED.luxury_weight,
            synced_at = NOW(),
            updated_at = NOW()
        RETURNING id, (xmax = 0) AS inserted
        `;

        const result = await pool.query(queryStr, params);
        console.log("Success! Inserted row:", result.rows[0]);
    } catch(e) {
        console.error("Postgres Error:", e.message);
    } finally {
        pool.end();
    }
}
runInsertTest();
