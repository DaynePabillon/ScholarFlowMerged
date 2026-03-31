const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function checkFunction() {
    try {
        console.log("Fetching function definition from DB...");
        const res = await pool.query(`
            SELECT prosrc 
            FROM pg_proc 
            WHERE proname = 'notify_progress_update'
        `);
        console.log(res.rows[0].prosrc);
    } catch(e) { console.error(e); }
    finally { pool.end(); }
}
checkFunction();
