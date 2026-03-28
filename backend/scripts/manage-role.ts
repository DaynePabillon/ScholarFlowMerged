import { pool } from '../src/config/database';
import logger from '../src/config/logger';

async function manageRole() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: npx ts-node scripts/manage-role.ts <email> <role>');
    console.log('Roles: admin, advisor, student');
    process.exit(1);
  }

  const email = args[0];
  const targetRole = args[1].toLowerCase();

  let dbRole = 'member';
  if (targetRole === 'admin') dbRole = 'admin';
  else if (targetRole === 'advisor') dbRole = 'manager';
  else if (targetRole === 'student') dbRole = 'member';

  try {
    console.log(`🔍 Finding user with email: ${email}...`);
    const userRes = await pool.query('SELECT id, name FROM users WHERE email = $1', [email]);
    
    if (userRes.rows.length === 0) {
      console.error(`❌ User not found with email: ${email}`);
      process.exit(1);
    }

    const userId = userRes.rows[0].id;
    const userName = userRes.rows[0].name;

    console.log(`👤 Found user: ${userName} (${userId})`);

    // Update role in organization_members
    const updateRes = await pool.query(
      `UPDATE organization_members 
       SET role = $1, status = 'active' 
       WHERE user_id = $2 
       RETURNING *`,
      [dbRole, userId]
    );

    if (updateRes.rows.length === 0) {
      // If not in any organization, add them to the first one or create a default
      const orgRes = await pool.query('SELECT id FROM organizations LIMIT 1');
      if (orgRes.rows.length > 0) {
        const orgId = orgRes.rows[0].id;
        await pool.query(
          `INSERT INTO organization_members (organization_id, user_id, role, status)
           VALUES ($1, $2, $3, 'active')`,
          [orgId, userId, dbRole]
        );
        console.log(`✅ Added user to organization ${orgId} as ${dbRole}`);
      } else {
        console.error('❌ No organizations found to add user to.');
      }
    } else {
      console.log(`✅ Updated role to: ${dbRole}`);
    }

    // Also ensure onboarding is completed so they see the dashboard
    await pool.query('UPDATE users SET onboarding_completed = true WHERE id = $1', [userId]);
    console.log('✅ Onboarding marked as completed.');

    console.log('\n🎉 Done! Please refresh your browser.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error updating role:', error);
    process.exit(1);
  }
}

manageRole();
