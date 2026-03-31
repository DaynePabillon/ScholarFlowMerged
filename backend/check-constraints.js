const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function checkConstraints() {
    try {
        console.log("Checking constraints for sheet_tasks...");
        const res = await pool.query(`
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_name = 'sheet_tasks'
        `);
        console.table(res.rows);
    } catch(e) { console.error(e); }
    finally { pool.end(); }
}
checkConstraints();
