/**
 * Global File Upload Configurations
 * Used primarily for Workspace and Project storage to enforce basic UX validations.
 */

// 50MB max file size for standard storage uploads
export const MAX_STORAGE_FILE_SIZE_BYTES = 50 * 1024 * 1024; 
export const MAX_STORAGE_FILE_SIZE_MB = 50;

// Maximum number of files allowed in a single drag-and-drop batch
export const MAX_FILES_PER_BATCH = 100;

export const UPLOAD_ERROR_MESSAGES = {
  FILE_TOO_LARGE: (filename: string) => `File "${filename}" vượt quá giới hạn ${MAX_STORAGE_FILE_SIZE_MB}MB.`,
  TOO_MANY_FILES: `Bạn chỉ có thể tải lên tối đa ${MAX_FILES_PER_BATCH} file cùng lúc.`,
};

// We don't restrict MIME types for general Drive storage, but this can be extended later
export const ALLOWED_STORAGE_EXTENSIONS = []; // Empty means all allowed
