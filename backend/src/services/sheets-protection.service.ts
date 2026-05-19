import { google } from 'googleapis';
import logger from '../config/logger';

export class SheetsProtectionService {
  /**
   * Protect a Google Sheet so only specific users can edit
   * Students can view but not edit
   */
  static async protectWBSSheet(
    accessToken: string,
    spreadsheetId: string,
    sheetId: number,
    adviserEmail: string,
    editorEmails: string[] = []
  ): Promise<boolean> {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const sheets = google.sheets({ version: 'v4', auth });

      // Get sheet properties first
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
      });

      const sheet = spreadsheet.data.sheets?.find(s => s.properties?.sheetId === sheetId);
      if (!sheet) {
        logger.error(`Sheet with ID ${sheetId} not found`);
        return false;
      }

      const gridProperties = sheet.properties?.gridProperties;
      const rowCount = gridProperties?.rowCount || 1000;
      const columnCount = gridProperties?.columnCount || 26;

      // Create protected range for the entire sheet
      const requests = [
        {
          addProtectedRange: {
            protectedRange: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: rowCount,
                startColumnIndex: 0,
                endColumnIndex: columnCount,
              },
              description: 'WBS Template - Protected for Students',
              warningOnly: false,
              editors: {
                users: [adviserEmail, ...editorEmails],
              },
            },
          },
        },
      ];

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests,
        },
      });

      logger.info(`Protected sheet ${sheetId} in spreadsheet ${spreadsheetId}`);
      return true;
    } catch (error) {
      logger.error('Error protecting sheet:', error);
      return false;
    }
  }

  /**
   * Protect specific rows (e.g., header row only)
   */
  static async protectHeaderRow(
    accessToken: string,
    spreadsheetId: string,
    sheetId: number,
    editorEmails: string[]
  ): Promise<boolean> {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const sheets = google.sheets({ version: 'v4', auth });

      const requests = [
        {
          addProtectedRange: {
            protectedRange: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: 1, // Only first row
              },
              description: 'Header Row - Protected',
              warningOnly: false,
              editors: {
                users: editorEmails,
              },
            },
          },
        },
      ];

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests,
        },
      });

      logger.info(`Protected header row in sheet ${sheetId}`);
      return true;
    } catch (error) {
      logger.error('Error protecting header row:', error);
      return false;
    }
  }

  /**
   * Remove all protected ranges from a sheet
   */
  static async removeProtection(
    accessToken: string,
    spreadsheetId: string,
    sheetId: number
  ): Promise<boolean> {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const sheets = google.sheets({ version: 'v4', auth });

      // Get existing protected ranges
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
        includeGridData: false,
      });

      const sheet = spreadsheet.data.sheets?.find(s => s.properties?.sheetId === sheetId);
      const protectedRanges = sheet?.protectedRanges || [];

      if (protectedRanges.length === 0) {
        logger.info('No protected ranges to remove');
        return true;
      }

      // Create delete requests for all protected ranges
      const requests = protectedRanges.map(range => ({
        deleteProtectedRange: {
          protectedRangeId: range.protectedRangeId,
        },
      }));

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests,
        },
      });

      logger.info(`Removed ${protectedRanges.length} protected ranges from sheet ${sheetId}`);
      return true;
    } catch (error) {
      logger.error('Error removing protection:', error);
      return false;
    }
  }

  /**
   * Set sheet to view-only for specific users
   */
  static async setViewOnlyAccess(
    accessToken: string,
    spreadsheetId: string,
    viewerEmails: string[]
  ): Promise<boolean> {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const drive = google.drive({ version: 'v3', auth });

      // Add viewers with read-only permission
      for (const email of viewerEmails) {
        await drive.permissions.create({
          fileId: spreadsheetId,
          requestBody: {
            type: 'user',
            role: 'reader',
            emailAddress: email,
          },
        });
      }

      logger.info(`Set view-only access for ${viewerEmails.length} users`);
      return true;
    } catch (error) {
      logger.error('Error setting view-only access:', error);
      return false;
    }
  }
}

export default SheetsProtectionService;
