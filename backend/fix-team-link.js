import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'skyflow',
});

async function fix() {
  try {
    const email = 'waynepabillon667@gmail.com';
    
    // 1. Get User
    const userRes = await pool.query('SELECT id, name FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      console.error('User not found');
      process.exit(1);
    }
    const userId = userRes.rows[0].id;
    const userName = userRes.rows[0].name;

    // 2. Find Team 12 (ScholarSync)
    const teamRes = await pool.query(
      `SELECT tg.id FROM team_groups tg 
       INNER JOIN organizations o ON tg.organization_id = o.id 
       WHERE o.name = 'ScholarSync' AND tg.team_number = 12`
    );
    if (teamRes.rows.length === 0) {
      console.error('Team 12 not found in ScholarSync');
      process.exit(1);
    }
    const teamId = teamRes.rows[0].id;

    // 3. Add User to team_group_members if missing
    const memberCheck = await pool.query(
      'SELECT id FROM team_group_members WHERE team_group_id = $1 AND user_id = $2',
      [teamId, userId]
    );
    if (memberCheck.rows.length === 0) {
      await pool.query(
        `INSERT INTO team_group_members (team_group_id, user_id, member_number, name, email, is_leader)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [teamId, userId, 1, userName, email, true]
      );
      console.log(`Added ${userName} to team_group_members for Team 12`);
    } else {
      console.log(`${userName} is already in team_group_members`);
    }

    // 4. Update existing tasks to have team_id
    const updateRes = await pool.query(
      'UPDATE tasks SET team_id = $1 WHERE assigned_to = $2 AND team_id IS NULL',
      [teamId, userId]
    );
    console.log(`Updated ${updateRes.rowCount} regular tasks with team_id = ${teamId}`);

    const updateSheetRes = await pool.query(
      'UPDATE sheet_tasks SET team_id = $1 WHERE assigned_to = $2 AND team_id IS NULL',
      [teamId, userId]
    );
    console.log(`Updated ${updateSheetRes.rowCount} sheet tasks with team_id = ${teamId}`);

    console.log('Data fix completed successfully');
  } catch (err) {
    console.error('Fix failed:', err);
  } finally {
    await pool.end();
  }
}

fix();
