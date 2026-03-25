import { query } from './src/config/database';

async function checkSchema() {
  try {
    const wsResult = await query(`SELECT id, organization_id, created_by, name FROM workspaces`);
    console.log('Workspaces:');
    wsResult.rows.forEach(row => {
      console.log(`- ${row.name} (ID: ${row.id}, Org: ${row.organization_id}, CreatedBy: ${row.created_by})`);
    });

    const orgsResult = await query(`SELECT id, name FROM organizations`);
    console.log('Organizations:');
    orgsResult.rows.forEach(row => {
      console.log(`- ${row.name} (ID: ${row.id})`);
    });

    const membersResult = await query(`SELECT organization_id, user_id, role FROM organization_members`);
    console.log('Organization Members:');
    membersResult.rows.forEach(row => {
      console.log(`- Org: ${row.organization_id}, User: ${row.user_id}, Role: ${row.role}`);
    });

  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    process.exit();
  }
}

checkSchema();
