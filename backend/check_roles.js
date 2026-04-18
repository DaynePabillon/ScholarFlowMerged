
import { pool } from './src/config/database';
import logger from './src/config/logger';
import dotenv from 'dotenv';
dotenv.config();

async function checkRoles() {
  try {
    const ssAccountRoles = await pool.query('SELECT DISTINCT "accountRole" FROM ss_account');
    console.log('Roles in ss_account:');
    ssAccountRoles.rows.forEach(r => console.log(` - ${r.accountRole}`));

    const userRoles = await pool.query('SELECT DISTINCT "role" FROM users');
    console.log('\nRoles in users:');
    userRoles.rows.forEach(r => console.log(` - ${r.role}`));

    const orgMemberRoles = await pool.query('SELECT DISTINCT "role" FROM organization_members');
    console.log('\nRoles in organization_members:');
    orgMemberRoles.rows.forEach(r => console.log(` - ${r.role}`));

  } catch (err) {
    console.error('Error checking roles:', err);
  } finally {
    process.exit(0);
  }
}

checkRoles();
