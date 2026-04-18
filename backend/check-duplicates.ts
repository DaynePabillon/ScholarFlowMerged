import { pool } from './src/config/database';

async function checkDuplicates() {
    try {
        const teamGroups = await pool.query('SELECT id, team_number, name, proposed_project, adviser_name, course_id FROM team_groups ORDER BY id DESC LIMIT 15');
        console.table(teamGroups.rows);

        const projectRecords = await pool.query('SELECT id, team_group_id, name, description FROM projects ORDER BY id DESC LIMIT 15');
        console.table(projectRecords.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkDuplicates();
