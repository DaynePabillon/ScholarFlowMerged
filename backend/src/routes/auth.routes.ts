import { Router, Request, Response } from 'express';
import GoogleAuthService from '../services/google/auth.service';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { EqualizerService } from '../services/equalizer.service';
import logger from '../config/logger';

const router = Router();

/**
 * GET /api/auth/google
 * Generate Google OAuth URL
 */
router.get('/google', (req: Request, res: Response) => {
  try {
    const inviteToken = req.query.invite as string;
    const authUrl = GoogleAuthService.getAuthUrl(inviteToken);
    return res.redirect(authUrl);
  } catch (error) {
    logger.error('Error generating auth URL:', error);
    return res.status(500).json({ error: 'Failed to generate authentication URL' });
  }
});

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  console.log('=== OAuth Callback Started ===');
  console.log('Query params:', req.query);

  try {
    const { code, state } = req.query;

    if (!code) {
      console.log('ERROR: No authorization code received');
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    console.log('Step 1: Got authorization code');

    // Decode state to get invite token if present
    let inviteToken: string | undefined;
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state as string, 'base64').toString());
        inviteToken = decoded.inviteToken;
      } catch (e) {
        // State parsing failed, continue without invite
      }
    }

    console.log('Step 2: Exchanging code for tokens...');
    // Exchange code for tokens
    const tokens = await GoogleAuthService.exchangeCodeForTokens(code as string);
    console.log('Step 3: Got tokens successfully');

    // Get user info from Google
    console.log('Step 4: Getting user info...');
    const googleUser = await GoogleAuthService.getUserInfo(tokens.access_token!);
    console.log('Step 5: Got user info:', googleUser.email);

    // Save/update user in database
    console.log('Step 6: Upserting user...');
    const user = await GoogleAuthService.upsertUser(
      googleUser,
      tokens.access_token!,
      tokens.refresh_token || undefined
    );
    console.log('Step 7: User saved, ID:', user.id);

    // ── Equalizer Handshake ──
    // Automatically claim tasks, memberships, and invitations tied to this email
    try {
      const equalizerResult = await EqualizerService.runHandshake(user.id, user.email);
      console.log('Step 7.5: Equalizer handshake:', equalizerResult);

      // If the Equalizer accepted invitations, mark as invited for the redirect
      if (equalizerResult.invitationsAccepted > 0 || equalizerResult.membershipsClaimed > 0) {
        inviteToken = inviteToken || 'equalizer-auto';

        // Skip onboarding for users who joined via Equalizer
        const { query: eqQuery } = await import('../config/database');
        await eqQuery(
          `UPDATE users SET onboarding_completed = true, updated_at = NOW() WHERE id = $1 AND onboarding_completed = false`,
          [user.id]
        );
      }
    } catch (eqError: any) {
      console.error('Equalizer handshake error (non-fatal):', eqError.message);
    }

    // Check for pending invitations by email
    const { query: dbQuery } = await import('../config/database');
    const invitationResult = await dbQuery(
      `SELECT id, organization_id, role, token
       FROM organization_invitations
       WHERE email = $1 AND expires_at > NOW() AND accepted_at IS NULL
       LIMIT 1`,
      [user.email]
    );

    // Process invitation if found
    if (invitationResult.rows.length > 0) {
      const invitation = invitationResult.rows[0];
      logger.info(`Processing pending invitation for ${user.email}`);

      // Add user to organization
      await dbQuery(
        `INSERT INTO organization_members (organization_id, user_id, role, status, invited_by, joined_at)
         SELECT $1, $2, $3, $4, invited_by, NOW()
         FROM organization_invitations
         WHERE id = $5
         ON CONFLICT (organization_id, user_id) DO NOTHING`,
        [invitation.organization_id, user.id, invitation.role, 'active', invitation.id]
      );

      // Mark invitation as accepted
      await dbQuery(
        `UPDATE organization_invitations SET accepted_at = NOW() WHERE id = $1`,
        [invitation.id]
      );

      // Mark user as onboarded since they're joining via invitation
      await dbQuery(
        `UPDATE users SET onboarding_completed = true, updated_at = NOW() WHERE id = $1`,
        [user.id]
      );

      inviteToken = invitation.token;
      logger.info(`User ${user.email} added to organization via invitation`);
    } else if (inviteToken) {
      // If invite token provided in URL, process it
      await GoogleAuthService.processInvitation(user.id, inviteToken);

      // Mark user as onboarded since they're joining via invitation
      await dbQuery(
        `UPDATE users SET onboarding_completed = true, updated_at = NOW() WHERE id = $1`,
        [user.id]
      );
    }

    // ── ScholarSync Role Detection (bypass onboarding) ──
    // If the user's email exists in ss_account, automatically set them up
    if (!user.onboarding_completed) {
      try {
        const ssResult = await dbQuery(
          'SELECT "accountRole" FROM ss_account WHERE "accountEmail" = $1 LIMIT 1',
          [user.email]
        );

        if (ssResult.rows.length > 0) {
          const ssRole = ssResult.rows[0].accountRole; // 'Admin', 'Advisers', 'Student'
          console.log(`ScholarSync role detected for ${user.email}: ${ssRole}`);

          // Map ScholarSync role → SkyFlow role
          const skyflowRole = (ssRole === 'Admin' || ssRole === 'Advisers') ? 'admin' : 'member';

          // Find or create the ScholarSync organization
          let orgResult = await dbQuery(
            "SELECT id FROM organizations WHERE name = 'ScholarSync' LIMIT 1"
          );

          let orgId: string;
          if (orgResult.rows.length === 0) {
            const newOrg = await dbQuery(
              `INSERT INTO organizations (name, description, domain)
               VALUES ('ScholarSync', 'Academic collaboration workspace synced from ScholarSync', 'scholarsync.local')
               RETURNING id`
            );
            orgId = newOrg.rows[0].id;
            console.log('Created ScholarSync organization:', orgId);
          } else {
            orgId = orgResult.rows[0].id;
          }

          // Add user to organization
          await dbQuery(
            `INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
             VALUES ($1, $2, $3, 'active', NOW())
             ON CONFLICT (organization_id, user_id) DO UPDATE SET role = $3, status = 'active'`,
            [orgId, user.id, skyflowRole]
          );

          // Mark onboarding as completed with role context, and store ScholarSync role in users.role
          await dbQuery(
            `UPDATE users SET role = $3, onboarding_completed = true, onboarding_data = $2, updated_at = NOW() WHERE id = $1`,
            [user.id, JSON.stringify({
              purpose: 'School',
              role: ssRole === 'Student' ? 'Undergraduate student' : 'Faculty member',
              teamSize: '11-25',
              focusAreas: ['Group assignments', 'Project management'],
              source: 'scholarsync_auto',
              workspaceName: 'ScholarSync',
            }), skyflowRole]
          );

          inviteToken = 'scholarsync-auto'; // triggers the "invited=true" path which skips onboarding
          console.log(`Auto-onboarded ${user.email} as ${skyflowRole} via ScholarSync`);
        }
      } catch (ssErr: any) {
        console.error('ScholarSync role detection error (non-fatal):', ssErr.message);
        // Non-fatal: if ScholarSync check fails, user still goes through normal onboarding
      }
    }

    // 11. Refetch user to get the updated onboarding_completed and role from detections
    const { rows: finalUserRows } = await dbQuery('SELECT * FROM users WHERE id = $1', [user.id]);
    const updatedUser = finalUserRows[0];
    
    // Generate JWT
    console.log('Step 8: Generating JWT...');
    const jwt = GoogleAuthService.generateJWT(updatedUser);
    console.log('Step 9: JWT generated');

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    console.log('Step 10: Redirecting to frontend:', frontendUrl);
    
    // Always use /auth/callback as the unified entry point
    const redirectUrl = inviteToken
      ? `${frontendUrl}/auth/callback?token=${jwt}&invited=true`
      : `${frontendUrl}/auth/callback?token=${jwt}`;
    
    console.log('Full redirect URL:', redirectUrl);
    return res.redirect(redirectUrl);
  } catch (error: any) {
    console.log('=== OAuth Callback ERROR ===');
    console.log('Error name:', error?.name);
    console.log('Error message:', error?.message);
    console.log('Error stack:', error?.stack);
    logger.error('Error in OAuth callback:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/?error=authentication_failed`);
  }
});

