const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
});

async function debugTasks() {
  try {
    // Check sheet_tasks
    const sheetTasks = await pool.query(`
      SELECT st.id, st.title, st.status, st.is_absolute, st.team_id, st.wbs_code, 
             st.synced_sheet_id, st.sheet_row_index, st.complexity_weight,
             ss.sheet_name, ss.team_id as ss_team_id, ss.workspace_id
      FROM sheet_tasks st
      JOIN synced_sheets ss ON st.synced_sheet_id = ss.id
      ORDER BY st.created_at DESC
      LIMIT 20
    `);
    
    console.log(`\n=== sheet_tasks (${sheetTasks.rows.length} rows) ===`);
    sheetTasks.rows.forEach(r => {
      console.log(`  Title: "${r.title}" | Status: ${r.status} | is_absolute: ${r.is_absolute} | team_id: ${r.team_id} | ss_team_id: ${r.ss_team_id} | wbs: ${r.wbs_code} | sheet: ${r.sheet_name}`);
    });

    // Check synced_sheets
    const sheets = await pool.query(`
      SELECT ss.id, ss.sheet_name, ss.workspace_id, ss.team_id, ss.sync_status, ss.row_count,
             w.organization_id, w.name as workspace_name
      FROM synced_sheets ss
      JOIN workspaces w ON ss.workspace_id = w.id
      ORDER BY ss.created_at DESC
    `);
    
    console.log(`\n=== synced_sheets (${sheets.rows.length} rows) ===`);
    sheets.rows.forEach(r => {
      console.log(`  Sheet: "${r.sheet_name}" | team_id: ${r.team_id} | org: ${r.organization_id} | workspace: ${r.workspace_name} | status: ${r.sync_status} | rows: ${r.row_count}`);
    });

    // Check if the UNION query works
    if (sheets.rows.length > 0) {
      const orgId = sheets.rows[0].organization_id;
      console.log(`\n=== Testing UNION query for org ${orgId} ===`);
      
      const unionResult = await pool.query(`
        SELECT t.id, t.title, t.status, t.is_absolute, 'app' as source_type, NULL as sheet_name
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE p.organization_id = $1
        
        UNION ALL
        
        SELECT st.id, st.title, st.status, st.is_absolute, 'sheet' as source_type, ss.sheet_name
        FROM sheet_tasks st
        JOIN synced_sheets ss ON st.synced_sheet_id = ss.id
        JOIN workspaces w ON ss.workspace_id = w.id
        WHERE w.organization_id = $1
        
        ORDER BY source_type
      `, [orgId]);
      
      console.log(`Total tasks from UNION: ${unionResult.rows.length}`);
      unionResult.rows.forEach(r => {
        console.log(`  [${r.source_type}] "${r.title}" | status: ${r.status} | is_absolute: ${r.is_absolute} | sheet: ${r.sheet_name}`);
      });
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

debugTasks();
