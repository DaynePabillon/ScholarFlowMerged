import { Router, Request, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth.middleware';
import { query } from '../config/database';
import logger from '../config/logger';

const router = Router();

/**
 * GET /api/invitations/validate
 * Validate an invitation token (public endpoint)
 */
router.get('/validate', async (req: Request, res: Response) => {
    try {
        const { token } = req.query;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ valid: false, error: 'Token is required' });
        }

        // Find the invitation with organization and inviter details
        const result = await query(
            `SELECT 
        i.id,
        i.email,
        i.role,
        i.expires_at,
        i.accepted_at,
        o.id as organization_id,
        o.name as organization_name,
        u.name as inviter_name,
        u.email as inviter_email
       FROM organization_invitations i
       JOIN organizations o ON i.organization_id = o.id
       JOIN users u ON i.invited_by = u.id
       WHERE i.token = $1`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ valid: false, error: 'Invitation not found' });
        }

        const invitation = result.rows[0];

        // Check if already accepted
        if (invitation.accepted_at) {
            return res.status(400).json({ valid: false, error: 'This invitation has already been used' });
        }

        // Check if expired
        if (new Date(invitation.expires_at) < new Date()) {
            return res.status(400).json({ valid: false, error: 'This invitation has expired' });
        }

        return res.json({
            valid: true,
            invitation: {
                email: invitation.email,
                role: invitation.role,
                organizationId: invitation.organization_id,
                organizationName: invitation.organization_name,
                inviterName: invitation.inviter_name
            }
        });

    } catch (error) {
        logger.error('Error validating invitation:', error);
        return res.status(500).json({ valid: false, error: 'Failed to validate invitation' });
    }
});

/**
 * POST /api/invitations/accept
 * Accept an invitation (requires authentication)
 */
router.post('/accept', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const userEmail = req.user?.email;
        const { token } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        // Find the invitation
        const invitationResult = await query(
            `SELECT 
        i.id,
        i.email,
        i.role,
        i.organization_id,
        i.expires_at,
        i.accepted_at,
        o.name as organization_name
       FROM organization_invitations i
       JOIN organizations o ON i.organization_id = o.id
       WHERE i.token = $1`,
            [token]
        );

        if (invitationResult.rows.length === 0) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        const invitation = invitationResult.rows[0];

        // Check if already accepted
        if (invitation.accepted_at) {
            return res.status(400).json({ error: 'This invitation has already been used' });
        }

        // Check if expired
        if (new Date(invitation.expires_at) < new Date()) {
            return res.status(400).json({ error: 'This invitation has expired' });
        }

        // Verify the email matches (optional - you may want to allow any authenticated user)
        // if (invitation.email.toLowerCase() !== userEmail?.toLowerCase()) {
        //   return res.status(403).json({ error: 'This invitation is for a different email address' });
        // }

        // Check if user is already a member
        const existingMember = await query(
            `SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
            [invitation.organization_id, userId]
        );

        if (existingMember.rows.length > 0) {
            // Update the invitation as accepted anyway
            await query(
                `UPDATE organization_invitations SET accepted_at = NOW() WHERE id = $1`,
                [invitation.id]
            );
            return res.status(400).json({ error: 'You are already a member of this organization' });
        }

        // Add user to organization
        await query(
            `INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
       VALUES ($1, $2, $3, 'active', NOW())`,
            [invitation.organization_id, userId, invitation.role]
        );

        // Mark invitation as accepted
        await query(
            `UPDATE organization_invitations SET accepted_at = NOW() WHERE id = $1`,
            [invitation.id]
        );

        logger.info(`User ${userId} accepted invitation to organization ${invitation.organization_id}`);

        return res.json({
            success: true,
            message: 'Successfully joined the organization',
            organization: {
                id: invitation.organization_id,
                name: invitation.organization_name,
                role: invitation.role
            }
        });

    } catch (error) {
        logger.error('Error accepting invitation:', error);
        return res.status(500).json({ error: 'Failed to accept invitation' });
    }
});

export default router;
