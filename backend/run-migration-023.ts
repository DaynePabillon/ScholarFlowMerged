import { query } from './src/config/database';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  const migrationPath = path.join(__dirname, 'src', 'migrations', '023_sheet_tasks_wbs_enhancement.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  try {
    console.log('Running migration 023_sheet_tasks_wbs_enhancement.sql...');
    await query(sql);
    console.log('✅ Migration successful');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
