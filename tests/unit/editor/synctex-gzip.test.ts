import { describe, it, expect } from 'vitest';
import { gzipSync } from 'node:zlib';
import {
  decompressSyncTeXData,
  isBase64GzipSyncTeX,
  parseSyncTeX,
} from '@/features/editor/domain/pdf/synctex-index';

const PLAIN = [
  'SyncTeX Version:1',
  'Input:1:./main.tex',
  'Unit:1',
  'Content:',
  '{1',
  '[1,5:4736286,4736286:0,0',
  'h1,5:4736286,4736286:100,10',
  '}1',
].join('\n');

describe('SyncTeX base64 gzip payloads', () => {
  it('detects H4sI base64-gzip prefix', () => {
    const b64 = gzipSync(Buffer.from(PLAIN)).toString('base64');
    expect(b64.startsWith('H4sI')).toBe(true);
    expect(isBase64GzipSyncTeX(b64)).toBe(true);
    expect(isBase64GzipSyncTeX(PLAIN)).toBe(false);
  });

  it('decompresses base64 gzip and yields a non-empty map', async () => {
    const b64 = gzipSync(Buffer.from(PLAIN)).toString('base64');
    const text = await decompressSyncTeXData(b64);
    expect(text).toContain('Input:1:./main.tex');
    const map = parseSyncTeX(text);
    expect(map.lineToPage.get(5)).toBe(1);
    expect(map.tagToPath.get(1)).toBe('./main.tex');
  });

  it('parsing base64 directly (old bug) produces an empty map', () => {
    const b64 = gzipSync(Buffer.from(PLAIN)).toString('base64');
    expect(parseSyncTeX(b64).lineToPage.size).toBe(0);
  });

  it('keeps plain-text path untouched', async () => {
    expect(await decompressSyncTeXData(PLAIN)).toBe(PLAIN);
  });

  it('returns empty string for corrupt gzip payload', async () => {
    expect(await decompressSyncTeXData('H4sI!!!notbase64')).toBe('');
  });
});
