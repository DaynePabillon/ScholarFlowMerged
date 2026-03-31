const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    try {
        console.log("Checking columns for synced_sheets...");
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'synced_sheets'
        `);
        console.log(res.rows.map(r => r.column_name));
        
        console.log("\nChecking columns for workspaces...");
        const wRes = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'workspaces'
        `);
        console.log(wRes.rows.map(r => r.column_name));
        
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
checkSchema();
