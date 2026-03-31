const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function checkOrgsAndTeams() {
    try {
        const userId = '56c18118-9500-4ba6-9e8e-6d92640b63eb'; // Dayne

        const orgsRes = await pool.query(`
            SELECT o.id, o.name, om.role
            FROM organizations o
            JOIN organization_members om ON o.id = om.organization_id
            WHERE om.user_id = $1
        `, [userId]);

        console.log(`User is in ${orgsRes.rows.length} organizations:`);
        
        for (const org of orgsRes.rows) {
            console.log(`\n--- Org: ${org.name} (${org.id}) [Role: ${org.role}] ---`);
            
            const teamsRes = await pool.query(`SELECT id, name FROM team_groups WHERE organization_id = $1`, [org.id]);
            console.log(`Teams (${teamsRes.rows.length}):`);
            teamsRes.rows.forEach(t => console.log(`  - ${t.name}`));
        }

    } catch (e) {
        console.error("DB Error:", e);
    } finally {
        pool.end();
    }
}
checkOrgsAndTeams();
