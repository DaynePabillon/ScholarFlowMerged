const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
  ssl: false,
});

async function purgeWBS() {
  try {
    console.log('Purging all WBS data...\n');

    // 1. Delete all sheet_tasks
    const deleteTasks = await pool.query('DELETE FROM sheet_tasks RETURNING id, title');
    console.log(`✅ Deleted ${deleteTasks.rowCount} sheet_tasks:`);
    deleteTasks.rows.forEach(t => console.log(`   - "${t.title}"`));

    // 2. Delete all synced_sheets
    const deleteSheets = await pool.query('DELETE FROM synced_sheets RETURNING id, sheet_name');
    console.log(`\n✅ Deleted ${deleteSheets.rowCount} synced_sheets:`);
    deleteSheets.rows.forEach(s => console.log(`   - "${s.sheet_name}"`));

    // 3. Verify
    const verifyTasks = await pool.query('SELECT COUNT(*) FROM sheet_tasks');
    const verifySheets = await pool.query('SELECT COUNT(*) FROM synced_sheets');
    
    console.log('\n=== Verification ===');
    console.log(`Remaining sheet_tasks: ${verifyTasks.rows[0].count}`);
    console.log(`Remaining synced_sheets: ${verifySheets.rows[0].count}`);

    if (verifyTasks.rows[0].count === '0' && verifySheets.rows[0].count === '0') {
      console.log('\n✅ All WBS data successfully purged!');
    } else {
      console.log('\n⚠️ Some data may still remain');
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

purgeWBS();
