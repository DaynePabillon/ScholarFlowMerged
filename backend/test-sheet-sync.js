const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

async function testSheetSync() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking synced_sheets table...\n');
    
    // Get all synced sheets
    const sheetsResult = await client.query(`
      SELECT ss.id, ss.sheet_id, ss.sheet_name, ss.workspace_id, ss.sync_status, 
             ss.last_synced_at, ss.row_count, ss.column_mapping,
             w.name as workspace_name, w.organization_id
      FROM synced_sheets ss
      JOIN workspaces w ON ss.workspace_id = w.id
      ORDER BY ss.created_at DESC
      LIMIT 5
    `);
    
    if (sheetsResult.rows.length === 0) {
      console.log('❌ No synced sheets found in database');
      console.log('\nTo connect a sheet, use:');
      console.log('POST /api/workspaces/:workspaceId/connect-sheet');
      console.log('Body: { "sheetId": "your-google-sheet-id", "sheetName": "Sheet Name" }');
      return;
    }
    
    console.log(`✅ Found ${sheetsResult.rows.length} synced sheet(s):\n`);
    
    sheetsResult.rows.forEach((sheet, idx) => {
      console.log(`${idx + 1}. ${sheet.sheet_name}`);
      console.log(`   Sheet ID: ${sheet.sheet_id}`);
      console.log(`   Workspace: ${sheet.workspace_name}`);
      console.log(`   Status: ${sheet.sync_status}`);
      console.log(`   Last Synced: ${sheet.last_synced_at || 'Never'}`);
      console.log(`   Row Count: ${sheet.row_count || 0}`);
      console.log(`   Column Mapping: ${JSON.stringify(sheet.column_mapping || {})}`);
      console.log('');
    });
    
    // Check sheet_tasks for each synced sheet
    console.log('📊 Checking extracted tasks...\n');
    
    for (const sheet of sheetsResult.rows) {
      const tasksResult = await client.query(
        'SELECT COUNT(*) as count FROM sheet_tasks WHERE synced_sheet_id = $1',
        [sheet.id]
      );
      
      const taskCount = parseInt(tasksResult.rows[0].count);
      console.log(`Sheet "${sheet.sheet_name}": ${taskCount} task(s) extracted`);
      
      if (taskCount > 0) {
        const sampleTasks = await client.query(
          `SELECT title, status, priority, assignee_email, wbs_code, is_absolute 
           FROM sheet_tasks 
           WHERE synced_sheet_id = $1 
           LIMIT 3`,
          [sheet.id]
        );
        
        console.log('  Sample tasks:');
        sampleTasks.rows.forEach((task, i) => {
          console.log(`    ${i + 1}. ${task.title}`);
          console.log(`       Status: ${task.status}, Priority: ${task.priority}`);
          console.log(`       Assignee: ${task.assignee_email || 'Unassigned'}`);
          console.log(`       WBS: ${task.wbs_code || 'N/A'}, Absolute: ${task.is_absolute}`);
        });
      }
      console.log('');
    }
    
    console.log('\n💡 To manually trigger sync:');
    console.log('POST /api/workspaces/:workspaceId/sync');
    console.log('\nOr for a specific sheet:');
    console.log('Use the WorkspaceSyncService.syncSheet(syncedSheetId) method');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    client.release();
    await pool.end();
  }
}

testSheetSync();
