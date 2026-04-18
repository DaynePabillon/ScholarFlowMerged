const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres'
});

async function check() {
  try {
    const res = await pool.query('SELECT id, "courseCode", "courseName" FROM ss_courses ORDER BY id DESC');
    console.log('Courses:', JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}
check();
