import { query } from './src/config/database';

async function addArchivedStatus() {
    try {
        console.log('Updating tasks status constraint...');

        // Drop existing constraint
        await query(`ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check`);
        console.log('Dropped old constraint');

        // Add new constraint with 'archived' status
        await query(`ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('todo', 'in_progress', 'review', 'completed', 'archived'))`);
        console.log('Added new constraint with archived status');

        console.log('✅ SUCCESS: Database updated!');
        process.exit(0);
    } catch (error: any) {
        console.error('❌ ERROR:', error.message);
        process.exit(1);
    }
}

addArchivedStatus();
