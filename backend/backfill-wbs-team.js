/**
 * Backfill script: Assign orphaned WBS tasks, sheet_tasks, and synced_sheets
 * (those with team_id = NULL) to a specific team.
 *
 * Usage:
 *   node backfill-wbs-team.js <organization_id> <team_id>
 *
 * Example:
 *   node backfill-wbs-team.js 123e4567-e89b-12d3-a456-426614174000 abc12345-...
 *
 * To find your org_id and team_id, run:
 *   node backfill-wbs-team.js --list
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function listOrgsAndTeams() {
    const client = await pool.connect();
    try {
        const orgs = await client.query(`
            SELECT o.id, o.name,
                   (SELECT COUNT(*) FROM synced_sheets ss 
                    JOIN workspaces w ON ss.workspace_id = w.id 
                    WHERE w.organization_id = o.id AND ss.team_id IS NULL) as orphan_sheets,
                   (SELECT COUNT(*) FROM tasks t 
                    JOIN projects p ON t.project_id = p.id 
                    WHERE p.organization_id = o.id AND t.team_id IS NULL) as orphan_tasks
            FROM organizations o
            ORDER BY o.name
        `);

        console.log('\n=== Organizations ===\n');
        for (const org of orgs.rows) {
            console.log(`Org: ${org.name}`);
            console.log(`  ID: ${org.id}`);
            console.log(`  Orphan synced_sheets: ${org.orphan_sheets}`);
            console.log(`  Orphan tasks: ${org.orphan_tasks}`);

            const teams = await client.query(
                `SELECT id, team_number, name FROM team_groups WHERE organization_id = $1 ORDER BY team_number`,
                [org.id]
            );
            console.log(`  Teams:`);
            for (const t of teams.rows) {
                console.log(`    - Team ${t.team_number}: ${t.name}  (id: ${t.id})`);
            }
            console.log('');
        }
    } finally {
        client.release();
        await pool.end();
    }
}

async function backfill(orgId, teamId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verify team belongs to org
        const teamCheck = await client.query(
            'SELECT id, name, team_number FROM team_groups WHERE id = $1 AND organization_id = $2',
            [teamId, orgId]
        );
        if (teamCheck.rows.length === 0) {
            throw new Error(`Team ${teamId} not found in organization ${orgId}`);
        }
        const team = teamCheck.rows[0];
        console.log(`\nTarget team: Team ${team.team_number} - ${team.name}\n`);

        // 1. Update orphan synced_sheets
        const sheetsResult = await client.query(
            `UPDATE synced_sheets ss
             SET team_id = $1
             FROM workspaces w
             WHERE ss.workspace_id = w.id
               AND w.organization_id = $2
               AND ss.team_id IS NULL
             RETURNING ss.id, ss.sheet_name`,
            [teamId, orgId]
        );
        console.log(`✓ Updated ${sheetsResult.rows.length} synced_sheets`);
        for (const s of sheetsResult.rows) console.log(`    - ${s.sheet_name}`);

        // 2. Update orphan sheet_tasks (via their synced_sheet)
        const sheetTasksResult = await client.query(
            `UPDATE sheet_tasks st
             SET team_id = $1
             FROM synced_sheets ss, workspaces w
             WHERE st.synced_sheet_id = ss.id
               AND ss.workspace_id = w.id
               AND w.organization_id = $2
               AND st.team_id IS NULL`,
            [teamId, orgId]
        );
        console.log(`✓ Updated ${sheetTasksResult.rowCount} sheet_tasks`);

        // 3. Update orphan regular tasks
        const tasksResult = await client.query(
            `UPDATE tasks t
             SET team_id = $1
             FROM projects p
             WHERE t.project_id = p.id
               AND p.organization_id = $2
               AND t.team_id IS NULL`,
            [teamId, orgId]
        );
        console.log(`✓ Updated ${tasksResult.rowCount} tasks`);

        await client.query('COMMIT');
        console.log(`\n✅ Backfill complete! All orphan WBS now belong to Team ${team.team_number}.\n`);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

const args = process.argv.slice(2);
if (args[0] === '--list' || args.length === 0) {
    listOrgsAndTeams().catch(e => { console.error(e); process.exit(1); });
} else if (args.length === 2) {
    backfill(args[0], args[1]).catch(e => { console.error(e); process.exit(1); });
} else {
    console.log('Usage:');
    console.log('  node backfill-wbs-team.js --list          List orgs and teams');
    console.log('  node backfill-wbs-team.js <org_id> <team_id>   Assign orphan WBS to team');
    process.exit(1);
}
