const { Pool } = require('pg');

// Use the EXACT same connection as the backend
const pool = new Pool({
  connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
  ssl: false,
});

const orgId = 'e957de9d-b8ad-49e2-a009-9a0cef790c7f';
const teamId = 'f7f7ee8d-1155-43be-b1c2-d2fcedae9b38';

async function debugQuery() {
  try {
    // 1. Test basic sheet_tasks query
    console.log('=== 1. Basic sheet_tasks ===');
    const basic = await pool.query(`SELECT id, title, status, is_absolute, team_id FROM sheet_tasks LIMIT 5`);
    console.log(`Rows: ${basic.rows.length}`);
    basic.rows.forEach(r => console.log(`  "${r.title}" | is_absolute=${r.is_absolute} | team_id=${r.team_id}`));

    // 2. Test the UNION query (simplified) WITHOUT team filter
    console.log('\n=== 2. UNION query (no team filter) ===');
    try {
      const union1 = await pool.query(`
        SELECT t.id, t.project_id, t.team_id, t.title, t.description, t.status, t.priority,
              t.due_date, t.estimated_hours, t.actual_hours, t.assigned_to, t.created_by,
              t.created_at, t.updated_at, t.is_absolute, t.complexity_weight, t.wbs_code, t.parent_task_id,
              p.name as project_name,
              u1.name as assigned_to_name,
              u1.email as assigned_to_email,
              u2.name as created_by_name,
              'app' as source_type,
              NULL as sheet_name,
              NULL as google_sheet_id,
              (SELECT COUNT(*) FROM task_comments WHERE task_id = t.id)::integer as comment_count
       FROM tasks t
       LEFT JOIN projects p ON t.project_id = p.id
       LEFT JOIN users u1 ON t.assigned_to = u1.id
       LEFT JOIN users u2 ON t.created_by = u2.id
       WHERE p.organization_id = $1
       
       UNION ALL
       
       SELECT 
         st.id,
         st.project_id,
         COALESCE(st.team_id, ss.team_id) as team_id,
         st.title,
         st.description,
         st.status,
         st.priority,
         st.due_date,
         NULL::integer as estimated_hours,
         NULL::integer as actual_hours,
         NULL::uuid as assigned_to,
         NULL::uuid as created_by,
         st.created_at,
         st.updated_at,
         st.is_absolute,
         st.complexity_weight,
         st.wbs_code,
         st.parent_task_id,
         COALESCE(p.name, NULL) as project_name,
         st.assignee_email as assigned_to_name,
         st.assignee_email as assigned_to_email,
         'Google Sheets' as created_by_name,
         'sheet' as source_type,
         ss.sheet_name,
         ss.sheet_id as google_sheet_id,
         (SELECT COUNT(*) FROM task_comments WHERE task_id = st.id)::integer as comment_count
       FROM sheet_tasks st
       JOIN synced_sheets ss ON st.synced_sheet_id = ss.id
       JOIN workspaces w ON ss.workspace_id = w.id
       LEFT JOIN projects p ON st.project_id = p.id
       WHERE w.organization_id = $1
       
       ORDER BY created_at DESC
      `, [orgId]);
      
      console.log(`Total rows: ${union1.rows.length}`);
      union1.rows.forEach(r => console.log(`  [${r.source_type}] "${r.title}" | status=${r.status} | is_absolute=${r.is_absolute} | team_id=${r.team_id} | sheet=${r.sheet_name}`));
    } catch (err) {
      console.error('UNION query FAILED:', err.message);
    }

    // 3. Test with team filter
    console.log('\n=== 3. UNION query (with team filter) ===');
    try {
      const union2 = await pool.query(`
        SELECT t.id, t.project_id, t.team_id, t.title, t.status, t.is_absolute, 'app' as source_type
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE p.organization_id = $1 AND t.team_id = $2
        
        UNION ALL
        
        SELECT st.id, st.project_id, COALESCE(st.team_id, ss.team_id) as team_id, st.title, st.status, st.is_absolute, 'sheet' as source_type
        FROM sheet_tasks st
        JOIN synced_sheets ss ON st.synced_sheet_id = ss.id
        JOIN workspaces w ON ss.workspace_id = w.id
        LEFT JOIN projects p ON st.project_id = p.id
        WHERE w.organization_id = $1 AND COALESCE(st.team_id, ss.team_id) = $2
        
        ORDER BY source_type
      `, [orgId, teamId]);
      
      console.log(`Total rows: ${union2.rows.length}`);
      union2.rows.forEach(r => console.log(`  [${r.source_type}] "${r.title}" | status=${r.status} | is_absolute=${r.is_absolute} | team_id=${r.team_id}`));
    } catch (err) {
      console.error('Filtered UNION query FAILED:', err.message);
    }

    // 4. Check workspaces for this org
    console.log('\n=== 4. Workspaces for this org ===');
    const ws = await pool.query(`SELECT id, name, organization_id FROM workspaces WHERE organization_id = $1`, [orgId]);
    console.log(`Workspaces: ${ws.rows.length}`);
    ws.rows.forEach(r => console.log(`  id=${r.id} | name="${r.name}" | org=${r.organization_id}`));

    await pool.end();
  } catch (error) {
    console.error('Fatal error:', error.message);
    await pool.end();
  }
}

debugQuery();
