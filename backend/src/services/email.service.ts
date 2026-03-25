import { Resend } from 'resend';
import logger from '../config/logger';

// Initialize Resend with API key from environment
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Check if email is configured
export const isEmailConfigured = (): boolean => {
  return !!process.env.RESEND_API_KEY;
};

// Email template for organization invitation
const createInvitationEmailHtml = (params: {
  inviterName: string;
  organizationName: string;
  role: string;
  inviteLink: string;
}) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to SkyFlow</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f9ff;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
      <div style="display: inline-block; background: white; border-radius: 12px; padding: 12px; margin-bottom: 20px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
        </svg>
      </div>
      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">SkyFlow</h1>
    </div>
    
    <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 24px;">You've been invited!</h2>
      
      <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        <strong style="color: #0ea5e9;">${params.inviterName}</strong> has invited you to join 
        <strong style="color: #1e293b;">${params.organizationName}</strong> as a 
        <strong style="color: #1e293b;">${params.role}</strong> on SkyFlow.
      </p>
      
      <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
        SkyFlow is a powerful organizational project management platform that integrates with Google Workspace to help teams collaborate, manage projects, and track tasks efficiently.
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${params.inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-weight: 600; font-size: 16px;">
          Accept Invitation
        </a>
      </div>
      
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
        This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
      </p>
      
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
      
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${params.inviteLink}" style="color: #0ea5e9; word-break: break-all;">${params.inviteLink}</a>
      </p>
    </div>
    
    <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 20px;">
      © 2025 SkyFlow. Built for organizational excellence.
    </p>
  </div>
</body>
</html>
  `;
};

// Send organization invitation email
export const sendInvitationEmail = async (params: {
  to: string;
  inviterName: string;
  inviterEmail: string;
  organizationName: string;
  role: string;
  token: string;
}): Promise<{ success: boolean; error?: string }> => {
  const frontendUrl = process.env.FRONTEND_URL || 'https://skyflow.fun';
  const inviteLink = `${frontendUrl}/invite/accept?token=${params.token}`;

  // If email is not configured, just log and return success for development
  if (!isEmailConfigured()) {
    logger.info('📧 Email not configured. Invitation details (for development):');
    logger.info(`   To: ${params.to}`);
    logger.info(`   Organization: ${params.organizationName}`);
    logger.info(`   Role: ${params.role}`);
    logger.info(`   Accept Link: ${inviteLink}`);
    return { success: true };
  }

  try {
    const { data, error } = await resend!.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'SkyFlow <noreply@skyflow.fun>',
      to: [params.to],
      subject: `${params.inviterName} invited you to join ${params.organizationName} on SkyFlow`,
      html: createInvitationEmailHtml({
        inviterName: params.inviterName,
        organizationName: params.organizationName,
        role: params.role,
        inviteLink: inviteLink
      }),
      replyTo: params.inviterEmail
    });

    if (error) {
      logger.error('Error sending invitation email:', error);
      return { success: false, error: error.message };
    }

    logger.info(`✉️ Invitation email sent successfully to ${params.to} (ID: ${data?.id})`);
    return { success: true };

  } catch (error: any) {
    logger.error('Failed to send invitation email:', error);
    return { success: false, error: error.message };
  }
};
