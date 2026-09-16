/**
 * @file file.service.ts
 * @description Unified Facade for Frontend Storage Services.
 * Aggregates and re-exports specialized domain services matching backend presentation controllers:
 * - DriveController   <-> drive.service.ts
 * - UploadController  <-> upload.service.ts
 * - StreamController  <-> stream.service.ts
 * - TrashController   <-> trash.service.ts
 * - QuotaController   <-> quota.service.ts
 */

// ── Re-export Drive Service (DriveController) ────────────────────────────────
export * from './drive.service';

// ── Re-export Upload Service (UploadController) ──────────────────────────────
export * from './upload.service';

// ── Re-export Trash Service (TrashController) ────────────────────────────────
export * from './trash.service';

// ── Re-export Quota Service (QuotaController) ────────────────────────────────
export * from './quota.service';

// ── Re-export Stream Service (StreamController) ──────────────────────────────
export * from './stream.service';

// ── Re-export Version Service (VersionController) ────────────────────────────
export * from './version.service';

