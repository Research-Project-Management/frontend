/**
 * yjs-socket-provider.ts
 *
 * Clean decoupled provider interface for editor UI.
 */

import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';

export interface CollaboratorUser {
  id: string;
  name: string;
  avatar?: string | null;
  color?: string;
  role?: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface YjsSocketIOProviderOptions {
  user?: CollaboratorUser;
  onStatusChange?: (status: ConnectionStatus) => void;
  onSynced?: () => void;
}

export class YjsSocketIOProvider {
  public readonly doc: Y.Doc;
  public readonly awareness: Awareness;
  public readonly pageId: string;
  public status: ConnectionStatus = 'connected';
  public isSynced: boolean = true;

  constructor(
    pageId: string,
    doc: Y.Doc,
    options: YjsSocketIOProviderOptions = {},
  ) {
    this.pageId = pageId;
    this.doc = doc;
    this.awareness = new Awareness(doc);

    if (options.user) {
      this.setLocalUser(options.user);
    }

    if (options.onStatusChange) {
      options.onStatusChange('connected');
    }
    if (options.onSynced) {
      options.onSynced();
    }
  }

  public setLocalUser(user: CollaboratorUser): void {
    this.awareness.setLocalStateField('user', {
      id: user.id,
      name: user.name || 'Anonymous Researcher',
      avatar: user.avatar,
      color: user.color || '#3B82F6',
      role: user.role || 'contributor',
    });
  }

  public triggerCheckpoint(): void {}

  public destroy(): void {
    this.awareness.destroy();
  }
}
