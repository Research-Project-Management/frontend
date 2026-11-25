/**
 * shared/types/bff.types.ts
 * Canonical BFF protocol envelope types shared across frontend features.
 */

export interface BffResponseMeta {
  channel: 'web';
  partial: boolean;
  degradedSections: string[];
  timedOutSections: string[];
  circuitOpenSections: string[];
  cacheHit: boolean;
  generatedAt: string;
  durationMs: number;
}

export interface BffEnvelope<TData> {
  data: TData;
  meta: BffResponseMeta;
}
