const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function checkUserAdminStatus() {
    try {
        console.log("Looking up user Dayne Pabillon in DB...");
        
        // Find users with Dayne
        const userRes = await pool.query(`SELECT id, email, name FROM users WHERE name ILIKE '%Dayne%' OR email ILIKE '%dayne%'`);
        if (userRes.rows.length === 0) {
            console.log("User not found!");
            return;
        }
        
        for (const user of userRes.rows) {
            console.log(`\n============================`);
            console.log(`User: ${user.name} (${user.email}) ID: ${user.id}`);
            
            // 1. Check ScholarsyncRole
            const ssRes = await pool.query(`SELECT * FROM "ss_account" WHERE "accountEmail" = $1 LIMIT 1`, [user.email]);
            if (ssRes.rows.length > 0) {
                console.log(`ScholarSync Role: ${ssRes.rows[0].accountRole}`);
            } else {
                console.log(`ScholarSync Role: NULL (No ss_account found)`);
            }
            
            // 2. Check SkyFlow Organizations
            const orgsRes = await pool.query(`
               SELECT o.name, om.role, om.status
               FROM organizations o
               INNER JOIN organization_members om ON o.id = om.organization_id
               WHERE om.user_id = $1 AND om.status = 'active'
            `, [user.id]);
            
            console.log(`Organizations (${orgsRes.rows.length}):`);
            for (const org of orgsRes.rows) {
                console.log(` - ${org.name}: [Role: ${org.role}] [Status: ${org.status}]`);
            }
        }
        
    } catch(e) { console.error(e); }
    finally { pool.end(); }
}
checkUserAdminStatus();
