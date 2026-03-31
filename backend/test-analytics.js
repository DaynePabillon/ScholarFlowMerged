const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function testOverview() {
    try {
        const userId = '56c18118-9500-4ba6-9e8e-6d92640b63eb'; // Dayne's ID
        const orgId = 'f7f7ee8d-1155-43be-b1c2-d2fcedae9b38';  // ScholarSync Org ID
        
        console.log("Testing Analytics Overview Query...");
        
        let teamFilter = '';
        const memberResult = await pool.query(
            'SELECT role FROM organization_members WHERE user_id = $1 AND organization_id = $2',
            [userId, orgId]
        );
        const userRole = memberResult.rows[0]?.role;
        console.log("Role:", userRole);
        
        const testQ = await pool.query(
            `SELECT COUNT(*) as count FROM team_groups tg WHERE tg.organization_id = $1 ${teamFilter}`,
            [orgId]
        );
        console.log("Total Teams Query works:", testQ.rows);
        
        const errorQ = await pool.query(
            `SELECT COUNT(*) as count FROM team_group_members tgm 
             JOIN team_groups tg ON tgm.team_group_id = tg.id 
             WHERE tg.organization_id = $1 ${teamFilter}`,
            [orgId]
        );
        console.log("Total Members Query works:", errorQ.rows);
        
        // Let's test all queries...
        const cpQ = await pool.query(
            `SELECT COUNT(*) as total,
         COUNT(*) FILTER (WHERE tc.status = 'completed') as completed,
         COUNT(*) FILTER (WHERE tc.status = 'in_progress') as in_progress,
         COUNT(*) FILTER (WHERE tc.status = 'pending') as pending
       FROM team_checkpoints tc 
       JOIN team_groups tg ON tc.team_group_id = tg.id 
       WHERE tg.organization_id = $1 ${teamFilter}`,
            [orgId]
        );
        console.log("Checkpoints Query works:", cpQ.rows);
        
        const teamsBreakdown = await pool.query(
            `SELECT tg.id, tg.name, tg.team_number, tg.adviser_name, tg.proposed_project, tg.status, tg.grade,
         (SELECT COUNT(*) FROM team_group_members WHERE team_group_id = tg.id) as member_count,
         (SELECT COUNT(*) FROM team_checkpoints WHERE team_group_id = tg.id) as total_checkpoints,
         (SELECT COUNT(*) FROM team_checkpoints WHERE team_group_id = tg.id AND status = 'completed') as completed_checkpoints,
         (SELECT COUNT(*) FROM team_comments WHERE team_group_id = tg.id) as comment_count
       FROM team_groups tg WHERE tg.organization_id = $1 ${teamFilter} ORDER BY tg.team_number`,
            [orgId]
        );
        console.log("Teams Breakdown Query works, row count:", teamsBreakdown.rows.length);

    } catch(e) {
        console.error("OVERVIEW FAILED:", e.message);
    } finally {
        pool.end();
    }
}
testOverview();
