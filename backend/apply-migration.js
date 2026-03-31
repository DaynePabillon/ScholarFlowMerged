const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
    try {
        console.log("Reading migration SQL...");
        const sql = fs.readFileSync('src/migrations/026_fix_sheet_tasks_trigger.sql', 'utf-8');
        
        console.log("Applying migration to remote DB...");
        await pool.query(sql);
        console.log("Migration applied successfully!");
    } catch(e) { 
        console.error("Migration Failed:", e); 
    } finally { 
        pool.end(); 
    }
}
applyMigration();
