import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'skyflow',
});

async function test() {
  const res = await pool.query('SELECT id, title, status FROM tasks LIMIT 5');
  console.log('Tasks:', res.rows);
  const res2 = await pool.query('SELECT id, title, status FROM sheet_tasks LIMIT 5');
  console.log('Sheet Tasks:', res2.rows);
  process.exit(0);
}

test();
