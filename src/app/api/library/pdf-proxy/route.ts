import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';
import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '@/config/env';
import { isTokenValid } from '@/shared/utils/auth-token.util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VERIFIED_TOKEN_CACHE_MAX = 500;
const VERIFIED_TOKEN_TTL_MS = 60_000;
const verifiedTokenCache = new Map<string, number>();

function extractTokenExpSeconds(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as { exp?: unknown } | null;
    return typeof payload?.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp : null;
  } catch {
    return null;
  }
}

function verifyHmacJwtLocally(token: string, secret: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as {
      alg?: string;
    };
    const algMap: Record<string, string> = {
      HS256: 'sha256',
      HS384: 'sha384',
      HS512: 'sha512',
    };
    const hashAlg = header?.alg ? algMap[header.alg] : undefined;
    if (!hashAlg) return false;
    const expectedSig = crypto
      .createHmac(hashAlg, secret)
      .update(`${parts[0]}.${parts[1]}`)
      .digest();
    const actualSig = Buffer.from(parts[2], 'base64url');
    if (expectedSig.length !== actualSig.length) return false;
    return crypto.timingSafeEqual(expectedSig, actualSig);
  } catch {
    return false;
  }
}

async function verifyAccessToken(token: string | null | undefined): Promise<boolean> {
  if (!token || !isTokenValid(token)) return false;
  const trimmed = token.trim();
  const expSeconds = extractTokenExpSeconds(trimmed);
  const nowSeconds = Math.floor(Date.now() / 1000);
  // Reject tokens without an explicit unexpired exp claim
  if (expSeconds === null || expSeconds <= nowSeconds) return false;

  const jwtSecret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;
  if (jwtSecret) {
    return verifyHmacJwtLocally(trimmed, jwtSecret);
  }

  const tokenHash = crypto.createHash('sha256').update(trimmed).digest('hex');
  const cachedUntil = verifiedTokenCache.get(tokenHash);
  if (cachedUntil && cachedUntil > Date.now()) {
    return true;
  }

  try {
    const authCheckUrl = `${API_BASE_URL.replace(/\/$/, '')}/api/users/me`;
    const res = await fetch(authCheckUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${trimmed}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(3_000),
      cache: 'no-store',
    });
    if (!res.ok) return false;
    if (verifiedTokenCache.size >= VERIFIED_TOKEN_CACHE_MAX) {
      const oldestKey = verifiedTokenCache.keys().next().value;
      if (oldestKey) verifiedTokenCache.delete(oldestKey);
    }
    const expiresAtMs = Math.min(Date.now() + VERIFIED_TOKEN_TTL_MS, expSeconds * 1000);
    verifiedTokenCache.set(tokenHash, expiresAtMs);
    return true;
  } catch {
    return false;
  }
}

const DISALLOWED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '::',
  'metadata.google.internal',
  'metadata.goog',
  '169.254.169.254',
]);

const MAX_PAYLOAD_BYTES = 52_428_800; // 50 MB
const MAX_REDIRECTS = 5;

function normalizeHostname(raw: string): string {
  return raw.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
}

