const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/scholarsync'
});

async function check() {
  try {
    const res = await pool.query(`
      SELECT c.id, c."courseCode", count(tg.id) as team_group_count
      FROM ss_courses c
      LEFT JOIN team_groups tg ON c.id = tg.course_id
      GROUP BY c.id, c."courseCode"
      ORDER BY team_group_count DESC
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
check();
