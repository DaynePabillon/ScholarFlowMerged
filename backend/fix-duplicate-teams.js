const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixDuplicateTeams() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('=== STEP 1: Finding duplicate teams ===');
    
    // Find all teams with duplicate team_number within the same organization
    const duplicatesQuery = `
      SELECT organization_id, team_number, COUNT(*) as count, 
             ARRAY_AGG(id ORDER BY created_at ASC) as team_ids,
             ARRAY_AGG(name ORDER BY created_at ASC) as team_names,
             ARRAY_AGG(created_at ORDER BY created_at ASC) as created_dates
      FROM team_groups
      GROUP BY organization_id, team_number
      HAVING COUNT(*) > 1
      ORDER BY organization_id, team_number;
    `;
    
    const duplicates = await client.query(duplicatesQuery);
    
    if (duplicates.rows.length === 0) {
      console.log('✅ No duplicate teams found!');
      await client.query('COMMIT');
      return;
    }
    
    console.log(`Found ${duplicates.rows.length} sets of duplicate teams:\n`);
    
    let totalDeleted = 0;
    
    for (const dup of duplicates.rows) {
      console.log(`Organization: ${dup.organization_id}`);
      console.log(`Team Number: ${dup.team_number}`);
      console.log(`Duplicates: ${dup.count}`);
      console.log('Team IDs:', dup.team_ids);
      console.log('Names:', dup.team_names);
      console.log('Created:', dup.created_dates);
      
      // Keep the FIRST (oldest) team, delete the rest
      const keepId = dup.team_ids[0];
      const deleteIds = dup.team_ids.slice(1);
      
      console.log(`  → Keeping: ${keepId} (${dup.team_names[0]})`);
      console.log(`  → Deleting: ${deleteIds.join(', ')}\n`);
      
      // Delete the duplicate teams (CASCADE will handle members, checkpoints, comments)
      for (const deleteId of deleteIds) {
        await client.query('DELETE FROM team_groups WHERE id = $1', [deleteId]);
        totalDeleted++;
      }
    }
    
    console.log(`=== STEP 2: Deleted ${totalDeleted} duplicate teams ===\n`);
    
    console.log('=== STEP 3: Adding unique constraint ===');
    
    // Add unique constraint to prevent future duplicates
    await client.query(`
      ALTER TABLE team_groups 
      DROP CONSTRAINT IF EXISTS unique_team_per_org;
    `);
    
    await client.query(`
      ALTER TABLE team_groups 
      ADD CONSTRAINT unique_team_per_org 
      UNIQUE (organization_id, team_number);
    `);
    
    console.log('✅ Added unique constraint: unique_team_per_org');
    
    await client.query('COMMIT');
    
    console.log('\n=== SUCCESS: All duplicates removed and constraint added ===');
    
    // Show final team count
    const finalCount = await client.query('SELECT COUNT(*) FROM team_groups');
    console.log(`\nFinal team count: ${finalCount.rows[0].count}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error fixing duplicates:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixDuplicateTeams()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Script failed:', err);
    process.exit(1);
  });
