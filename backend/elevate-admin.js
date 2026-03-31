const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function elevateAdmin() {
  const email = 'waynepabillon667@gmail.com';
  console.log(`🚀 Elevating ${email} to Admin...`);

  try {
    // 1. Get User ID
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      console.log(`❌ User with email ${email} not found in 'users' table.`);
      process.exit(1);
    }
    const userId = userRes.rows[0].id;
    console.log(`✅ Found User ID: ${userId}`);

    // 2. Add/Update Global Role if column exists
    try {
      await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', userId]);
      console.log('✅ Global User role updated to admin');
    } catch (e) {
      console.log('⚠️ Skipping users.role update (column might not exist)');
    }

    // 3. Update Organization Membership (PM Side)
    // Make them admin in ALL organizations they belong to
    await pool.query(
      "UPDATE organization_members SET role = 'admin', status = 'active' WHERE user_id = $1",
      [userId]
    );
    console.log('✅ Organization roles updated to admin');

    // 4. Update ScholarSync (Academic Side)
    try {
      const ssUpdate = await pool.query(
        'UPDATE ss_account SET "accountRole" = $1 WHERE "accountEmail" = $2 RETURNING *',
        ['Admin', email]
      );
      if (ssUpdate.rows.length > 0) {
        console.log('✅ ScholarSync role updated to Admin');
      } else {
        console.log('⚠️ No record found in ss_account for this email. Skipping Academic side.');
      }
    } catch (e) {
      console.log('⚠️ Skipping ss_account update (table might not exist yet)');
    }

    console.log('🎉 Elevation complete for all available systems!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during elevation:', err);
    process.exit(1);
  }
}

elevateAdmin();
