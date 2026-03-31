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

async function runSync() {
  try {
    const service = new WorkspaceSyncService();
    
    const res = await query('SELECT id FROM synced_sheets WHERE sheet_name = $1 LIMIT 1', ['Imported via URL']);
    if (res.rows.length === 0) {
      console.log('Test sheet not found.');
      return;
    }
    
    const sheetId = res.rows[0].id;
    console.log(`Triggering sync for sheet ID: ${sheetId}...`);
    
    const result = await service.syncSheet(sheetId);
    console.log('Sync Result:', result);
    
  } catch (error) {
    console.error('Error running sync:', error);
  } finally {
    process.exit(0);
  }
}

runSync();
