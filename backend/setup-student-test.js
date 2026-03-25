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

async function setup() {
  try {
    const email = 'waynepabillon667@gmail.com';
    
    // 1. Get User
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      console.error('User not found');
      process.exit(1);
    }
    const userId = userRes.rows[0].id;
    console.log(`Found user ID: ${userId}`);

    // 2. Find Organization (ScholarSync)
    const orgRes = await pool.query('SELECT id FROM organizations WHERE name = $1', ['ScholarSync']);
    if (orgRes.rows.length === 0) {
        console.error('Organization ScholarSync not found');
        process.exit(1);
    }
    const orgId = orgRes.rows[0].id;

    // 3. Update Organization Role to 'member'
    await pool.query(
      'UPDATE organization_members SET role = $1 WHERE organization_id = $2 AND user_id = $3',
      ['member', orgId, userId]
    );
    console.log('Updated organization role to member (student)');

    // 4. Find or Create Workspace "Group 12"
    let workspaceRes = await pool.query('SELECT id FROM workspaces WHERE name = $1 AND organization_id = $2', ['Group 12', orgId]);
    let workspaceId;
    if (workspaceRes.rows.length === 0) {
      const newWs = await pool.query(
        'INSERT INTO workspaces (name, organization_id, description) VALUES ($1, $2, $3) RETURNING id',
        ['Group 12', orgId, 'Student Test Group']
      );
      workspaceId = newWs.rows[0].id;
      console.log('Created Group 12 workspace');
    } else {
      workspaceId = workspaceRes.rows[0].id;
      console.log('Found existing Group 12 workspace');
    }

    // 5. Assign user to Group 12 (workspace_members)
    // Clear old memberships first to be clean
    await pool.query('DELETE FROM workspace_members WHERE user_id = $1', [userId]);
    await pool.query(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [workspaceId, userId, 'member']
    );
    console.log('Assigned user to Group 12');

    // 6. Create a project in Group 12 if none exists
    let projectRes = await pool.query('SELECT id FROM projects WHERE workspace_id = $1', [workspaceId]);
    let projectId;
    if (projectRes.rows.length === 0) {
        const newProj = await pool.query(
            'INSERT INTO projects (name, workspace_id, organization_id) VALUES ($1, $2, $3) RETURNING id',
            ['Main Project', workspaceId, orgId]
        );
        projectId = newProj.rows[0].id;
    } else {
        projectId = projectRes.rows[0].id;
    }

    // 7. Create sample tasks
    // First, clear existing tasks for this user to avoid clutter
    await pool.query('DELETE FROM tasks WHERE assigned_to = $1', [userId]);
    
    // Task 1: Internal Todo
    await pool.query(
      'INSERT INTO tasks (title, description, status, project_id, assigned_to, priority, is_absolute) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      ['Verify Team Board View', 'Check if you can see this task in the Team Board tab.', 'todo', projectId, userId, 'high', false]
    );

    // Task 2: Internal In Progress
    await pool.query(
      'INSERT INTO tasks (title, description, status, project_id, assigned_to, priority, is_absolute) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      ['Test Notification System', 'Change the status of this task to see if it triggers an activity log.', 'in_progress', projectId, userId, 'medium', false]
    );

    // Task 3: Internal Completed
    await pool.query(
      'INSERT INTO tasks (title, description, status, project_id, assigned_to, priority, is_absolute) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      ['Onboarding Setup', 'This task represents your successful switch to the student role.', 'done', projectId, userId, 'low', false]
    );

    console.log('Successfully setup student test environment for waynepabillon667@gmail.com');
  } catch (err) {
    console.error('Setup failed:', err);
  } finally {
    await pool.end();
  }
}

setup();
