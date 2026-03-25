import { query } from './src/config/database';

async function fix() {
    try {
        console.log('--- IT332 Workspace Fix Start (V6) ---');
        
        // DYNAMICALLY FETCH ID TO AVOID ANY STRING/WHITESPACE ISSUES
        const orgRes = await query("SELECT id FROM organizations WHERE name = 'IT332 - 1st Semester 2025-2026' LIMIT 1");
        if (orgRes.rows.length === 0) {
            console.error('❌ FATAL: Could not find IT332 organization by name!');
            return;
        }
        const it332OrgId = orgRes.rows[0].id;
        const adminId = '56c18118-9500-4ba6-9e8e-6d92640b63eb';

        console.log('Targeting Org ID (Dynamic):', it332OrgId);

        // 1. Force Create IT332 workspace if missing
        console.log('Checking for IT332 workspace...');
        const existing = await query('SELECT id FROM workspaces WHERE organization_id = $1', [it332OrgId]);
        
        let wsId;
        if (existing.rows.length > 0) {
            wsId = existing.rows[0].id;
            console.log('✅ Workspace already exists:', wsId);
        } else {
            console.log('Creating new IT332 workspace...');
            const insertRes = await query(
                `INSERT INTO workspaces (
                    name, 
                    organization_id, 
                    created_by, 
                    root_folder_id, 
                    sync_status
                ) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [
                    'IT332 - 1st Semester 2025-2026 Workspace', 
                    it332OrgId, 
                    adminId, 
                    'fixed_root_folder_id_it332', 
                    'active'
                ]
            );
            wsId = insertRes.rows[0].id;
            console.log('✅ Created new workspace:', wsId);
        }
        
        // 2. Re-link ALL synced sheets to this workspace
        console.log('Re-linking all synced sheets...');
        const ssRes = await query('UPDATE synced_sheets SET workspace_id = $1', [wsId]);
        console.log('✅ Successfully re-linked', ssRes.rowCount, 'sheets');
        
        // 3. Verify task count
        const taskCount = await query('SELECT count(*) FROM sheet_tasks WHERE synced_sheet_id IN (SELECT id FROM synced_sheets)');
        console.log('Total sheet tasks now available:', taskCount.rows[0].count);
        
        console.log('--- Fix Complete ---');
    } catch (err: any) {
        console.error('❌ ERROR DURING FIX:', err);
    } finally {
        process.exit(0);
    }
}

fix();
