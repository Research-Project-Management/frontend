import type { Text } from '@codemirror/state';
import * as Y from 'yjs';

function uint8ToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(value: string): Uint8Array | null {
  try {
    if (typeof Buffer !== 'undefined') {
      const buf = Buffer.from(value, 'base64');
      return buf.length > 0 ? new Uint8Array(buf) : null;
    }
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.length > 0 ? bytes : null;
  } catch {
    return null;
  }
}

export function encodeYjsAnchor(yText: Y.Text | null | undefined, index: number): string | null {
  if (!yText) return null;
  try {
    const safeIdx = Math.max(0, Math.min(index, yText.length));
    const rel = Y.createRelativePositionFromTypeIndex(yText, safeIdx);
    const encoded = Y.encodeRelativePosition(rel);
    return encoded.length > 0 ? uint8ToBase64(encoded) : null;
  } catch {
    return null;
  }
}

export function decodeYjsAnchor(yDoc: Y.Doc | null | undefined, encodedBase64?: string | null): number | null {
  if (!yDoc || !encodedBase64) return null;
  try {
    const bytes = base64ToUint8(encodedBase64);
    if (!bytes) return null;
    const rel = Y.decodeRelativePosition(bytes);
    const abs = Y.createAbsolutePositionFromRelativePosition(rel, yDoc);
    return abs && typeof abs.index === 'number' ? abs.index : null;
  } catch {
    return null;
  }
}

export function resolveYjsAnchorRange(
  doc: Text,
  yDoc: Y.Doc | null | undefined,
  anchorStart?: string | null,
  anchorEnd?: string | null,
): { from: number; to: number } | null {
  if (!yDoc || !anchorStart || !anchorEnd) return null;
  const from = decodeYjsAnchor(yDoc, anchorStart);
  const to = decodeYjsAnchor(yDoc, anchorEnd);
  if (from === null || to === null) return null;
  const clampedFrom = Math.max(0, Math.min(from, doc.length));
  const clampedTo = Math.max(clampedFrom, Math.min(to, doc.length));
  return clampedFrom <= clampedTo ? { from: clampedFrom, to: clampedTo } : null;
}
