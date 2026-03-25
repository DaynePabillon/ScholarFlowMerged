const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
  ssl: false,
});

async function fix() {
  try {
    // Check tasks table columns
    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'tasks' ORDER BY ordinal_position
    `);
    console.log('tasks table columns:');
    cols.rows.forEach(r => console.log('  -', r.column_name));

    const hasTeamId = cols.rows.some(r => r.column_name === 'team_id');
    const hasIsAbsolute = cols.rows.some(r => r.column_name === 'is_absolute');
    const hasWbsCode = cols.rows.some(r => r.column_name === 'wbs_code');
    const hasComplexityWeight = cols.rows.some(r => r.column_name === 'complexity_weight');
    const hasParentTaskId = cols.rows.some(r => r.column_name === 'parent_task_id');

    console.log('\nMissing columns check:');
    console.log('  team_id:', hasTeamId ? 'EXISTS' : 'MISSING');
    console.log('  is_absolute:', hasIsAbsolute ? 'EXISTS' : 'MISSING');
    console.log('  wbs_code:', hasWbsCode ? 'EXISTS' : 'MISSING');
    console.log('  complexity_weight:', hasComplexityWeight ? 'EXISTS' : 'MISSING');
    console.log('  parent_task_id:', hasParentTaskId ? 'EXISTS' : 'MISSING');

    // Add missing columns
    const additions = [];
    if (!hasTeamId) additions.push('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS team_id UUID;');
    if (!hasIsAbsolute) additions.push('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_absolute BOOLEAN DEFAULT FALSE;');
    if (!hasWbsCode) additions.push('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS wbs_code VARCHAR(100);');
    if (!hasComplexityWeight) additions.push('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS complexity_weight INTEGER DEFAULT 1;');
    if (!hasParentTaskId) additions.push('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID;');

    if (additions.length > 0) {
      console.log('\nAdding missing columns...');
      await pool.query(additions.join('\n'));
      console.log('✅ All missing columns added to tasks table!');
    } else {
      console.log('\n✅ No missing columns.');
    }

    // Register migration
    await pool.query(`
      INSERT INTO _migrations (name) VALUES ('026_add_tasks_missing_columns')
      ON CONFLICT DO NOTHING;
    `);

    // Re-test the union query
    console.log('\n=== Re-testing UNION query ===');
    const orgId = 'e957de9d-b8ad-49e2-a009-9a0cef790c7f';
    const result = await pool.query(`
      SELECT t.id, t.team_id, t.title, t.status, t.is_absolute, 'app' as source_type
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE p.organization_id = $1
      
      UNION ALL
      
      SELECT st.id, COALESCE(st.team_id, ss.team_id) as team_id, st.title, st.status, st.is_absolute, 'sheet' as source_type
      FROM sheet_tasks st
      JOIN synced_sheets ss ON st.synced_sheet_id = ss.id
      JOIN workspaces w ON ss.workspace_id = w.id
      LEFT JOIN projects p ON st.project_id = p.id
      WHERE w.organization_id = $1
    `, [orgId]);
    
    console.log(`Total rows: ${result.rows.length}`);
    result.rows.forEach(r => console.log(`  [${r.source_type}] "${r.title}" | status=${r.status} | is_absolute=${r.is_absolute} | team_id=${r.team_id}`));

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

fix();
