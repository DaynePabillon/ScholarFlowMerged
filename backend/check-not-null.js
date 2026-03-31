const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function checkTasksSchema() {
    try {
        console.log("Checking NOT NULL columns for sheet_tasks...");
        const res = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_name = 'sheet_tasks' AND is_nullable = 'NO'
        `);
        console.table(res.rows);
    } catch(e) { console.error(e); }
    finally { pool.end(); }
}
checkTasksSchema();
