/**
 * @file use-storage.ts
 * @description Unified Facade for Frontend Storage Hooks.
 * Aggregates and re-exports specialized domain hooks matching backend presentation controllers:
 * - DriveController   <-> use-drive.ts
 * - UploadController  <-> use-upload.ts
 * - StreamController  <-> use-stream.ts
 * - TrashController   <-> use-trash.ts
 * - QuotaController   <-> use-quota.ts
 */

// ── Re-export Drive Hooks (DriveController) ──────────────────────────────────
export * from './use-drive';

// ── Re-export Upload Hooks (UploadController) ────────────────────────────────
export * from './use-upload';

// ── Re-export Trash Hooks (TrashController) ──────────────────────────────────
export * from './use-trash';

// ── Re-export Quota Hooks (QuotaController) ──────────────────────────────────
export * from './use-quota';

// ── Re-export Stream Hooks (StreamController) ────────────────────────────────
export * from './use-stream';