function isDisallowedIp(ip: string): boolean {
  const cleanIp = ip.toLowerCase().trim();
  if (
    cleanIp === '127.0.0.1' ||
    cleanIp === '0.0.0.0' ||
    cleanIp === '::1' ||
    cleanIp === '::' ||
    cleanIp.startsWith('127.') ||
    cleanIp.startsWith('0.') ||
    cleanIp.startsWith('10.') ||
    cleanIp.startsWith('192.168.') ||
    cleanIp.startsWith('169.254.') ||
    cleanIp.startsWith('192.0.0.') ||
    cleanIp.startsWith('192.0.2.') ||
    cleanIp.startsWith('198.51.100.') ||
    cleanIp.startsWith('203.0.113.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp) ||
    /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(cleanIp) ||
    /^198\.1[89]\./.test(cleanIp) ||
    /^(22[4-9]|23[0-9]|24[0-9]|25[0-5])\./.test(cleanIp)
  ) {
    return true;
  }
  if (cleanIp.includes(':')) {
    if (
      cleanIp === '::1' ||
      cleanIp === '::' ||
      /^0*:0*:0*:0*:0*:0*:0*:[01]$/.test(cleanIp) ||
      cleanIp.startsWith('fc') ||
      cleanIp.startsWith('fd') ||
      /^fe[89ab][0-9a-f]:/i.test(cleanIp) ||
      cleanIp.startsWith('ff') ||
      cleanIp.startsWith('::ffff:') ||
      /^0*:0*:0*:0*:0*:ffff:/i.test(cleanIp) ||
      cleanIp.startsWith('64:ff9b:') ||
      cleanIp.startsWith('2002:')
    ) {
      return true;
    }
  }
  return false;
}

function isPrivateOrDisallowedHost(rawHostname: string): boolean {
  const hostname = normalizeHostname(rawHostname);
  if (!hostname || DISALLOWED_HOSTNAMES.has(hostname)) {
    return true;
  }
  if (
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return true;
  }
  if (isDisallowedIp(hostname)) {
    return true;
  }
  return false;
}

interface ResolvedHostTarget {
  address: string;
  family: 4 | 6;
}

async function resolveSafeHost(
  hostname: string,
  port?: string,
): Promise<ResolvedHostTarget | null> {
  if (port && port !== '80' && port !== '443') {
    return null;
  }
  const norm = normalizeHostname(hostname);
  if (isPrivateOrDisallowedHost(norm)) {
    return null;
  }
  try {
    const addresses = await dns.lookup(norm, { all: true });
    if (!addresses || addresses.length === 0) {
      return null;
    }
    for (const addr of addresses) {
      if (isDisallowedIp(addr.address)) {
        return null;
      }
    }
    const first = addresses[0];
    return {
      address: first.address,
      family: first.family === 6 ? 6 : 4,
    };
  } catch {
    return null;
  }
}

interface PinnedUpstreamResponse {
  status: number;
  headers: Headers;
  body: ReadableStream<Uint8Array>;
  destroy: () => void;
}

function fetchWithPinnedIp(
  targetUrl: URL,
  pinned: ResolvedHostTarget,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<PinnedUpstreamResponse> {
  return new Promise((resolve, reject) => {
    const isHttps = targetUrl.protocol === 'https:';
    const transport = isHttps ? https : http;
    const req = transport.request(
      {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || (isHttps ? 443 : 80),
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method: 'GET',
        headers: {
          ...headers,
          Host: targetUrl.host,
        },
        signal,
        // Pin DNS resolution to the already-validated IP to prevent TOCTOU DNS rebinding
        lookup: (_hostname, options, callback) => {
          if (typeof options === 'object' && options !== null && 'all' in options && options.all) {
            callback(null, [{ address: pinned.address, family: pinned.family }]);
          } else {
            callback(null, pinned.address, pinned.family);
          }
        },
        ...(isHttps ? { servername: targetUrl.hostname } : {}),
      },
      (res) => {
        const resHeaders = new Headers();
        for (const [k, v] of Object.entries(res.headers)) {
          if (Array.isArray(v)) {
            for (const item of v) resHeaders.append(k, item);
          } else if (typeof v === 'string') {
            resHeaders.set(k, v);
          }
        }
        const webBody = Readable.toWeb(res) as unknown as ReadableStream<Uint8Array>;
        resolve({
          status: res.statusCode ?? 502,
          headers: resHeaders,
          body: webBody,
          destroy: () => {
            res.destroy();
            req.destroy();
          },
        });
      },
    );

    req.on('error', reject);
    req.end();
  });
}

export async function GET(request: NextRequest) {
  // 1. Cryptographic / server-verified authentication check (mitigate open proxy)
  const rawToken = request.cookies.get('accessToken')?.value;
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const isAuthenticated =
    (await verifyAccessToken(rawToken)) || (await verifyAccessToken(bearerToken));

  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized access to PDF proxy' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL provided' }, { status: 400 });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only HTTP and HTTPS protocols are allowed' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  const incomingRange = request.headers.get('range');
  const incomingIfRange = request.headers.get('if-range');

  let upstreamResponse: PinnedUpstreamResponse | null = null;
  try {
    let currentUrl = parsed.toString();

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const currentParsed = new URL(currentUrl);
      const pinnedTarget = await resolveSafeHost(currentParsed.hostname, currentParsed.port);
      if (!pinnedTarget) {
        clearTimeout(timeoutId);
        return NextResponse.json(
          { error: 'Requests to internal or disallowed networks are prohibited' },
          { status: 403 },
        );
      }

      const upstreamHeaders: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/pdf,application/octet-stream;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
      };
      if (incomingRange) {
        upstreamHeaders['Range'] = incomingRange;
      }
      if (incomingIfRange) {
        upstreamHeaders['If-Range'] = incomingIfRange;
      }

      upstreamResponse = await fetchWithPinnedIp(
        currentParsed,
        pinnedTarget,
        upstreamHeaders,
        controller.signal,
      );

      if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
        const locationHeader = upstreamResponse.headers.get('location');
        upstreamResponse.destroy();
        if (!locationHeader) break;
        if (hop === MAX_REDIRECTS) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: 'Too many redirects from upstream server' },
            { status: 502 },
          );
        }
        let nextUrl: URL;
        try {
          nextUrl = new URL(locationHeader, currentUrl);
        } catch {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: 'Invalid redirect URL from upstream server' },
            { status: 502 },
          );
        }
        if (nextUrl.protocol !== 'http:' && nextUrl.protocol !== 'https:') {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: 'Redirect to unsupported protocol is prohibited' },
            { status: 403 },
          );
        }
        currentUrl = nextUrl.toString();
        continue;
      }
      break;
    }

    if (!upstreamResponse) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Failed to receive response from upstream server' },
        { status: 502 },
      );
    }

    if (upstreamResponse.status < 200 || upstreamResponse.status >= 300) {
      clearTimeout(timeoutId);
      const status = upstreamResponse.status;
      upstreamResponse.destroy();
      if (status === 403) {
        return NextResponse.json(
          {
            error:
              'The publisher has restricted direct programmatic PDF downloads (Access Forbidden). Please attach a local PDF file or view via original publisher.',
          },
          { status: 403 }
        );
      }
      return NextResponse.json(
        {
          error: `External publisher returned HTTP ${status}`,
        },
        { status }
      );
    }

    const rawContentType = (upstreamResponse.headers.get('content-type') || '').toLowerCase();
    const mimeType = rawContentType.split(';')[0]?.trim() || '';
    const isRejectedMimeType =
      rawContentType.includes('text/html') ||
      rawContentType.includes('image/svg') ||
      rawContentType.includes('svg') ||
      rawContentType.includes('xhtml') ||
      rawContentType.includes('xml') ||
      rawContentType.includes('javascript') ||
      rawContentType.includes('text/plain');
    const isAllowedMimeType =
      !mimeType ||
      mimeType === 'application/pdf' ||
      mimeType === 'application/x-pdf' ||
      mimeType === 'application/octet-stream' ||
      mimeType === 'binary/octet-stream';

    // Strictly prevent XSS or non-PDF mime types being interpreted by the browser
    if (isRejectedMimeType || !isAllowedMimeType) {
      clearTimeout(timeoutId);
      upstreamResponse.destroy();
      return NextResponse.json(
        {
          error:
            'The remote link returned an invalid content type (HTML/XML/SVG) instead of a PDF file.',
        },
        { status: 422 }
      );
    }

    const contentLengthHeader = upstreamResponse.headers.get('content-length');
    if (contentLengthHeader) {
      const parsedLength = parseInt(contentLengthHeader, 10);
      if (!Number.isNaN(parsedLength) && parsedLength > MAX_PAYLOAD_BYTES) {
        clearTimeout(timeoutId);
        upstreamResponse.destroy();
        return NextResponse.json(
          { error: 'Remote document exceeds maximum allowed size (50MB)' },
          { status: 413 }
        );
      }
    }

    const isPartialContent = upstreamResponse.status === 206;
    const contentRangeHeader = upstreamResponse.headers.get('content-range');
    const acceptRangesHeader = upstreamResponse.headers.get('accept-ranges');
    const isByteZeroStart =
      !isPartialContent ||
      !contentRangeHeader ||
      /^bytes\s+0-/i.test(contentRangeHeader.trim());

    let body: ReadableStream<Uint8Array> | null = upstreamResponse.body;
    if (body && typeof body.getReader === 'function') {
      const reader = body.getReader();
      // Buffer at least 5 bytes (up to 1024 bytes) before inspecting magic bytes
      // so fragmented TCP chunks < 5 bytes cannot bypass verification.
      const initialChunks: Uint8Array[] = [];
      let totalBytesRead = 0;
      let streamEnded = false;
      while (totalBytesRead < 5) {
        const readResult = await reader.read();
        if (readResult.done) {
          streamEnded = true;
          break;
        }
        if (readResult.value && readResult.value.byteLength > 0) {
          initialChunks.push(readResult.value);
          totalBytesRead += readResult.value.byteLength;
          if (totalBytesRead > MAX_PAYLOAD_BYTES) {
            clearTimeout(timeoutId);
            await reader.cancel().catch(() => undefined);
            return NextResponse.json(
              { error: 'Remote document exceeds maximum allowed size (50MB)' },
              { status: 413 },
            );
          }
        }
      }

      const inspectLen = Math.min(totalBytesRead, 1024);
      const inspectBuf = new Uint8Array(inspectLen);
      let offset = 0;
      for (const chunk of initialChunks) {
        const take = Math.min(chunk.byteLength, inspectLen - offset);
        if (take <= 0) break;
        inspectBuf.set(chunk.subarray(0, take), offset);
        offset += take;
      }

      if (inspectLen > 0) {
        const prefix = new TextDecoder('ascii').decode(inspectBuf);
        const trimmedPrefix = prefix.trimStart();
        if (
          trimmedPrefix.startsWith('<!DOCTYPE') ||
          trimmedPrefix.startsWith('<html') ||
          trimmedPrefix.startsWith('<svg') ||
          trimmedPrefix.startsWith('<?xml') ||
          (isByteZeroStart &&
            mimeType !== 'application/pdf' &&
            mimeType !== 'application/x-pdf' &&
            !prefix.includes('%PDF-'))
        ) {
          clearTimeout(timeoutId);
          await reader.cancel().catch(() => undefined);
          return NextResponse.json(
            {
              error:
                'The remote payload does not contain valid %PDF- magic bytes.',
            },
            { status: 422 },
          );
        }
      }

      // Initial connection and magic-byte verification succeeded; switch from total-download timeout
      // to a per-chunk inactivity timeout so large PDFs streaming >30s are not prematurely aborted.
      clearTimeout(timeoutId);
      body = new ReadableStream<Uint8Array>({
        start(streamController) {
          for (const chunk of initialChunks) {
            streamController.enqueue(chunk);
          }
          if (streamEnded) {
            streamController.close();
          }
        },
        async pull(streamController) {
          const chunkTimeoutId = setTimeout(() => controller.abort(), 30_000);
          try {
            const { done, value } = await reader.read();
            if (done) {
              streamController.close();
            } else if (value) {
              totalBytesRead += value.byteLength;
              if (totalBytesRead > MAX_PAYLOAD_BYTES) {
                await reader.cancel('MAX_PAYLOAD_BYTES_EXCEEDED').catch(() => undefined);
                streamController.error(new Error('Remote document exceeds maximum allowed size (50MB)'));
                return;
              }
              streamController.enqueue(value);
            }
          } catch (readErr) {
            streamController.error(readErr);
          } finally {
            clearTimeout(chunkTimeoutId);
          }
        },
        cancel(reason) {
          return reader.cancel(reason);
        },
      });
    } else {
      clearTimeout(timeoutId);
    }

    const responseHeaders = new Headers();
    // Force application/pdf and strict security headers
    responseHeaders.set('Content-Type', 'application/pdf');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');
    responseHeaders.set('Content-Security-Policy', 'sandbox');
    responseHeaders.set('Content-Disposition', 'inline; filename="document.pdf"');
    responseHeaders.set('Cache-Control', 'private, max-age=3600');
    responseHeaders.set('Vary', 'Cookie, Authorization');

    if (contentLengthHeader) {
      responseHeaders.set('Content-Length', contentLengthHeader);
    }
    if (contentRangeHeader) {
      responseHeaders.set('Content-Range', contentRangeHeader);
    }
    if (acceptRangesHeader) {
      responseHeaders.set('Accept-Ranges', acceptRangesHeader);
    }

    return new Response(body, {
      status: isPartialContent ? 206 : 200,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    upstreamResponse?.destroy();
    const isAbort =
      (err instanceof Error && err.name === 'AbortError') || controller.signal.aborted;
    return NextResponse.json(
      {
        error: isAbort
          ? 'Timed out while fetching remote document from upstream server'
          : 'Failed to fetch remote document from upstream server',
      },
      { status: isAbort ? 504 : 502 },
    );
  }
}
