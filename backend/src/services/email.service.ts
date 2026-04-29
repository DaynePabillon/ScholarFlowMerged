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
  <title>You've been invited to ScholarFlow</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f9ff;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
      <div style="display: inline-block; background: white; border-radius: 12px; padding: 12px; margin-bottom: 20px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
        </svg>
      </div>
      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">ScholarFlow</h1>
    </div>
    
    <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 24px;">You've been invited!</h2>
      
      <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        <strong style="color: #0ea5e9;">${params.inviterName}</strong> has invited you to join 
        <strong style="color: #1e293b;">${params.organizationName}</strong> as a 
        <strong style="color: #1e293b;">${params.role}</strong> on ScholarFlow.
      </p>
      
      <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
        ScholarFlow is an academic collaboration platform that integrates with Google Workspace to help teams collaborate, manage projects, and track consultations efficiently.
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${params.inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-weight: 600; font-size: 16px;">
          Accept Invitation
        </a>
      </div>
      
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
        This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
      </p>

      <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; padding: 15px; background-color: #f1f5f9; border-left: 4px solid #0ea5e9; border-radius: 4px;">
        <strong>Note:</strong> You are receiving this email as an invite because you have participated in our usability testing. If you believe this is a mistake, please inform the leaders of ScholarFlow, Shayne Angus (ID: 22-5035-760) or Dayne Pabillon (ID: 20-1327-654).
      </p>
      
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
      
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${params.inviteLink}" style="color: #0ea5e9; word-break: break-all;">${params.inviteLink}</a>
      </p>
    </div>
    
    <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 20px;">
      © 2025 ScholarFlow. Built for academic excellence.
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
      from: process.env.RESEND_FROM_EMAIL || 'ScholarFlow <noreply@skyflow.fun>',
      to: [params.to],
      subject: `${params.inviterName} invited you to join ${params.organizationName} on ScholarFlow`,
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

// ─── ScholarFlow Team Import Invitation ───

const createTeamImportEmailHtml = (params: {
  studentName: string;
  courseName: string;
  courseCode: string;
  groupName: string;
  adviserName: string;
  loginLink: string;
}) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been added to a course on ScholarFlow</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f9ff;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
      <div style="display: inline-block; background: white; border-radius: 12px; padding: 12px; margin-bottom: 20px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
        </svg>
      </div>
      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">ScholarFlow</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">Academic Collaboration Platform</p>
    </div>
    
    <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 24px;">Welcome to your course!</h2>
      
      <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Hi <strong style="color: #2563eb;">${params.studentName}</strong>, you've been added to a course on ScholarFlow.
      </p>
      
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 0 0 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #94a3b8; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Course</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 15px; font-weight: 600; text-align: right;">${params.courseCode} — ${params.courseName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #94a3b8; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Group</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 15px; font-weight: 600; text-align: right;">${params.groupName}</td>
          </tr>
          ${params.adviserName ? `<tr>
            <td style="padding: 8px 0; color: #94a3b8; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Adviser</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 15px; font-weight: 600; text-align: right;">${params.adviserName}</td>
          </tr>` : ''}
        </table>
      </div>
      
      <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 30px 0;">
        Log in to ScholarFlow to view your team, submit consultation journals, and collaborate with your group.
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${params.loginLink}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-weight: 600; font-size: 16px;">
          Open ScholarFlow
        </a>
      </div>

      <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; padding: 15px; background-color: #f1f5f9; border-left: 4px solid #2563eb; border-radius: 4px;">
        <strong>Note:</strong> You are receiving this email as an invite because you have participated in our usability testing. If you believe this is a mistake, please inform the leaders of ScholarFlow, Shayne Angus (ID: 22-5035-760) or Dayne Pabillon (ID: 20-1327-654).
      </p>
      
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
      
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${params.loginLink}" style="color: #2563eb; word-break: break-all;">${params.loginLink}</a>
      </p>
    </div>
    
    <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 20px;">
      © 2025 ScholarFlow. Built for academic excellence.
    </p>
  </div>
</body>
</html>
  `;
};

// Send team import notification email to a student
export const sendTeamImportEmail = async (params: {
  to: string;
  studentName: string;
  courseName: string;
  courseCode: string;
  groupName: string;
  adviserName: string;
}): Promise<{ success: boolean; error?: string }> => {
  const frontendUrl = process.env.SCHOLAR_FRONTEND_URL || process.env.FRONTEND_URL || 'https://scholarflow.wildcatinnovationlabs.com';
  const loginLink = `${frontendUrl}/scholar/login`;

  if (!isEmailConfigured()) {
    logger.info('📧 Email not configured. Team import notification (dev):');
    logger.info(`   To: ${params.to}`);
    logger.info(`   Course: ${params.courseCode} — ${params.courseName}`);
    logger.info(`   Group: ${params.groupName}`);
    logger.info(`   Login: ${loginLink}`);
    return { success: true };
  }

  try {
    const { data, error } = await resend!.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'ScholarFlow <invites@wildcatinnovationlabs.com>',
      to: [params.to],
      subject: `You've been added to ${params.courseCode} on ScholarFlow`,
      html: createTeamImportEmailHtml({
        studentName: params.studentName,
        courseName: params.courseName,
        courseCode: params.courseCode,
        groupName: params.groupName,
        adviserName: params.adviserName,
        loginLink,
      }),
    });

    if (error) {
      logger.error('Error sending team import email:', error);
      return { success: false, error: error.message };
    }

    logger.info(`✉️ Team import email sent to ${params.to} (ID: ${data?.id})`);
    return { success: true };
  } catch (error: any) {
    logger.error('Failed to send team import email:', error);
    return { success: false, error: error.message };
  }
};

