import { pool } from './src/config/database';

const migrationSql = `
-- 1. Function to enforce lowercase role and status to avoid constraint errors when editing manually in Supabase
CREATE OR REPLACE FUNCTION sanitize_org_member_role()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IS NOT NULL THEN
        NEW.role = LOWER(NEW.role);
    END IF;
    IF NEW.status IS NOT NULL THEN
        NEW.status = LOWER(NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sanitize_org_member_role ON organization_members;
CREATE TRIGGER trg_sanitize_org_member_role
BEFORE INSERT OR UPDATE ON organization_members
FOR EACH ROW
EXECUTE FUNCTION sanitize_org_member_role();


-- 2. Function to sync roles from organization_members to ss_account
CREATE OR REPLACE FUNCTION sync_org_role_to_ss_account()
RETURNS TRIGGER AS $$
DECLARE
    v_user_email VARCHAR(255);
    v_ss_role VARCHAR(50);
BEGIN
    -- Only proceed if the role has changed (for updates)
    IF TG_OP = 'UPDATE' AND OLD.role = NEW.role THEN
        RETURN NEW;
    END IF;

    -- Get the user's email
    SELECT email INTO v_user_email FROM users WHERE id = NEW.user_id;

    IF v_user_email IS NOT NULL THEN
        -- Map organization_members role to ss_account role
        IF NEW.role = 'admin' THEN
            v_ss_role := 'Admin';
        ELSIF NEW.role = 'manager' THEN
            v_ss_role := 'Adviser';
        ELSE
            v_ss_role := 'Student';
        END IF;

        -- Update the ss_account
        UPDATE ss_account 
        SET "accountRole" = v_ss_role 
        WHERE "accountEmail" = v_user_email;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_org_role_to_ss_account ON organization_members;
CREATE TRIGGER trg_sync_org_role_to_ss_account
AFTER INSERT OR UPDATE ON organization_members
FOR EACH ROW
EXECUTE FUNCTION sync_org_role_to_ss_account();
`;

async function runMigration() {
  console.log('Running role synchronization migration...');
  try {
    await pool.query(migrationSql);
    console.log('Successfully created role synchronization triggers!');
    process.exit(0);
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  }
}

runMigration();
