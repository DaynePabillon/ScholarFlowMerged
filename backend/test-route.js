const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function runRoute() {
    const orgId = '367fc44c-1e25-45a7-96a2-e64e9e044030'; // ID for 'ScholarSync' org? Wait, I need to get the real org ID.
    const userId = '56c18118-9500-4ba6-9e8e-6d92640b63eb';

    try {
        const orgsRes = await pool.query(`SELECT id, name FROM organizations WHERE name = 'ScholarSync'`);
        const realOrgId = orgsRes.rows[0].id;
        console.log("Real Org ID:", realOrgId);

        console.log("--- Running analytics logic ---");
        const memberResult = await pool.query(
            'SELECT role FROM organization_members WHERE user_id = $1 AND organization_id = $2',
            [userId, realOrgId]
        );
        const userRole = memberResult.rows[0]?.role;
        console.log("User Role:", userRole);

        let teamFilter = '';
        if (userRole === 'member') {
            console.log("Is member");
        }

        const totalTeamsRes = await pool.query(`SELECT COUNT(*) as count FROM team_groups tg WHERE tg.organization_id = $1 ${teamFilter}`, [realOrgId]);
        const totalTeams = parseInt(totalTeamsRes.rows[0].count);
        console.log("Total Teams:", totalTeams);

        const totalMembersRes = await pool.query(`SELECT COUNT(*) as count FROM team_group_members tgm JOIN team_groups tg ON tgm.team_group_id = tg.id WHERE tg.organization_id = $1 ${teamFilter}`, [realOrgId]);
        const totalMembers = parseInt(totalMembersRes.rows[0].count);
        console.log("Total Members:", totalMembers);

        const checkpointsResult = await pool.query(
            `SELECT COUNT(*) as total,
         COUNT(*) FILTER (WHERE tc.status = 'completed') as completed,
         COUNT(*) FILTER (WHERE tc.status = 'in_progress') as in_progress,
         COUNT(*) FILTER (WHERE tc.status = 'pending') as pending
       FROM team_checkpoints tc 
       JOIN team_groups tg ON tc.team_group_id = tg.id 
       WHERE tg.organization_id = $1 ${teamFilter}`,
            [realOrgId]
        );
        const checkpoints = {
            total: parseInt(checkpointsResult.rows[0].total),
            completed: parseInt(checkpointsResult.rows[0].completed),
            in_progress: parseInt(checkpointsResult.rows[0].in_progress),
            pending: parseInt(checkpointsResult.rows[0].pending),
        };
        console.log("Checkpoints:", checkpoints);

        const totalCommentsRes = await pool.query(`SELECT COUNT(*) as count FROM team_comments tc JOIN team_groups tg ON tc.team_group_id = tg.id WHERE tg.organization_id = $1 ${teamFilter}`, [realOrgId]);
        const totalComments = parseInt(totalCommentsRes.rows[0].count);
        console.log("Total Comments:", totalComments);

        const teamsBreakdown = await pool.query(
            `SELECT tg.id, tg.name, tg.team_number, tg.adviser_name, tg.proposed_project, tg.status, tg.grade,
         (SELECT COUNT(*) FROM team_group_members WHERE team_group_id = tg.id) as member_count,
         (SELECT COUNT(*) FROM team_checkpoints WHERE team_group_id = tg.id) as total_checkpoints,
         (SELECT COUNT(*) FROM team_checkpoints WHERE team_group_id = tg.id AND status = 'completed') as completed_checkpoints,
         (SELECT COUNT(*) FROM team_comments WHERE team_group_id = tg.id) as comment_count
       FROM team_groups tg WHERE tg.organization_id = $1 ${teamFilter} ORDER BY tg.team_number`,
            [realOrgId]
        );
        console.log("Teams breakdown:", teamsBreakdown.rows.length);

        const statusBreakdown = await pool.query(`SELECT status, COUNT(*) as count FROM team_groups tg WHERE tg.organization_id = $1 ${teamFilter} GROUP BY status`, [realOrgId]);
        const teamsByStatus = {};
        statusBreakdown.rows.forEach((r) => { teamsByStatus[r.status] = parseInt(r.count); });
        console.log("Teams by status:", teamsByStatus);

        const recentActivity = await pool.query(
            `SELECT tc.user_name, tc.content, tc.created_at, tg.name as team_name
       FROM team_comments tc JOIN team_groups tg ON tc.team_group_id = tg.id
       WHERE tg.organization_id = $1 ${teamFilter} ORDER BY tc.created_at DESC LIMIT 10`, [realOrgId]
        );
        console.log("Recent activity:", recentActivity.rows.length);

        console.log("SUCCESS!");
    } catch(e) {
        console.error("FAILED!", e);
    } finally {
        pool.end();
    }
}
runRoute();
