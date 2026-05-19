import { Router } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { query } from '../config/database';
import logger from '../config/logger';
import { sendInvitationEmail, isEmailConfigured } from '../services/email.service';

const router = Router();

/**
 * POST /api/users/onboarding
 * Save user onboarding preferences
 */
router.post('/onboarding', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      purpose,
      role,
      teamSize,
      focusAreas,
      hearAbout,
      teamMembers,
      workspaceName
    } = req.body;

    // Update user's onboarding status and preferences
    await query(
      `UPDATE users 
       SET onboarding_completed = true,
           onboarding_data = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [
        JSON.stringify({
          purpose,
          role,
          teamSize,
          focusAreas,
          hearAbout,
          completedAt: new Date().toISOString()
        }),
        userId
      ]
    );

    // Create workspace/organization if name provided
    if (workspaceName && workspaceName.trim()) {
      const orgResult = await query(
        `INSERT INTO organizations (name, created_by, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         RETURNING id`,
        [workspaceName.trim(), userId]
      );

      const organizationId = orgResult.rows[0].id;

      // Add user as admin of the organization
      await query(
        `INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
         VALUES ($1, $2, 'admin', 'active', NOW())`,
        [organizationId, userId]
      );

      // Send invitations to team members if provided
      if (teamMembers && Array.isArray(teamMembers)) {
        // Get inviter details for the email
        const inviterResult = await query('SELECT name, email FROM users WHERE id = $1', [userId]);
        const inviter = inviterResult.rows[0];

        for (const member of teamMembers) {
          if (member.email && member.email.trim()) {
            const token = require('crypto').randomBytes(32).toString('hex');
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

            await query(
              `INSERT INTO organization_invitations 
               (organization_id, email, role, invited_by, token, expires_at, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
              [
                organizationId,
                member.email.trim(),
                member.role || 'member',
                userId,
                token,
                expiresAt
              ]
            );

            // Send invitation email
            const emailResult = await sendInvitationEmail({
              to: member.email.trim(),
              inviterName: inviter?.name || 'A team member',
              inviterEmail: inviter?.email || '',
              organizationName: workspaceName.trim(),
              role: member.role || 'member',
              token: token
            });

            if (emailResult.success) {
              logger.info(`✅ Invitation sent to ${member.email} for organization ${organizationId}`);
            } else {
              logger.warn(`⚠️ Invitation email failed for ${member.email}: ${emailResult.error}`);
            }
          }
        }
      }

      return res.json({
        success: true,
        message: 'Onboarding completed successfully',
        organizationId
      });
    }

    return res.json({
      success: true,
      message: 'Onboarding completed successfully'
    });

  } catch (error) {
    logger.error('Error saving onboarding data:', error);
    return res.status(500).json({ error: 'Failed to save onboarding data' });
  }
});

/**
 * GET /api/users/preferences
 * Get user preferences including theme mode
 */
router.get('/preferences', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await query(
      'SELECT theme_mode FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      theme_mode: result.rows[0].theme_mode || 'professional'
    });
  } catch (error) {
    logger.error('Error fetching user preferences:', error);
    return res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

/**
 * PATCH /api/users/preferences
 * Update user preferences (theme mode, etc.)
 */
router.patch('/preferences', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { theme_mode } = req.body;

    // Validate theme_mode (only professional mode is supported)
    if (theme_mode && theme_mode !== 'professional') {
      return res.status(400).json({ error: 'Invalid theme_mode. Must be "professional"' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (theme_mode) {
      updates.push(`theme_mode = $${paramIndex++}`);
      values.push(theme_mode);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(userId);

    await query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}`,
      values
    );

    logger.info(`User ${userId} updated preferences: theme_mode=${theme_mode}`);

    return res.json({ success: true, theme_mode });
  } catch (error) {
    logger.error('Error updating user preferences:', error);
    return res.status(500).json({ error: 'Failed to update preferences' });
  }
});

export default router;

