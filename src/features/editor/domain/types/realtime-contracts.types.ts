/**
 * realtime-contracts.types.ts
 *
 * Strongly-typed WebSocket Event Contracts & Branded IDs (Matt Pocock TypeScript Patterns).
 * Conforms to ADR-0002 & spec-kit realtime protocol contract.
 */

// ── Branded ID Types (Matt Pocock Pattern to prevent passing wrong IDs) ───────
declare const BrandSymbol: unique symbol;
export type Brand<T, B> = T & { readonly [BrandSymbol]: B };

export type ProjectId = Brand<string, 'ProjectId'>;
export type DocId = Brand<string, 'DocId'>;
export type UserId = Brand<string, 'UserId'>;

export function asProjectId(id: string): ProjectId {
  return id as ProjectId;
}

export function asDocId(id: string): DocId {
  return id as DocId;
}

export function asUserId(id: string): UserId {
  return id as UserId;
}

// ── Presence & Cursor Types ──────────────────────────────────────────────────
export interface UserPresenceMeta {
  readonly id: UserId;
  readonly name: string;
  readonly color: string;
  readonly avatar?: string | null;
  readonly role?: 'owner' | 'editor' | 'viewer';
}

export interface CursorCoordinate {
  readonly line: number;
  readonly column: number;
  readonly offset: number;
}

// ── Discriminated Unions for Client-to-Server Realtime Events ─────────────────
export type RealtimeClientEvent =
  | {
      readonly type: 'project:join';
      readonly projectId: ProjectId;
    }
  | {
      readonly type: 'project:leave';
      readonly projectId: ProjectId;
    }
  | {
      readonly type: 'doc:join';
      readonly projectId: ProjectId;
      readonly docId: DocId;
    }
  | {
      readonly type: 'doc:leave';
      readonly projectId: ProjectId;
      readonly docId: DocId;
    }
  | {
      readonly type: 'doc:sync-step-1';
      readonly projectId: ProjectId;
      readonly docId: DocId;
      readonly data: Uint8Array;
    }
  | {
      readonly type: 'doc:sync-step-2';
      readonly projectId: ProjectId;
      readonly docId: DocId;
      readonly data: Uint8Array;
    }
  | {
      readonly type: 'doc:sync-update';
      readonly projectId: ProjectId;
      readonly docId: DocId;
      readonly data: Uint8Array;
    }
  | {
      readonly type: 'doc:cursor';
      readonly projectId: ProjectId;
      readonly docId: DocId;
      readonly cursor: CursorCoordinate;
    };

// ── Discriminated Unions for Server-to-Client Realtime Events ─────────────────
export type RealtimeServerEvent =
  | {
      readonly type: 'doc:sync-update';
      readonly projectId: ProjectId;
      readonly docId: DocId;
      readonly data: Uint8Array;
    }
  | {
      readonly type: 'doc:user-joined';
      readonly projectId: ProjectId;
      readonly docId: DocId;
      readonly user: UserPresenceMeta;
    }
  | {
      readonly type: 'doc:user-left';
      readonly projectId: ProjectId;
      readonly docId: DocId;
      readonly userId: UserId;
    }
  | {
      readonly type: 'doc:cursor-updated';
      readonly projectId: ProjectId;
      readonly docId: DocId;
      readonly userId: UserId;
      readonly cursor: CursorCoordinate;
    }
  | {
      readonly type: 'compile:flush-required';
      readonly projectId: ProjectId;
      readonly correlationId: string;
    };
