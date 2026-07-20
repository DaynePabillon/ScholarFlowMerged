import { query } from '../config/database';
import logger from '../config/logger';

/**
 * Whenever a user becomes an Admin in a SkyFlow organization
 * (organization_members.role = 'admin'), mirror that into ScholarSync by
 * upserting ss_account.accountRole = 'Admin' for the same email. This keeps
 * "Admin" unified across both the project-management side (SkyFlow) and the
 * consultation/academics side (ScholarSync) — becoming an org admin
 * immediately grants ScholarSync Admin status too.
 *
 * Non-fatal: ss_account may not exist in all environments.
 */
export const syncScholarSyncAdminRole = async (
  email: string | null | undefined,
  name: string | null | undefined,
  userId: string | null = null
): Promise<void> => {
  if (!email) return;
  try {
    await query(
      `INSERT INTO ss_account ("accountName", "accountEmail", "accountRole", user_id)
       VALUES ($1, $2, 'Admin', $3)
       ON CONFLICT ("accountEmail") DO UPDATE SET "accountRole" = 'Admin', user_id = COALESCE(ss_account.user_id, $3)`,
      [name || '', email, userId]
    );
  } catch (err) {
    logger.warn('Could not upsert ss_account for admin role sync (table may not exist):', err);
  }
};
