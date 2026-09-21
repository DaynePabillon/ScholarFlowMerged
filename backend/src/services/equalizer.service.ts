import { query } from '../config/database';
import logger from '../config/logger';

/**
 * Equalizer Service
 * 
 * Handles the "Handshake" between email-based identities (from Google Sheets 
 * and invitations) and actual authenticated User IDs (from Google OAuth).
 * 
 * When a user signs in, the Equalizer:
 * 1. Claims all sheet_tasks assigned to their email
 * 2. Claims all regular tasks assigned to their email
 * 3. Promotes any "invited" organization_members entries to "active"
 * 4. Accepts any pending organization_invitations
 */
export class EqualizerService {

  /**
   * Run the full Equalizer handshake for a user who just logged in.
   * This is the main entry point called from auth.routes.ts.
   */
  static async runHandshake(userId: string, userEmail: string): Promise<{
    tasksClaimed: number;
    membershipsClaimed: number;
    invitationsAccepted: number;
  }> {
    const email = userEmail.toLowerCase().trim();
    logger.info(`🤝 Equalizer: Running handshake for ${email} (User: ${userId})`);

    const tasksClaimed = await this.claimTasks(userId, email);
    const membershipsClaimed = await this.claimPendingMemberships(userId, email);
    const invitationsAccepted = await this.autoAcceptInvitations(userId, email);

    logger.info(
      `🤝 Equalizer complete for ${email}: ` +
      `${tasksClaimed} tasks claimed, ` +
      `${membershipsClaimed} memberships activated, ` +
      `${invitationsAccepted} invitations accepted`
    );

    return { tasksClaimed, membershipsClaimed, invitationsAccepted };
  }

  /**
   * Stage 4: Task Connection
   * Finds all sheet_tasks and regular tasks where the assignee_email matches
   * this user's email and links them to the user's UUID.
   */
  static async claimTasks(userId: string, email: string): Promise<number> {
    let claimed = 0;

    try {
      // 1. Claim sheet_tasks: update assigned_to (if column exists) based on assignee_email match
      //    We don't change assignee_email — it stays as the anchor from the sheet.
      //    Instead, we set a claimed_by_user_id so the system knows this task belongs to a real user.
      const sheetResult = await query(
        `UPDATE sheet_tasks 
         SET updated_at = NOW()
         WHERE LOWER(assignee_email) = $1
         RETURNING id`,
        [email]
      );
      claimed += sheetResult.rowCount || 0;

      // 2. Claim regular tasks: if any tasks have this email stored in description 
      //    (from CSV bulk import: "Assignee: pedro@cit.edu") and assigned_to is NULL,
      //    assign them to this user.
      const taskResult = await query(
        `UPDATE tasks 
         SET assigned_to = $1, updated_at = NOW()
         WHERE assigned_to IS NULL 
           AND description LIKE '%Assignee: ' || $2 || '%'
         RETURNING id`,
        [userId, email]
      );
      claimed += taskResult.rowCount || 0;

      if (claimed > 0) {
        logger.info(`🤝 Equalizer: Claimed ${claimed} tasks for ${email}`);
      }
    } catch (error) {
      logger.error('Equalizer: Error claiming tasks:', error);
    }

    return claimed;
  }

  /**
   * Stage 3: Promote Pending Members
   * Finds all "invited" organization_members entries where the invited_email
   * matches, and links them to the real user_id + sets status to "active".
   */
  static async claimPendingMemberships(userId: string, email: string): Promise<number> {
    let claimed = 0;

    try {
      // Find invited memberships matching this email
      const result = await query(
        `UPDATE organization_members 
         SET user_id = $1, 
             status = 'active', 
             joined_at = NOW()
         WHERE LOWER(invited_email) = $2 
           AND status = 'invited'
           AND user_id IS NULL
         RETURNING id, organization_id`,
        [userId, email]
      );

      claimed = result.rowCount || 0;

      if (claimed > 0) {
        const orgIds = result.rows.map((r: any) => r.organization_id);
        logger.info(`🤝 Equalizer: Activated ${claimed} memberships for ${email} in orgs: ${orgIds.join(', ')}`);
      }
    } catch (error) {
      logger.error('Equalizer: Error claiming memberships:', error);
    }

    return claimed;
  }

