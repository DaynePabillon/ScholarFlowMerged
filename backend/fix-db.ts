import { query } from './src/config/database';

async function fix() {
  console.log('Starting schema fix...');
  try {
    await query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress_percent INTEGER DEFAULT 0');
    await query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS team_id UUID');
    await query('ALTER TABLE sheet_tasks ADD COLUMN IF NOT EXISTS progress_percent INTEGER DEFAULT 0');
    await query('ALTER TABLE sheet_tasks ADD COLUMN IF NOT EXISTS team_id UUID');
    console.log('✅ Success: Columns verified/created');
  } catch (err: any) {
    console.error('❌ Error fixing schema:', err.message);
  }
  process.exit(0);
}

fix();
