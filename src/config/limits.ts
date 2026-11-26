/**
 * Global Upload & File Size Limits Configuration.
 *
 * Centralizes file size thresholds across Chat, Library, Editor, and Projects.
 */
const MB = 1024 * 1024;

export const UPLOAD_LIMITS = {
  /** Chat image attachment maximum size (20 MB) */
  CHAT_IMAGE_BYTES: 20 * MB,
  /** Chat generic file attachment maximum size (50 MB) */
  CHAT_FILE_BYTES: 50 * MB,
  /** Document import (.docx / .md) & quick identifier extraction limit (25 MB) */
  DOCUMENT_IMPORT_BYTES: 25 * MB,
  /** Library reference ingestion upload limit (100 MB) */
  LIBRARY_INGESTION_BYTES: 100 * MB,
  /** Smart upload engine multipart threshold (15 MB) */
  MULTIPART_THRESHOLD_BYTES: 15 * MB,
  /** Maximum file size hashed client-side (512 MB) */
  MAX_CLIENT_HASH_BYTES: 512 * MB,
  /** Fast-path direct hashing threshold (8 MB) */
  SMALL_HASH_FASTPATH_BYTES: 8 * MB,
} as const;
