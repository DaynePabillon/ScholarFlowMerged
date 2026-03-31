"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SheetsProtectionService = void 0;
const googleapis_1 = require("googleapis");
const logger_1 = __importDefault(require("../config/logger"));
class SheetsProtectionService {
    /**
     * Protect a Google Sheet so only specific users can edit
     * Students can view but not edit
     */
    static async protectWBSSheet(accessToken, spreadsheetId, sheetId, adviserEmail, editorEmails = []) {
        try {
            const auth = new googleapis_1.google.auth.OAuth2();
            auth.setCredentials({ access_token: accessToken });
            const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
            // Get sheet properties first
            const spreadsheet = await sheets.spreadsheets.get({
                spreadsheetId,
            });
            const sheet = spreadsheet.data.sheets?.find(s => s.properties?.sheetId === sheetId);
            if (!sheet) {
                logger_1.default.error(`Sheet with ID ${sheetId} not found`);
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
            logger_1.default.info(`Protected sheet ${sheetId} in spreadsheet ${spreadsheetId}`);
            return true;
        }
        catch (error) {
            logger_1.default.error('Error protecting sheet:', error);
            return false;
        }
    }
    /**
     * Protect specific rows (e.g., header row only)
     */
    static async protectHeaderRow(accessToken, spreadsheetId, sheetId, editorEmails) {
        try {
            const auth = new googleapis_1.google.auth.OAuth2();
            auth.setCredentials({ access_token: accessToken });
            const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
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
            logger_1.default.info(`Protected header row in sheet ${sheetId}`);
            return true;
        }
        catch (error) {
            logger_1.default.error('Error protecting header row:', error);
            return false;
        }
    }
    /**
     * Remove all protected ranges from a sheet
     */
    static async removeProtection(accessToken, spreadsheetId, sheetId) {
        try {
            const auth = new googleapis_1.google.auth.OAuth2();
            auth.setCredentials({ access_token: accessToken });
            const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
            // Get existing protected ranges
            const spreadsheet = await sheets.spreadsheets.get({
                spreadsheetId,
                includeGridData: false,
            });
            const sheet = spreadsheet.data.sheets?.find(s => s.properties?.sheetId === sheetId);
            const protectedRanges = sheet?.protectedRanges || [];
            if (protectedRanges.length === 0) {
                logger_1.default.info('No protected ranges to remove');
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
            logger_1.default.info(`Removed ${protectedRanges.length} protected ranges from sheet ${sheetId}`);
            return true;
        }
        catch (error) {
            logger_1.default.error('Error removing protection:', error);
            return false;
        }
    }
    /**
     * Set sheet to view-only for specific users
     */
    static async setViewOnlyAccess(accessToken, spreadsheetId, viewerEmails) {
        try {
            const auth = new googleapis_1.google.auth.OAuth2();
            auth.setCredentials({ access_token: accessToken });
            const drive = googleapis_1.google.drive({ version: 'v3', auth });
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
            logger_1.default.info(`Set view-only access for ${viewerEmails.length} users`);
            return true;
        }
        catch (error) {
            logger_1.default.error('Error setting view-only access:', error);
            return false;
        }
    }
}
exports.SheetsProtectionService = SheetsProtectionService;
exports.default = SheetsProtectionService;
