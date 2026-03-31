const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
    connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("Checking DB for synced sheets...");
        const res = await pool.query(`
            SELECT ss.*, w.created_by 
            FROM synced_sheets ss 
            JOIN workspaces w ON ss.workspace_id = w.id 
            WHERE ss.sheet_name = 'Imported via URL' LIMIT 1
        `);
        
        if (res.rows.length === 0) {
            console.log("Sheet not found");
            return;
        }
        const sheet = res.rows[0];
        console.log(`Sheet ID: ${sheet.sheet_id}, created_by: ${sheet.created_by}`);
        
        const userRes = await pool.query('SELECT access_token FROM users WHERE id = $1', [sheet.created_by]);
        if(userRes.rows.length === 0) {
            console.log("User not found");
            return;
        }
        
        const accessToken = userRes.rows[0].access_token;
        const mapping = typeof sheet.column_mapping === 'string' ? JSON.parse(sheet.column_mapping) : sheet.column_mapping;
        const sheetTab = mapping.sheetTab || 'Sheet1';
        const range = `${sheetTab}!A:Z`;
        
        console.log(`Fetching from Google Sheets API with range: ${range}...`);
        
        const gsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheet.sheet_id}/values/${encodeURIComponent(range)}`;
        
        try {
            const gsRes = await axios.get(gsUrl, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            
            const rows = gsRes.data.values || [];
            console.log(`Google API returned ${rows.length} rows.`);
            if (rows.length > 0) {
                console.log("Row 0 (Header):", rows[0]);
                console.log("Row 1 (Data):", rows[1]);
            }
        } catch(apiErr) {
            console.error("Google API Error:", apiErr.response ? apiErr.response.data : apiErr.message);
        }
        
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
