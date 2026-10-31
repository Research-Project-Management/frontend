import { NextRequest, NextResponse } from 'next/server';

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

function normalizeHostname(raw: string): string {
  return raw.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
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
  if (
    hostname.startsWith('0.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('127.') ||
    hostname.startsWith('169.254.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(hostname)
  ) {
    return true;
  }
  // IPv6 loopback, unspecified, unique-local (fc00::/7), link-local (fe80::/10), IPv4-mapped (::ffff:)
  if (hostname.includes(':')) {
    if (
      hostname === '::1' ||
      hostname === '::' ||
      /^0*:0*:0*:0*:0*:0*:0*:[01]$/.test(hostname) ||
      hostname.startsWith('fc') ||
      hostname.startsWith('fd') ||
      /^fe[89ab][0-9a-f]:/.test(hostname) ||
      hostname.startsWith('::ffff:') ||
      /^0*:0*:0*:0*:0*:ffff:/i.test(hostname)
    ) {
      return true;
    }
  }
  return false;
}

const MAX_REDIRECTS = 5;

export async function GET(request: NextRequest) {
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

  if (isPrivateOrDisallowedHost(parsed.hostname)) {
    return NextResponse.json({ error: 'Requests to internal network are prohibited' }, { status: 403 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    let currentUrl = parsed.toString();
    let upstreamResponse: Response | null = null;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      upstreamResponse = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'application/pdf,application/octet-stream,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
        redirect: 'manual',
      });

      if (
        upstreamResponse.status >= 300 &&
        upstreamResponse.status < 400
      ) {
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
        if (isPrivateOrDisallowedHost(nextUrl.hostname)) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: 'Redirect to internal network is prohibited' },
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

    const contentType = upstreamResponse.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      return NextResponse.json(
        {
          error:
            'The remote link returned an HTML webpage or protection challenge instead of a PDF file.',
        },
        { status: 422 }
      );
    }

    const body = upstreamResponse.body;
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', contentType || 'application/pdf');
    const contentLength = upstreamResponse.headers.get('content-length');
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }
    responseHeaders.set('Cache-Control', 'public, max-age=3600');

    return new Response(body, {
      status: 200,
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
