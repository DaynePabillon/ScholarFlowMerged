import { getGoogleClients } from '../../config/google';
import { query } from '../../config/database';
import logger from '../../config/logger';
import { Readable } from 'stream';

export class GoogleDriveService {
  /**
   * Upload a file to Google Drive
   */
  static async uploadFile(
    fileData: {
      name: string;
      mimeType: string;
      buffer: Buffer;
      folderId?: string;
    },
    userId: string,
    accessToken: string,
    refreshToken?: string
  ) {
    try {
      const { drive } = getGoogleClients(accessToken, refreshToken);

      const fileMetadata: any = {
        name: fileData.name,
      };

      if (fileData.folderId) {
        fileMetadata.parents = [fileData.folderId];
      }

      const media = {
        mimeType: fileData.mimeType,
        body: Readable.from(fileData.buffer),
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink',
      });

      logger.info(`Uploaded file ${response.data.id} to Google Drive`);

      // Save file metadata to database
      const result = await query(
        `INSERT INTO drive_files (
          google_drive_id, name, mime_type, size, web_view_link, 
          web_content_link, thumbnail_link, owner_id, parent_folder_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          response.data.id,
          response.data.name,
          response.data.mimeType,
          response.data.size,
          response.data.webViewLink,
          response.data.webContentLink,
          response.data.thumbnailLink,
          userId,
          fileData.folderId,
        ]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error uploading file to Drive:', error);
      throw new Error('Failed to upload file to Google Drive');
    }
  }

  /**
   * Create a folder in Google Drive
   */
  static async createFolder(
    folderName: string,
    parentFolderId: string | undefined,
    accessToken: string,
    refreshToken?: string
  ) {
    try {
      const { drive } = getGoogleClients(accessToken, refreshToken);

      const fileMetadata: any = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      };

      if (parentFolderId) {
        fileMetadata.parents = [parentFolderId];
      }

      const response = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id, name',
      });

      logger.info(`Created folder ${response.data.id} in Google Drive`);
      return response.data;
    } catch (error) {
      logger.error('Error creating folder:', error);
      throw new Error('Failed to create folder in Google Drive');
    }
  }

  /**
   * Get file metadata from Google Drive
   */
  static async getFileMetadata(
    fileId: string,
    accessToken: string,
    refreshToken?: string
  ) {
    try {
      const { drive } = getGoogleClients(accessToken, refreshToken);

      const response = await drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, parents',
      });

      return response.data;
    } catch (error) {
      logger.error('Error getting file metadata:', error);
      throw new Error('Failed to get file metadata');
    }
  }

  /**
   * List files in a folder
   */
  static async listFiles(
    folderId: string | undefined,
    accessToken: string,
    refreshToken?: string
  ) {
    try {
      const { drive } = getGoogleClients(accessToken, refreshToken);

      const query = folderId ? `'${folderId}' in parents and trashed=false` : 'trashed=false';

      const response = await drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, size, webViewLink, thumbnailLink, createdTime, modifiedTime)',
        orderBy: 'modifiedTime desc',
      });

      return response.data.files || [];
    } catch (error) {
      logger.error('Error listing files:', error);
      throw new Error('Failed to list files from Google Drive');
    }
  }

  /**
   * Delete a file from Google Drive
   */
  static async deleteFile(
    fileId: string,
    accessToken: string,
    refreshToken?: string
  ) {
    try {
      const { drive } = getGoogleClients(accessToken, refreshToken);

      await drive.files.delete({
        fileId: fileId,
      });

      logger.info(`Deleted file ${fileId} from Google Drive`);

      // Delete from database
      await query('DELETE FROM drive_files WHERE google_drive_id = $1', [fileId]);

      return { success: true };
    } catch (error) {
      logger.error('Error deleting file:', error);
      throw new Error('Failed to delete file from Google Drive');
    }
  }

  /**
   * Share a file with specific users
   */
  static async shareFile(
    fileId: string,
    emailAddress: string,
    role: 'reader' | 'writer' | 'commenter',
    accessToken: string,
    refreshToken?: string
  ) {
    try {
      const { drive } = getGoogleClients(accessToken, refreshToken);

      const response = await drive.permissions.create({
        fileId: fileId,
        requestBody: {
          type: 'user',
          role: role,
          emailAddress: emailAddress,
        },
        fields: 'id',
      });

      logger.info(`Shared file ${fileId} with ${emailAddress} as ${role}`);
      return response.data;
    } catch (error) {
      logger.error('Error sharing file:', error);
      throw new Error('Failed to share file');
    }
  }

  /**
   * Get user's files from database
   */
  static async getUserFiles(userId: string) {
    try {
      const result = await query(
        `SELECT * FROM drive_files
        WHERE owner_id = $1
        ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error fetching user files:', error);
      throw new Error('Failed to fetch user files');
    }
  }

  /**
   * Link a file to a submission
   */
  static async linkFileToSubmission(submissionId: string, fileId: string) {
    try {
      await query(
        `INSERT INTO submission_files (submission_id, drive_file_id)
        VALUES ($1, $2)
        ON CONFLICT (submission_id, drive_file_id) DO NOTHING`,
        [submissionId, fileId]
      );

      logger.info(`Linked file ${fileId} to submission ${submissionId}`);
      return { success: true };
    } catch (error) {
      logger.error('Error linking file to submission:', error);
      throw new Error('Failed to link file to submission');
    }
  }

  /**
   * Get files for a submission
   */
  static async getSubmissionFiles(submissionId: string) {
    try {
      const result = await query(
        `SELECT df.* FROM drive_files df
        JOIN submission_files sf ON df.id = sf.drive_file_id
        WHERE sf.submission_id = $1`,
        [submissionId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error fetching submission files:', error);
      throw new Error('Failed to fetch submission files');
    }
  }
}

export default GoogleDriveService;
