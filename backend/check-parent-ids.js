const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
  ssl: false,
});

async function checkParentIds() {
  try {
    const orgId = 'e957de9d-b8ad-49e2-a009-9a0cef790c7f';
    const teamId = 'f7f7ee8d-1155-43be-b1c2-d2fcedae9b38';
    
    // Get all tasks with their parent_task_id
    const result = await pool.query(`
      SELECT st.id, st.title, st.status, st.wbs_code, st.parent_task_id, st.is_absolute,
             COALESCE(st.team_id, ss.team_id) as team_id
      FROM sheet_tasks st
      JOIN synced_sheets ss ON st.synced_sheet_id = ss.id
      JOIN workspaces w ON ss.workspace_id = w.id
      WHERE w.organization_id = $1 AND COALESCE(st.team_id, ss.team_id) = $2
      ORDER BY st.wbs_code
    `, [orgId, teamId]);
    
    console.log('All WBS tasks:');
    result.rows.forEach(t => {
      console.log(`  WBS ${t.wbs_code}: "${t.title}" | status=${t.status} | parent_task_id=${t.parent_task_id}`);
    });

    // Check if any parent_task_id references exist
    console.log('\nParent-child relationships:');
    result.rows.forEach(t => {
      if (t.parent_task_id) {
        const parent = result.rows.find(p => p.id === t.parent_task_id);
        if (parent) {
          console.log(`  "${t.title}" (${t.wbs_code}) is child of "${parent.title}" (${parent.wbs_code})`);
        } else {
          console.log(`  ⚠️ "${t.title}" (${t.wbs_code}) has parent_task_id=${t.parent_task_id} but parent NOT FOUND`);
        }
      }
    });

    // Check tasks by status
    console.log('\nTasks by status:');
    const byStatus = {};
    result.rows.forEach(t => {
      if (!byStatus[t.status]) byStatus[t.status] = [];
      byStatus[t.status].push(t);
    });
    Object.keys(byStatus).forEach(status => {
      console.log(`  ${status}: ${byStatus[status].length} tasks`);
      byStatus[status].forEach(t => console.log(`    - "${t.title}" (parent_task_id: ${t.parent_task_id})`));
    });

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

checkParentIds();
