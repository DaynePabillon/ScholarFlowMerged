import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const emailRes = await pool.query("SELECT id, email, role FROM users WHERE email ILIKE '%dayne%'");
    console.log('Users:', emailRes.rows);
    
    if (emailRes.rows.length > 0) {
      const userId = emailRes.rows[0].id;
      const orgRes = await pool.query("SELECT o.name, om.role FROM organization_members om JOIN organizations o ON om.organization_id = o.id WHERE om.user_id = $1", [userId]);
      console.log('Orgs:', orgRes.rows);
      
      const ssRes = await pool.query("SELECT * FROM ss_account WHERE \"accountEmail\" = $1", [emailRes.rows[0].email]);
      console.log('SS Account:', ssRes.rows);
    }
  } catch(e) { console.error(e); }
  finally { pool.end(); }
}
run();
