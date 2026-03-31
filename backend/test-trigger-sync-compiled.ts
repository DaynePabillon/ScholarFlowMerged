process.env.DATABASE_URL = 'postgresql://postgres.fijnckhquezxpflfzcyk:ZroqnJyydPs6RkQy@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres';
import { WorkspaceSyncService } from './src/services/workspace.service';
import { query } from './src/config/database'; 

async function testParse() {
  try {
    const service = new WorkspaceSyncService();
    
    // Use direct DB query to find the sheet ID
    const res = await query('SELECT * FROM synced_sheets WHERE sheet_name = $1 LIMIT 1', ['Imported via URL']);
    if (res.rows.length === 0) {
      console.log('Test sheet not found.');
      return;
    }
    
    const sheet = res.rows[0];
    console.log(`Testing extraction for: ${sheet.sheet_name} (ID: ${sheet.id})`);
    
    console.log('Triggering full sync...');
    const result = await service.syncSheet(sheet.id);
    console.log('Sync Result:', result);
    
  } catch (error) {
    console.error('Error running test:', error);
  } finally {
    process.exit(0);
  }
}

testParse();