// ─── ScholarFlow Advisor Import Invitation ───

const createAdvisorImportEmailHtml = (params: {
  advisorName: string;
  loginLink: string;
}) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been assigned as an Advisor on ScholarFlow</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #ecfdf5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
      <div style="display: inline-block; background: white; border-radius: 12px; padding: 12px; margin-bottom: 20px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
      </div>
      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">ScholarFlow</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Academic Collaboration Platform</p>
    </div>
    
    <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <h2 style="color: #064e3b; margin: 0 0 20px 0; font-size: 24px;">Welcome, Advisor!</h2>
      
      <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Hi <strong style="color: #10b981;">${params.advisorName}</strong>, you have been assigned to new academic teams on ScholarFlow.
      </p>
      
      <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 30px 0;">
        Please log in to your account to review the groups you are advising, track consultation journals, and monitor student project development.
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${params.loginLink}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-weight: 600; font-size: 16px;">
          Open Dashboard
        </a>
      </div>

      <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; padding: 15px; background-color: #ecfdf5; border-left: 4px solid #10b981; border-radius: 4px;">
        <strong>Note:</strong> You are receiving this email as an invite because you have participated in our usability testing. If you believe this is a mistake, please inform the leaders of ScholarFlow, Shayne Angus (ID: 22-5035-760) or Dayne Pabillon (ID: 20-1327-654).
      </p>
      
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
      
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${params.loginLink}" style="color: #10b981; word-break: break-all;">${params.loginLink}</a>
      </p>
    </div>
    
    <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 20px;">
      © 2025 ScholarFlow. Built for academic excellence.
    </p>
  </div>
</body>
</html>
  `;
};

// Send import notification email to an advisor
export const sendAdvisorImportEmail = async (params: {
  to: string;
  advisorName: string;
}): Promise<{ success: boolean; error?: string }> => {
  const frontendUrl = process.env.SCHOLAR_FRONTEND_URL || process.env.FRONTEND_URL || 'https://scholarflow.wildcatinnovationlabs.com';
  const loginLink = `${frontendUrl}/scholar/login`;

  if (!isEmailConfigured()) {
    logger.info('📧 Email not configured. Advisor import notification (dev):');
    logger.info(`   To: ${params.to}`);
    logger.info(`   Advisor Name: ${params.advisorName}`);
    logger.info(`   Login: ${loginLink}`);
    return { success: true };
  }

  try {
    const { data, error } = await resend!.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'ScholarFlow <invites@wildcatinnovationlabs.com>',
      to: [params.to],
      subject: `You've been assigned as an Advisor on ScholarFlow`,
      html: createAdvisorImportEmailHtml({
        advisorName: params.advisorName,
        loginLink,
      }),
    });

    if (error) {
      logger.error('Error sending advisor import email:', error);
      return { success: false, error: error.message };
    }

    logger.info(`✉️ Advisor import email sent to ${params.to} (ID: ${data?.id})`);
    return { success: true };
  } catch (error: any) {
    logger.error('Failed to send advisor import email:', error);
    return { success: false, error: error.message };
  }
};
