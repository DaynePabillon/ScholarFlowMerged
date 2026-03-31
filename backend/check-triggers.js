const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function checkTriggers() {
    try {
        console.log("Checking triggers on sheet_tasks...");
        const res = await pool.query(`
            SELECT trigger_name, event_manipulation, event_object_table, action_statement
            FROM information_schema.triggers
            WHERE event_object_table = 'sheet_tasks'
        `);
        console.log(res.rows);
    } catch(e) { console.error(e); }
    finally { pool.end(); }
}
checkTriggers();
