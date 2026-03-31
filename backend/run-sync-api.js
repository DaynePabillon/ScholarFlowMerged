process.env.DATABASE_URL = 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres';
// Need this before other imports
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Since workspace.service.ts is typescript, we can just compile and run it. 
// But an even better and fool-proof way: hit the live API endpoint of the deployed server!
const axios = require('axios');

async function testRemoteSync() {
    try {
        console.log("Triggering sync on the LIVE remote server...");
        // URL for the API endpoint on the deployed backend
        const serverUrl = 'https://scholarflow-api.onrender.com';
        
        // Find workspace id to trigger sync
        const res = await pool.query('SELECT workspace_id, id FROM synced_sheets WHERE sheet_name = $1 LIMIT 1', ['Imported via URL']);
        if (res.rows.length === 0) {
            console.log('Test sheet not found.');
            return;
        }
        
        const workspaceId = res.rows[0].workspace_id;
        console.log(`Found Workspace ID: ${workspaceId}. Calling API...`);
        
        // POST /api/workspaces/:workspaceId/sync
        const sysToken = 'dummy-if-unauthenticated-but-we-might-get-401';
        
        // What if we just call the local DB and use the workspace service?
        // To avoid auth issues, let's just trigger it locally but with ts-node on the server files
    } catch(e) { console.error(e) }
}
testRemoteSync();
