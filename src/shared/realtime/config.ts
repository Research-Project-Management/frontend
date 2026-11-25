'use client';

import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client';
import { getAuthToken, getRealtimeBaseUrl } from '@/shared/lib/api';

export const NAMESPACES = {
  PAGES: '/pages',
  CHAT: '/chat',
  WORK_ITEMS: '/work-items',
} as const;

export type Namespace = (typeof NAMESPACES)[keyof typeof NAMESPACES];

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'offline';

export const TRANSPORT_DEFAULTS: Partial<ManagerOptions & SocketOptions> = {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1_000,
  reconnectionDelayMax: 10_000,
  randomizationFactor: 0.5,
  reconnectionAttempts: Infinity,
  timeout: 20_000,
};

/**
 * Factory: creates a standardized Socket.IO client for a namespace with dynamic JWT auth.
 */
export function createSocket(
  namespace: Namespace,
  overrides?: Partial<ManagerOptions & SocketOptions>,
): Socket {
  const baseUrl = getRealtimeBaseUrl();
  const pathNs = namespace.startsWith('/') ? namespace : `/${namespace}`;

  return io(`${baseUrl || ''}${pathNs}`, {
    ...TRANSPORT_DEFAULTS,
    auth: (cb) => cb({ token: getAuthToken() }),
    ...overrides,
  });
}
