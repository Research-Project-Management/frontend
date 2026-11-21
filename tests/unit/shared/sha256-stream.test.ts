import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  Sha256Stream,
  sha256HexOfBlobStreaming,
} from '@/shared/lib/sha256-stream';
import { computeClientSha256Hex } from '@/shared/lib/smart-upload-engine';

const nodeSha = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

describe('Sha256Stream', () => {
  it('matches known vectors (empty, abc)', () => {
    expect(new Sha256Stream().digestHex()).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(new Sha256Stream().update(Buffer.from('abc')).digestHex()).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('matches node crypto for odd-sized, split updates across block boundaries', () => {
    const data = Buffer.alloc(1_000_003);
    for (let i = 0; i < data.length; i++) data[i] = (i * 31 + 7) & 0xff;
    const hasher = new Sha256Stream();
    let off = 0;
    for (const step of [1, 63, 64, 65, 1000, 4097, 99999]) {
      hasher.update(data.subarray(off, off + step));
      off += step;
    }
    hasher.update(data.subarray(off));
    expect(hasher.digestHex()).toBe(nodeSha(data));
  });

  it('hashes a multi-slice Blob identically to node crypto and honors abort', async () => {
    const data = Buffer.alloc(5 * 1024 * 1024 + 123, 0x5a);
    const blob = new Blob([data]);
    expect(await sha256HexOfBlobStreaming(blob, undefined, 1024 * 1024)).toBe(
      nodeSha(data),
    );

    const controller = new AbortController();
    controller.abort();
    await expect(
      sha256HexOfBlobStreaming(blob, controller.signal),
    ).rejects.toThrow('Upload aborted by user');
  });

  it('computeClientSha256Hex streams files above the fast-path size', async () => {
    const data = Buffer.alloc(9 * 1024 * 1024, 0x11);
    expect(await computeClientSha256Hex(new Blob([data]))).toBe(nodeSha(data));
    expect(await computeClientSha256Hex(new Blob([]))).toBeUndefined();
  });
});
