const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Read the migration file
const migrationSQL = fs.readFileSync(
  path.join(__dirname, 'src/migrations/024_fix_task_deletion_constraints.sql'),
  'utf8'
);

// Create database connection
const pool = new Pool({
  connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Running migration: 024_fix_task_deletion_constraints.sql');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Fixed constraints:');
    console.log('  - task_followers.task_id → ON DELETE CASCADE');
    console.log('  - task_assignees.task_id → ON DELETE CASCADE');
    console.log('  - notifications.task_id → ON DELETE CASCADE');
    console.log('  - task_comments.task_id → ON DELETE CASCADE');
    console.log('  - time_entries.task_id → ON DELETE CASCADE');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
