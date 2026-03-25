import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

// Build redirect URI - use env var or construct from backend URL
const getRedirectUri = () => {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  // Fallback: construct from backend URL or use Render URL pattern
  const backendUrl = process.env.BACKEND_URL || 'https://skyflow-backend-v40g.onrender.com';
  return `${backendUrl}/api/auth/google/callback`;
};

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = getRedirectUri();

// Debug: Log OAuth config at startup (hide sensitive parts)
console.log('=== Google OAuth Config ===');
console.log('Client ID loaded:', clientId ? `${clientId.substring(0, 20)}...` : 'MISSING!');
console.log('Client Secret loaded:', clientSecret ? `${clientSecret.substring(0, 10)}...` : 'MISSING!');
console.log('Redirect URI:', redirectUri);

// Google OAuth2 Configuration
export const oauth2Client = new google.auth.OAuth2(
  clientId,
  clientSecret,
  redirectUri
);

// Google API Scopes
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.students.readonly',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

// Generate Google OAuth URL
export const getGoogleAuthUrl = (state?: string) => {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
    prompt: 'consent',
    state: state || '',
  });
};

// Set credentials for OAuth2 client
export const setGoogleCredentials = (accessToken: string, refreshToken?: string) => {
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
};

// Get authenticated Google API clients
export const getGoogleClients = (accessToken: string, refreshToken?: string) => {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  auth.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return {
    classroom: google.classroom({ version: 'v1', auth }),
    calendar: google.calendar({ version: 'v3', auth }),
    drive: google.drive({ version: 'v3', auth }),
    sheets: google.sheets({ version: 'v4', auth }),
    oauth2: google.oauth2({ version: 'v2', auth }),
  };
};

export default oauth2Client;
