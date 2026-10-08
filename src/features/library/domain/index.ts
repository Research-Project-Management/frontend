/**
 * Features / Library - Client Presentation Adapters & View Helpers
 *
 * ARCHITECTURAL SOVEREIGNTY NOTE:
 * The Backend Server (backend/src/modules/library) is the authoritative
 * SINGLE SOURCE OF TRUTH for all Library business logic, bibliographic domain
 * entities, metadata extraction/normalization, CSL citation formatting,
 * author parsing, duplicate clustering, and RBAC permission enforcement.
 *
 * This module contains lightweight UI presentation adapters, display helpers,
 * and form state utilities to keep the client thin, performant, and decoupled.
 */

export * from './creators';
export * from './identifiers';
export * from './citations';
export * from './diff';
export * from './item-url';
export * from './metadata';
export * from './library-permissions.policy';
