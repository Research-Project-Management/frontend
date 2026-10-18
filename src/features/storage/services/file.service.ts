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

export * from './drive.service';
export * from './upload.service';


