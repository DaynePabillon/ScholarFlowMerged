const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function extract() {
    try {
        const res = await pool.query(`SELECT prosrc FROM pg_proc WHERE proname = 'notify_progress_update'`);
        fs.writeFileSync('trigger_func.sql', res.rows[0].prosrc);
        console.log("Wrote full function body to trigger_func.sql");
    } finally {
        pool.end();
    }
}
extract();
