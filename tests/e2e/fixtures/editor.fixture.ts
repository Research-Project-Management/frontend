import { test as base, expect, Page } from '@playwright/test';
import { EditorPageObject } from '../pages/editor.po';
import {
  MOCK_USER,
  MOCK_PROJECT,
  MOCK_PROJECT_MEMBERS,
  MOCK_PAGE,
  MOCK_FILES_HIERARCHY,
  MOCK_WORD_COUNT,
  MOCK_COMPILE_SUCCESS,
  MOCK_SUGGESTIONS,
} from './mock-data';

/**
 * Configure comprehensive API interception for the manuscript editor.
 * Ensures hermetic, zero-flakiness execution in both CI and local browser tests.
 */
export async function setupEditorApiMocks(page: Page) {
  // Capture page errors & warnings for debugging
  page.on('pageerror', (err) => {
    console.error('BROWSER PAGE ERROR:', err.stack || err.message);
  });
  page.on('console', (msg) => {
    console.log(`[CONSOLE ${msg.type().toUpperCase()}]`, msg.text());
  });
  page.on('request', (req) => {
    if (!req.url().includes('/_next/')) {
      console.log(`[REQ] ${req.method()} ${req.url()}`);
    }
  });
  page.on('response', (res) => {
    if (!res.url().includes('/_next/')) {
      console.log(`[RES] ${res.status()} ${res.url()}`);
    }
  });

  const futureExp = Math.floor(Date.now() / 1000) + 86400 * 7;
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user-academic-001',
      id: 'user-academic-001',
      email: 'alan@flux.academic',
      name: 'Dr. Alan Turing',
      exp: futureExp,
    })
  ).toString('base64');
  const mockJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.signature`;

  // 1. Add cookies to the browser context so the initial HTTP request includes them
  await page.context().addCookies([
    {
      name: 'accessToken',
      value: mockJwt,
      url: 'http://127.0.0.1:2915',
    },
    {
      name: 'token',
      value: mockJwt,
      url: 'http://127.0.0.1:2915',
    },
    {
      name: 'flux_token',
      value: mockJwt,
      url: 'http://127.0.0.1:2915',
    },
    {
      name: 'accessToken',
      value: mockJwt,
      url: 'http://localhost:2915',
    },
    {
      name: 'token',
      value: mockJwt,
      url: 'http://localhost:2915',
    },
  ]);

  // 2. Pre-inject localStorage session state before client script evaluation
  await page.addInitScript(
    ({ token, user }) => {
      window.addEventListener('error', (e) => {
        console.error('UNCAUGHT_WINDOW_ERROR:', e.message, 'FILE:', e.filename, 'LINE:', e.lineno, 'COL:', e.colno, 'STACK:', e.error?.stack);
      });
      window.addEventListener('unhandledrejection', (e) => {
        console.error('UNHANDLED_REJECTION:', e.reason);
      });
      try {
        localStorage.setItem('accessToken', token);
        localStorage.setItem('token', token);
        localStorage.setItem('flux_token', token);
        localStorage.setItem('flux_cached_user', JSON.stringify(user));
        localStorage.setItem('user', JSON.stringify(user));
        // Also set base URL override to 2915 so all API calls stay within origin
        localStorage.setItem('FLUX_API_BASE_URL', 'http://127.0.0.1:2915');
      } catch {
        // ignore storage access errors in restricted contexts
      }
    },
    { token: mockJwt, user: MOCK_USER }
  );

  // Helper guard: never intercept static bundles, chunks, or asset files
  const isStaticAsset = (url: string) =>
    url.includes('/_next/') ||
    url.endsWith('.js') ||
    url.endsWith('.css') ||
    url.endsWith('.woff2') ||
    url.endsWith('.svg') ||
    url.endsWith('.png');

  // Generic fallback for non-editor workspace background polling (e.g. notifications, stickies)
  // Ensures background widgets never return 401 and cause premature session expulsion
  await page.route(/\/api\/.*/, async (route) => {
    if (isStaticAsset(route.request().url())) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [], items: [] }),
    });
  });

  // 3. Precise API mock router for manuscript editor dependencies
  await page.route(/\/auth\/refresh/, async (route) => {
    if (isStaticAsset(route.request().url())) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        accessToken: mockJwt,
        token: mockJwt,
      }),
    });
  });

  await page.route(/\/auth\/user|\/auth\/me/, async (route) => {
    if (isStaticAsset(route.request().url())) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...MOCK_USER,
        user: MOCK_USER,
        success: true,
        data: { user: MOCK_USER, ...MOCK_USER },
      }),
    });
  });

  await page.route(/\/members(\?.*)?$/, async (route) => {
    if (isStaticAsset(route.request().url())) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        members: MOCK_PROJECT_MEMBERS,
        success: true,
        data: { members: MOCK_PROJECT_MEMBERS },
      }),
    });
  });

  await page.route(/\/projects\/proj-academic-001(\?.*)?$/, async (route) => {
    if (isStaticAsset(route.request().url())) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        project: MOCK_PROJECT,
        success: true,
        data: { project: MOCK_PROJECT },
      }),
    });
  });

  await page.route(/\/docs\/page-paper-001|\/pages\/page-paper-001/, async (route) => {
    if (isStaticAsset(route.request().url())) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        page: MOCK_PAGE,
        success: true,
        data: { page: MOCK_PAGE },
      }),
    });
  });

  await page.route(/\/files(\?.*)?$/, async (route) => {
    if (isStaticAsset(route.request().url())) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        files: MOCK_FILES_HIERARCHY,
        success: true,
        data: { files: MOCK_FILES_HIERARCHY },
      }),
    });
  });

  await page.route(/\/compile(\?.*)?$/, async (route) => {
    if (isStaticAsset(route.request().url())) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_COMPILE_SUCCESS),
    });
  });

  await page.route(/\/word-count(\?.*)?$/, async (route) => {
    if (isStaticAsset(route.request().url())) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_WORD_COUNT),
    });
  });

  await page.route(/\/suggestions(\?.*)?$/, async (route) => {
    if (isStaticAsset(route.request().url())) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        suggestions: MOCK_SUGGESTIONS,
        success: true,
        data: { suggestions: MOCK_SUGGESTIONS },
      }),
    });
  });

  await page.route(/\/collaboration\/stream/, async (route) => {
    if (isStaticAsset(route.request().url())) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'event: ping\ndata: {}\n\n',
    });
  });
}

export const test = base.extend<{
  editor: EditorPageObject;
}>({
  editor: async ({ page }, use) => {
    await setupEditorApiMocks(page);
    const editor = new EditorPageObject(page);
    await use(editor);
  },
});

export { expect };
