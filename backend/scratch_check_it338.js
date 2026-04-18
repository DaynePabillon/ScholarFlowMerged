const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres'
});

async function check() {
  try {
    const res = await pool.query(`
      SELECT c.id, c."courseCode", c."courseName", count(tg.id) as team_group_count
      FROM ss_courses c
      LEFT JOIN team_groups tg ON c.id = tg.course_id
      WHERE c."courseCode" = 'IT338'
      GROUP BY c.id, c."courseCode", c."courseName"
    `);
    console.log('Results:', JSON.stringify(res.rows, null, 2));
    
    if (res.rows[0]) {
        const groups = await pool.query('SELECT name, team_number FROM team_groups WHERE course_id = $1', [res.rows[0].id]);
        console.log('Actual Groups:', groups.rows);
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}
check();
