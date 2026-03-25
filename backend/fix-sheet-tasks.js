const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
});

async function fixSheetTasks() {
  try {
    console.log('Adding missing columns to sheet_tasks table...\n');

    await pool.query(`
      ALTER TABLE sheet_tasks ADD COLUMN IF NOT EXISTS team_id UUID;
      ALTER TABLE sheet_tasks ADD COLUMN IF NOT EXISTS wbs_code VARCHAR(100);
      ALTER TABLE sheet_tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID;
      ALTER TABLE sheet_tasks ADD COLUMN IF NOT EXISTS complexity_weight INTEGER DEFAULT 1;
      ALTER TABLE sheet_tasks ADD COLUMN IF NOT EXISTS is_absolute BOOLEAN DEFAULT FALSE;
      ALTER TABLE sheet_tasks ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;
    `);
    console.log('✅ All missing columns added to sheet_tasks!');

    // Register migration
    await pool.query(`
      INSERT INTO _migrations (name) VALUES ('025_add_sheet_tasks_columns')
      ON CONFLICT DO NOTHING;
    `);
    console.log('✅ Migration registered.');

    // Verify columns exist
    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'sheet_tasks' 
      ORDER BY ordinal_position
    `);
    console.log('\nsheet_tasks columns:');
    cols.rows.forEach(r => console.log('  -', r.column_name));

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

fixSheetTasks();
