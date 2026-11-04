import dns from 'node:dns/promises';
import { NextRequest, NextResponse } from 'next/server';
import { isTokenValid } from '@/shared/utils/auth-token.util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp) ||
    /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(cleanIp)
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
      /^0*:0*:0*:0*:0*:ffff:/i.test(cleanIp)
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

async function validateHostSafety(hostname: string, port?: string): Promise<boolean> {
  if (port && port !== '80' && port !== '443') {
    return false;
  }
  const norm = normalizeHostname(hostname);
  if (isPrivateOrDisallowedHost(norm)) {
    return false;
  }
  try {
    const addresses = await dns.lookup(norm, { all: true });
    if (!addresses || addresses.length === 0) {
      return false;
    }
    for (const addr of addresses) {
      if (isDisallowedIp(addr.address)) {
        return false;
      }
    }
  } catch {
    return false;
  }
  return true;
}

export async function GET(request: NextRequest) {
  // 1. Authentication check (mitigate open proxy)
  const rawToken = request.cookies.get('accessToken')?.value;
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const hasRefreshToken = Boolean(request.cookies.get('refresh_token')?.value);

  const isAuthenticated =
    isTokenValid(rawToken) || isTokenValid(bearerToken) || hasRefreshToken;

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

  const isInitialHostSafe = await validateHostSafety(parsed.hostname, parsed.port);
  if (!isInitialHostSafe) {
    return NextResponse.json({ error: 'Requests to internal or disallowed networks are prohibited' }, { status: 403 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  const incomingRange = request.headers.get('range');
  const incomingIfRange = request.headers.get('if-range');

  try {
    let currentUrl = parsed.toString();
    let upstreamResponse: Response | null = null;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const currentParsed = new URL(currentUrl);
      const isHopSafe = await validateHostSafety(currentParsed.hostname, currentParsed.port);
      if (!isHopSafe) {
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

      upstreamResponse = await fetch(currentUrl, {
        method: 'GET',
        headers: upstreamHeaders,
        signal: controller.signal,
        redirect: 'manual',
      });

      if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
        const locationHeader = upstreamResponse.headers.get('location');
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
        const isRedirectSafe = await validateHostSafety(nextUrl.hostname, nextUrl.port);
        if (!isRedirectSafe) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: 'Redirect to internal or disallowed network is prohibited' },
            { status: 403 },
          );
        }
        currentUrl = nextUrl.toString();
        continue;
      }
      break;
    }

    clearTimeout(timeoutId);

    if (!upstreamResponse) {
      return NextResponse.json(
        { error: 'Failed to receive response from upstream server' },
        { status: 502 },
      );
    }

    if (!upstreamResponse.ok) {
      if (upstreamResponse.status === 403) {
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
          error: `External publisher returned HTTP ${upstreamResponse.status}: ${upstreamResponse.statusText}`,
        },
        { status: upstreamResponse.status }
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
      const firstRead = await reader.read();
      if (!firstRead.done && firstRead.value && firstRead.value.byteLength >= 5) {
        const prefix = new TextDecoder('ascii').decode(firstRead.value.subarray(0, 1024));
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
      body = new ReadableStream<Uint8Array>({
        start(streamController) {
          if (!firstRead.done && firstRead.value) {
            streamController.enqueue(firstRead.value);
          } else if (firstRead.done) {
            streamController.close();
          }
        },
        async pull(streamController) {
          const { done, value } = await reader.read();
          if (done) {
            streamController.close();
          } else if (value) {
            streamController.enqueue(value);
          }
        },
        cancel(reason) {
          return reader.cancel(reason);
        },
      });
    }

    const responseHeaders = new Headers();
    // Force application/pdf and strict security headers
    responseHeaders.set('Content-Type', 'application/pdf');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');
    responseHeaders.set('Content-Security-Policy', 'sandbox');
    responseHeaders.set('Content-Disposition', 'inline; filename="document.pdf"');
    responseHeaders.set('Cache-Control', 'private, max-age=3600');

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
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to fetch remote document: ${msg}` },
      { status: 502 }
    );
  }
}
