/**
 * io/index.ts
 *
 * Barrel export for Editor Infrastructure & I/O Layer (API, Storage, Realtime).
 */

export * as api from './api';
export * as storage from './storage/draft-storage';
export * as realtime from './realtime/collaboration.socket';

// Flattened direct exports for convenience
export * from './api';
export * from './storage/draft-storage';
export * from './realtime/collaboration.socket';