/**
 * GET /api/auth/me
 * Get current user info with organizations
 */
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await GoogleAuthService.getUserWithTokens(req.user!.id);

    // Get user's organizations
    const { query: dbQuery } = await import('../config/database');
    let orgsResult = await dbQuery(
      `SELECT o.id, o.name, om.role, om.status
       FROM organizations o
       INNER JOIN organization_members om ON o.id = om.organization_id
       WHERE om.user_id = $1 AND om.status = $2
       ORDER BY om.joined_at DESC`,
      [user.id, 'active']
    );

    // Auto-sync: if user has no orgs but is in team_groups (ScholarSync import), add them
    if (orgsResult.rows.length === 0) {
      try {
        const teamOrgs = await dbQuery(
          `SELECT DISTINCT tg.organization_id
           FROM team_group_members tgm
           JOIN team_groups tg ON tgm.team_group_id = tg.id
           WHERE LOWER(tgm.email) = LOWER($1) AND tg.organization_id IS NOT NULL`,
          [user.email]
        );
        for (const row of teamOrgs.rows) {
          await dbQuery(
            `INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
             VALUES ($1, $2, 'member', 'active', NOW())
             ON CONFLICT (organization_id, user_id) DO NOTHING`,
            [row.organization_id, user.id]
          );
        }
        if (teamOrgs.rows.length > 0) {
          // Re-fetch after sync
          orgsResult = await dbQuery(
            `SELECT o.id, o.name, om.role, om.status
             FROM organizations o
             INNER JOIN organization_members om ON o.id = om.organization_id
             WHERE om.user_id = $1 AND om.status = $2
             ORDER BY om.joined_at DESC`,
            [user.id, 'active']
          );
        }
      } catch (syncErr) {
        console.error('Auto-sync org membership failed:', syncErr);
      }
    }

    // Check ScholarSync role for the frontend
    let scholarsyncRole: string | null = null;
    try {
      const ssResult = await dbQuery(
        'SELECT "accountRole" FROM ss_account WHERE "accountEmail" = $1 LIMIT 1',
        [user.email]
      );
      if (ssResult.rows.length > 0) {
        scholarsyncRole = ssResult.rows[0].accountRole;

        // Back-fill users.role for existing users who were onboarded before the role fix
        if (!user.role && scholarsyncRole) {
          const backfillRole = (scholarsyncRole === 'Admin' || scholarsyncRole === 'Advisers') ? 'admin' : 'member';
          await dbQuery('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2', [backfillRole, user.id]);
          user.role = backfillRole;
        }
      }
    } catch { /* ss_account may not exist */ }

    // Don't send sensitive tokens to frontend
    const { access_token, refresh_token, ...safeUser } = user;

    // DEBUG: Log what we're sending to frontend
    console.log('='.repeat(70));
    console.log('🔍 /api/auth/me RESPONSE:');
    console.log('User:', user.email);
    console.log('Organizations:', JSON.stringify(orgsResult.rows, null, 2));
    console.log('scholarsyncRole:', scholarsyncRole);
    console.log('='.repeat(70));

    res.json({
      ...safeUser,
      organizations: orgsResult.rows,
      scholarsyncRole,
    });
  } catch (error) {
    logger.error('Error fetching user info:', error);
    res.status(500).json({ error: 'Failed to fetch user information' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const newAccessToken = await GoogleAuthService.refreshAccessToken(req.user!.id);
    res.json({ accessToken: newAccessToken });
  } catch (error) {
    logger.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Failed to refresh access token' });
  }
});

/**
 * GET /api/auth/invite/:token
 * Get invitation details
 */
router.get('/invite/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { query: dbQuery } = await import('../config/database');

    const result = await dbQuery(
      `SELECT oi.*, o.name as organization_name
       FROM organization_invitations oi
       INNER JOIN organizations o ON oi.organization_id = o.id
       WHERE oi.token = $1 AND oi.expires_at > NOW() AND oi.accepted_at IS NULL`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching invitation:', error);
    res.status(500).json({ error: 'Failed to fetch invitation' });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', authenticateToken, (req: AuthRequest, res: Response) => {
  // In a stateless JWT system, logout is handled client-side
  // Optionally, you could blacklist the token here
  logger.info(`User ${req.user!.id} logged out`);
  res.json({ message: 'Logged out successfully' });
});

export default router;
