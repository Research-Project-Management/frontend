import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  documentStorage,
  extractStableUserNamespace,
  hasPdfMagicBytes,
  isValidDocumentBinary,
  calculateAdaptiveReaderQuota,
  MIN_READER_DISK_FLOOR_BYTES,
  MAX_READER_DISK_CEILING_BYTES,
} from '@/features/library/domain/reader-document-storage.domain';

function createMockJwt(payload: Record<string, unknown>, signatureSuffix: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.${signatureSuffix}`;
}

describe('Tier 4 Client Storage: Persistent Document Binary Engine', () => {
  const TEST_KEY_1 = 'test:paper:quantum-computing-2026';
  const TEST_KEY_2 = 'test:paper:diffusion-transformers';
  const TEST_KEY_3 = 'test:paper:mamba-state-space';

  beforeEach(async () => {
    await documentStorage.clearAll();
  });

  afterEach(async () => {
    await documentStorage.clearAll();
  });

  it('saves and retrieves binary payload with byte-exact integrity', async () => {
    const rawContent = '%PDF-1.7-MOCK-HEADER\nQuantum Computing Research Paper Content';
    const sampleBlob = new Blob([rawContent], { type: 'application/pdf' });

    await documentStorage.saveDocumentBinary(TEST_KEY_1, sampleBlob);

    const exists = await documentStorage.hasDocumentBinary(TEST_KEY_1);
    expect(exists).toBe(true);

    const retrievedBlob = await documentStorage.getDocumentBinary(TEST_KEY_1);
    expect(retrievedBlob).not.toBeNull();
    expect(retrievedBlob?.type).toBe('application/pdf');

    const retrievedText = await retrievedBlob!.text();
    expect(retrievedText).toBe(rawContent);
  });

  it('returns null on cache miss for non-existent documents', async () => {
    const result = await documentStorage.getDocumentBinary('non:existent:paper:key');
    expect(result).toBeNull();

    const exists = await documentStorage.hasDocumentBinary('non:existent:paper:key');
    expect(exists).toBe(false);
  });

  it('deletes stored document and reclaims storage space', async () => {
    const sampleBlob = new Blob(['%PDF-1.5 sample-data'], { type: 'application/pdf' });
    await documentStorage.saveDocumentBinary(TEST_KEY_2, sampleBlob);

    expect(await documentStorage.hasDocumentBinary(TEST_KEY_2)).toBe(true);

    const deleted = await documentStorage.deleteDocumentBinary(TEST_KEY_2);
    expect(deleted).toBe(true);
    expect(await documentStorage.hasDocumentBinary(TEST_KEY_2)).toBe(false);
  });

  it('accurately calculates storage stats and adaptive quota from W3C & arXiv survey benchmarks', async () => {
    const blob1 = new Blob(['AAAA'.repeat(100)], { type: 'application/pdf' }); // 400 bytes
    const blob2 = new Blob(['BBBB'.repeat(200)], { type: 'application/pdf' }); // 800 bytes

    await documentStorage.saveDocumentBinary(TEST_KEY_1, blob1);
    await documentStorage.saveDocumentBinary(TEST_KEY_3, blob2);

    const stats = await documentStorage.getStorageStats();
    expect(stats.count).toBeGreaterThanOrEqual(2);
    expect(stats.totalBytes).toBeGreaterThanOrEqual(1200);
    expect(stats.maxBytes).toBe(MAX_READER_DISK_CEILING_BYTES); // 300 MB Zotero/Firefox safe ceiling
    expect(stats.maxCachedDocs).toBe(100); // 300 MB / 3 MB arXiv mean = 100 papers

    // Low-storage device (e.g., 200 MB total origin quota -> 20% = 40 MB -> clamped to 64 MB floor)
    const constrainedPolicy = calculateAdaptiveReaderQuota(200 * 1024 * 1024);
    expect(constrainedPolicy.maxDiskBytes).toBe(MIN_READER_DISK_FLOOR_BYTES);
    expect(constrainedPolicy.maxCachedDocs).toBe(21);

    // Medium device (e.g., 1 GB origin quota -> 20% = 200 MB -> ~66 papers)
    const mediumPolicy = calculateAdaptiveReaderQuota(1000 * 1024 * 1024);
    expect(mediumPolicy.maxDiskBytes).toBe(200 * 1024 * 1024);
    expect(mediumPolicy.maxCachedDocs).toBe(66);

    // Workstation SSD (e.g., 50 GB origin quota -> clamped to 300 MB ceiling, 100 papers)
    const workstationPolicy = calculateAdaptiveReaderQuota(50 * 1024 * 1024 * 1024);
    expect(workstationPolicy.maxDiskBytes).toBe(MAX_READER_DISK_CEILING_BYTES);
    expect(workstationPolicy.maxCachedDocs).toBe(100);
  });

  it('Scenario 1 (JWT Rotation Resilience): preserves identical user namespace across token refreshes', () => {
    const tokenMorning = createMockJwt(
      { sub: 'researcher_42', iat: 1700000000, exp: 1700003600 },
      'sig_morning_9999999999999999',
    );
    const tokenAfternoon = createMockJwt(
      { sub: 'researcher_42', iat: 1700050000, exp: 1700053600 },
      'sig_afternoon_1111111111111111',
    );

    const ns1 = extractStableUserNamespace(tokenMorning);
    const ns2 = extractStableUserNamespace(tokenAfternoon);

    expect(ns1).toBe('usr_researcher_42');
    expect(ns2).toBe('usr_researcher_42');
    expect(ns1).toBe(ns2);
    expect(extractStableUserNamespace(null)).toBe('anon');
  });

  it('Scenario 2 (Multi-User Shared Lab PC Isolation): purges only logged-out user scope while preserving other users', async () => {
    const aliceKey = 'usr_alice:user:/papers/secret-alice.pdf';
    const bobKey = 'usr_bob:user:/papers/public-bob.pdf';

    await documentStorage.saveDocumentBinary(aliceKey, new Blob(['%PDF-1.7 Alice Paper']));
    await documentStorage.saveDocumentBinary(bobKey, new Blob(['%PDF-1.7 Bob Paper']));

    expect(await documentStorage.hasDocumentBinary(aliceKey)).toBe(true);
    expect(await documentStorage.hasDocumentBinary(bobKey)).toBe(true);

    const purgedCount = await documentStorage.clearUserScope('usr_alice');
    expect(purgedCount).toBe(1);

    expect(await documentStorage.hasDocumentBinary(aliceKey)).toBe(false);
    expect(await documentStorage.hasDocumentBinary(bobKey)).toBe(true);
  });

  it('Scenario 3 (Poisoned Cache Prevention): rejects 0-byte, HTML error pages, and JSON error payloads', async () => {
    const emptyBlob = new Blob([], { type: 'application/pdf' });
    const htmlCaptivePortal = new Blob(
      ['<!DOCTYPE html><html><body>502 Bad Gateway</body></html>'],
      { type: 'application/pdf' },
    );
    const jsonErrorPayload = new Blob(
      ['{"error":"Unauthorized","statusCode":401}'],
      { type: 'application/pdf' },
    );

    await documentStorage.saveDocumentBinary('poison:empty', emptyBlob);
    await documentStorage.saveDocumentBinary('poison:html', htmlCaptivePortal);
    await documentStorage.saveDocumentBinary('poison:json', jsonErrorPayload);

    expect(await documentStorage.hasDocumentBinary('poison:empty')).toBe(false);
    expect(await documentStorage.hasDocumentBinary('poison:html')).toBe(false);
    expect(await documentStorage.hasDocumentBinary('poison:json')).toBe(false);

    const validPdfBytes = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj').buffer;
    expect(hasPdfMagicBytes(validPdfBytes)).toBe(true);
    expect(isValidDocumentBinary(validPdfBytes, 'application/pdf')).toBe(true);
  });

  it('Scenario 4 & 5 (Emergency Quota Eviction & Full Reset): evicts oldest fraction by LRU and clears all', async () => {
    await documentStorage.saveDocumentBinary('doc:1', new Blob(['%PDF-1.7 Doc 1']));
    await new Promise((r) => setTimeout(r, 15));
    await documentStorage.saveDocumentBinary('doc:2', new Blob(['%PDF-1.7 Doc 2']));
    await new Promise((r) => setTimeout(r, 15));
    await documentStorage.saveDocumentBinary('doc:3', new Blob(['%PDF-1.7 Doc 3']));
    await new Promise((r) => setTimeout(r, 15));
    await documentStorage.saveDocumentBinary('doc:4', new Blob(['%PDF-1.7 Doc 4']));

    // Touch doc:1 so doc:2 and doc:3 become the oldest LRU entries
    await documentStorage.getDocumentBinary('doc:1');
    await new Promise((r) => setTimeout(r, 10));

    const evicted = await documentStorage.evictOldestFraction(0.5);
    expect(evicted).toBe(2);

    // Oldest two (doc:2, doc:3) should be evicted; newest two (doc:4, doc:1) survive
    expect(await documentStorage.hasDocumentBinary('doc:2')).toBe(false);
    expect(await documentStorage.hasDocumentBinary('doc:3')).toBe(false);
    expect(await documentStorage.hasDocumentBinary('doc:1')).toBe(true);
    expect(await documentStorage.hasDocumentBinary('doc:4')).toBe(true);

    await documentStorage.clearAll();
    const statsAfterClear = await documentStorage.getStorageStats();
    expect(statsAfterClear.count).toBe(0);
    expect(statsAfterClear.totalBytes).toBe(0);
  });
});
