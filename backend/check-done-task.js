const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
  ssl: false,
});

async function checkDoneTask() {
  try {
    // Check the exact status value
    const result = await pool.query(`
      SELECT st.id, st.title, st.status, st.is_absolute, st.team_id,
             ss.sheet_name, ss.team_id as ss_team_id
      FROM sheet_tasks st
      JOIN synced_sheets ss ON st.synced_sheet_id = ss.id
      WHERE st.title = 'Database Schema'
    `);
    
    console.log('Database Schema task:');
    if (result.rows.length > 0) {
      const task = result.rows[0];
      console.log(`  Title: "${task.title}"`);
      console.log(`  Status: "${task.status}" (length: ${task.status.length})`);
      console.log(`  Status bytes:`, Buffer.from(task.status).toString('hex'));
      console.log(`  is_absolute: ${task.is_absolute}`);
      console.log(`  team_id: ${task.team_id}`);
      console.log(`  sheet.team_id: ${task.ss_team_id}`);
      
      // Check if it matches 'done'
      console.log(`\n  Matches 'done': ${task.status === 'done'}`);
      console.log(`  Matches 'completed': ${task.status === 'completed'}`);
      console.log(`  Lowercase: "${task.status.toLowerCase()}"`);
      console.log(`  Trimmed: "${task.status.trim()}"`);
    } else {
      console.log('  Task not found!');
    }

    // Check what the API returns
    console.log('\n=== Testing API query ===');
    const orgId = 'e957de9d-b8ad-49e2-a009-9a0cef790c7f';
    const teamId = 'f7f7ee8d-1155-43be-b1c2-d2fcedae9b38';
    
    const apiResult = await pool.query(`
      SELECT st.id, st.title, st.status, st.is_absolute,
             COALESCE(st.team_id, ss.team_id) as team_id
      FROM sheet_tasks st
      JOIN synced_sheets ss ON st.synced_sheet_id = ss.id
      JOIN workspaces w ON ss.workspace_id = w.id
      WHERE w.organization_id = $1 AND COALESCE(st.team_id, ss.team_id) = $2
      ORDER BY st.title
    `, [orgId, teamId]);
    
    console.log(`\nAPI would return ${apiResult.rows.length} tasks:`);
    apiResult.rows.forEach(t => {
      console.log(`  "${t.title}" | status="${t.status}" | is_absolute=${t.is_absolute}`);
    });

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

checkDoneTask();
