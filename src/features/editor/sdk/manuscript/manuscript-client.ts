/**
 * manuscript-client.ts
 *
 * UNIFIED MANUSCRIPT CLIENT SDK
 *
 * Facade over the consolidated manuscript-api.client.ts (Matt Pocock Deep Module Pattern).
 * Location: frontend/src/features/editor/sdk/manuscript/manuscript-client.ts
 */

export * from './base';
export * from './types';
export * from './manuscript-api.client';
export type { TextRangeDto } from './types';
import { manuscriptService } from './manuscript-api.client';

export { manuscriptService, manuscriptService as manuscriptApi };
export default manuscriptService;
