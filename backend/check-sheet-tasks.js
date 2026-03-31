const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function checkTasksSchema() {
    try {
        console.log("Checking columns for sheet_tasks...");
        const res = await pool.query(`
            SELECT column_name, is_nullable, data_type
            FROM information_schema.columns 
            WHERE table_name = 'sheet_tasks'
        `);
        console.table(res.rows);
        
        console.log("Checking the specific synced sheet record...");
        const ssRes = await pool.query(`SELECT id, project_id, team_id FROM synced_sheets WHERE sheet_name = 'Imported via URL'`);
        console.table(ssRes.rows);
        
    } catch(e) { console.error(e); }
    finally { pool.end(); }
}
checkTasksSchema();