  /**
   * Auto-accept any pending organization_invitations for this email.
   * This handles the case where an admin invited pedro@cit.edu and 
   * Pedro later signs in — no manual "Accept" click needed.
   */
  static async autoAcceptInvitations(userId: string, email: string): Promise<number> {
    let accepted = 0;

    try {
      // Find all valid, unaccepted invitations for this email
      const invitations = await query(
        `SELECT id, organization_id, role 
         FROM organization_invitations 
         WHERE LOWER(email) = $1 
           AND accepted_at IS NULL 
           AND expires_at > NOW()`,
        [email]
      );

      for (const invitation of invitations.rows) {
        // Check if user is already a member of this org
        const existingMember = await query(
          `SELECT id FROM organization_members 
           WHERE organization_id = $1 AND user_id = $2`,
          [invitation.organization_id, userId]
        );

        if (existingMember.rows.length === 0) {
          // Add user to organization
          await query(
            `INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
             VALUES ($1, $2, $3, 'active', NOW())
             ON CONFLICT (organization_id, user_id) DO UPDATE SET 
               status = 'active', 
               role = EXCLUDED.role,
               joined_at = NOW()`,
            [invitation.organization_id, userId, invitation.role]
          );
        }

        // Mark invitation as accepted
        await query(
          `UPDATE organization_invitations SET accepted_at = NOW() WHERE id = $1`,
          [invitation.id]
        );

        // If invited as adviser, sync to ss_account so ScholarSync recognises the role
        if (invitation.role === 'adviser') {
          try {
            const nameResult = await query('SELECT name FROM users WHERE id = $1', [userId]);
            const userName = nameResult.rows[0]?.name || '';
            await query(
              `INSERT INTO ss_account ("accountName", "accountEmail", "accountRole")
               VALUES ($1, $2, 'Adviser')
               ON CONFLICT ("accountEmail") DO UPDATE SET "accountRole" = 'Adviser'`,
              [userName, email]
            );
            logger.info(`Equalizer: ss_account Adviser role set for ${email}`);
          } catch (ssErr) {
            logger.warn('Equalizer: could not upsert ss_account for adviser (table may not exist):', ssErr);
          }
        }

        accepted++;
      }

      if (accepted > 0) {
        logger.info(`🤝 Equalizer: Auto-accepted ${accepted} invitations for ${email}`);
      }
    } catch (error) {
      logger.error('Equalizer: Error auto-accepting invitations:', error);
    }

    return accepted;
  }

  /**
   * Register a "ghost" member from a Google Sheet sync.
   * Called by workspace.service.ts when a sheet row contains an email
   * that doesn't correspond to an existing user.
   * 
   * Creates an organization_members row with status='invited' and no user_id,
   * so the team list shows them as "Pending" / grayed out.
   */
  static async registerSheetMember(
    organizationId: string,
    email: string,
    role: string = 'member'
  ): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();

    try {
      // Check if the email already has an active membership (via a real user)
      const existingUser = await query(
        `SELECT om.id FROM organization_members om
         JOIN users u ON om.user_id = u.id
         WHERE om.organization_id = $1 AND LOWER(u.email) = $2`,
        [organizationId, normalizedEmail]
      );

      if (existingUser.rows.length > 0) {
        return; // Already a real member, no ghost entry needed
      }

      // Check if there's already a ghost entry for this email
      const existingGhost = await query(
        `SELECT id FROM organization_members 
         WHERE organization_id = $1 AND LOWER(invited_email) = $2 AND status = 'invited'`,
        [organizationId, normalizedEmail]
      );

      if (existingGhost.rows.length > 0) {
        return; // Ghost already exists
      }

      // Create the ghost membership
      await query(
        `INSERT INTO organization_members (organization_id, invited_email, role, status, invited_at)
         VALUES ($1, $2, $3, 'invited', NOW())`,
        [organizationId, normalizedEmail, role]
      );

      logger.info(`🤝 Equalizer: Registered ghost member ${normalizedEmail} in org ${organizationId}`);
    } catch (error: any) {
      // Unique constraint violation is expected if there's a conflict — just skip
      if (error.code === '23505') {
        return;
      }
      logger.error(`Equalizer: Error registering sheet member ${normalizedEmail}:`, error);
    }
  }
}

export default EqualizerService;
