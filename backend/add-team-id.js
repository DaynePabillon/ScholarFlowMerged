const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
});

async function addTeamId() {
  try {
    console.log('Adding team_id column to synced_sheets...');
    
    await pool.query(`
      ALTER TABLE synced_sheets 
      ADD COLUMN IF NOT EXISTS team_id UUID;
    `);
    
    console.log('✅ team_id column added successfully!');

    // Also register migration so it won't re-run
    await pool.query(`
      INSERT INTO _migrations (name) VALUES ('024_add_team_id_to_synced_sheets')
      ON CONFLICT DO NOTHING;
    `);
    console.log('✅ Migration registered.');

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

addTeamId();
