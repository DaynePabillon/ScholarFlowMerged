import { oauth2Client, getGoogleAuthUrl } from '../../config/google';
import { query } from '../../config/database';
import logger from '../../config/logger';
import * as jwt from 'jsonwebtoken';

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export class GoogleAuthService {
  /**
   * Generate Google OAuth URL for user authentication
   */
  static getAuthUrl(inviteToken?: string): string {
    const state = inviteToken
      ? Buffer.from(JSON.stringify({ inviteToken })).toString('base64')
      : '';
    return getGoogleAuthUrl(state);
  }

  /**
   * Exchange authorization code for tokens
   */
  static async exchangeCodeForTokens(code: string) {
    try {
      console.log('exchangeCodeForTokens: Starting token exchange...');
      console.log('OAuth2Client redirect_uri:', oauth2Client._clientId ? 'CLIENT_ID_SET' : 'MISSING');
      const { tokens } = await oauth2Client.getToken(code);
      console.log('exchangeCodeForTokens: Success! Got tokens');
      oauth2Client.setCredentials(tokens);
      return tokens;
    } catch (error: any) {
      console.log('exchangeCodeForTokens: FAILED');
      console.log('Error response:', error?.response?.data);
      console.log('Error message:', error?.message);
      logger.error('Error exchanging code for tokens:', error);
      throw new Error('Failed to exchange authorization code');
    }
  }

  /**
   * Get user info from Google
   */
  static async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    try {
      oauth2Client.setCredentials({ access_token: accessToken });
      const oauth2 = await import('googleapis').then(g => g.google.oauth2({ version: 'v2', auth: oauth2Client }));
      const { data } = await oauth2.userinfo.get();

      return {
        id: data.id!,
        email: data.email!,
        name: data.name!,
        picture: data.picture || undefined,
      };
    } catch (error) {
      logger.error('Error fetching user info:', error);
      throw new Error('Failed to fetch user information');
    }
  }

  /**
   * Create or update user in database
   */
  static async upsertUser(
    googleUser: GoogleUserInfo,
    accessToken: string,
    refreshToken?: string
  ) {
    try {
      const tokenExpiry = new Date(Date.now() + 3600 * 1000); // 1 hour from now

      const result = await query(
        `INSERT INTO users (google_id, email, name, profile_picture, access_token, refresh_token, token_expiry, last_login)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (google_id) 
         DO UPDATE SET 
           email = EXCLUDED.email,
           name = EXCLUDED.name,
           profile_picture = EXCLUDED.profile_picture,
           access_token = EXCLUDED.access_token,
           refresh_token = COALESCE(EXCLUDED.refresh_token, users.refresh_token),
           token_expiry = EXCLUDED.token_expiry,
           last_login = NOW(),
           updated_at = NOW()
         RETURNING *`,
        [googleUser.id, googleUser.email, googleUser.name, googleUser.picture, accessToken, refreshToken, tokenExpiry]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error upserting user:', error);
      throw new Error('Failed to save user information');
    }
  }

  /**
   * Process organization invitation
   */
  static async processInvitation(userId: string, inviteToken: string) {
    try {
      // Get invitation details
      const inviteResult = await query(
        `SELECT * FROM organization_invitations 
         WHERE token = $1 AND expires_at > NOW() AND accepted_at IS NULL`,
        [inviteToken]
      );

      if (inviteResult.rows.length === 0) {
        throw new Error('Invalid or expired invitation');
      }

      const invitation = inviteResult.rows[0];

      // Check if user email matches invitation
      const userResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
      if (userResult.rows[0].email !== invitation.email) {
        throw new Error('Email does not match invitation');
      }

      // Add user to organization
      await query(
        `INSERT INTO organization_members (organization_id, user_id, role, status, invited_by, joined_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (organization_id, user_id) DO UPDATE SET status = $4, joined_at = NOW()`,
        [invitation.organization_id, userId, invitation.role, 'active', invitation.invited_by]
      );

      // Mark invitation as accepted
      await query(
        'UPDATE organization_invitations SET accepted_at = NOW() WHERE id = $1',
        [invitation.id]
      );

      logger.info(`User ${userId} accepted invitation to organization ${invitation.organization_id}`);
    } catch (error) {
      logger.error('Error processing invitation:', error);
      throw error;
    }
  }

  /**
   * Generate JWT token for authenticated user
   */
  static generateJWT(user: any): string {
    const payload = {
      id: user.id,
      email: user.email,
      googleId: user.google_id,
    };

    const secret = process.env.JWT_SECRET || 'default-secret-key';
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
  }

  /**
   * Refresh Google access token
   */
  static async refreshAccessToken(userId: string) {
    try {
      const result = await query('SELECT refresh_token FROM users WHERE id = $1', [userId]);

      if (!result.rows[0]?.refresh_token) {
        throw new Error('No refresh token available');
      }

      oauth2Client.setCredentials({
        refresh_token: result.rows[0].refresh_token,
      });

      const { credentials } = await oauth2Client.refreshAccessToken();

      // Update tokens in database
      await query(
        'UPDATE users SET access_token = $1, token_expiry = $2, updated_at = NOW() WHERE id = $3',
        [credentials.access_token, new Date(credentials.expiry_date!), userId]
      );

      return credentials.access_token;
    } catch (error) {
      logger.error('Error refreshing access token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Get user by ID with fresh tokens
   */
  static async getUserWithTokens(userId: string) {
    try {
      const result = await query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );

      if (!result.rows[0]) {
        throw new Error('User not found');
      }

      const user = result.rows[0];

      // Check if token is expired or about to expire (within 5 minutes)
      const now = new Date();
      const tokenExpiry = new Date(user.token_expiry);
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      if (tokenExpiry < fiveMinutesFromNow) {
        logger.info(`Refreshing token for user ${userId}`);
        user.access_token = await this.refreshAccessToken(userId);
      }

      return user;
    } catch (error) {
      logger.error('Error getting user with tokens:', error);
      throw error;
    }
  }
}

export default GoogleAuthService;
