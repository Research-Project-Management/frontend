'use client';

/**
 * use-synctex.ts
 *
 * Frontend hooks mirroring Backend `modules/document/synctex/`:
 *  - useForwardSync
 *  - useReverseSync
 */

import { useMutation } from '@tanstack/react-query';
import {
  synctexService,
  type ForwardSyncPayload,
  type ForwardSyncResult,
  type ReverseSyncPayload,
  type ReverseSyncResult,
} from '../services/synctex.service';

export function useForwardSync() {
  return useMutation<ForwardSyncResult, Error, ForwardSyncPayload>({
    mutationFn: (payload) => synctexService.forwardSync(payload),
  });
}

export function useReverseSync() {
  return useMutation<ReverseSyncResult, Error, ReverseSyncPayload>({
    mutationFn: (payload) => synctexService.reverseSync(payload),
  });
}
