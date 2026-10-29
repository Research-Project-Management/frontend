import { NextRequest, NextResponse } from 'next/server';

const DISALLOWED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  '169.254.169.254',
]);

function isPrivateIp(hostname: string): boolean {
  if (
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('127.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
  ) {
    return true;
  }
  return false;
}

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

  const hostname = parsed.hostname.toLowerCase();
  if (DISALLOWED_HOSTNAMES.has(hostname) || isPrivateIp(hostname)) {
    return NextResponse.json({ error: 'Requests to internal network are prohibited' }, { status: 403 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/pdf,application/octet-stream,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

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
