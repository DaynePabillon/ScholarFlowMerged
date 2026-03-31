import { WorkspaceSyncService } from './src/services/workspace.service';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

// Override the query function
jest.mock('./src/config/database', () => {
    const pool = new Pool({
        connectionString: 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
        ssl: { rejectUnauthorized: false }
    });
    return {
        query: (text: string, params?: any[]) => pool.query(text, params),
        pool
    };
});

import { query } from './src/config/database';

async function testParse() {
  try {
    const service = new WorkspaceSyncService();
    
    const res = await query('SELECT * FROM synced_sheets WHERE sheet_name = $1 LIMIT 1', ['Imported via URL']);
    if (res.rows.length === 0) {
      console.log('Test sheet not found.');
      return;
    }
    
    const sheet = res.rows[0];
    console.log(`Testing extraction for: ${sheet.sheet_name}`);
    
    const columnMapping = await service.detectColumnMapping(sheet.created_by, sheet.sheet_id);
    console.log(`Detected mapping:`, JSON.stringify(columnMapping));
    
    const tasks = await service.parseSheetTasks(sheet.created_by, sheet.sheet_id, columnMapping);
    console.log(`Parsed ${tasks.length} tasks.`);
    
    if (tasks.length > 0) {
      console.log('Sample task 1:', JSON.stringify(tasks[0], null, 2));
    }
    
  } catch (error) {
    console.error('Error running test:', error);
  } finally {
    process.exit(0);
  }
}

testParse();
