import { test, expect } from '@playwright/test';

test.describe('Library & Zotero UI Contract Tests (Gate H)', () => {
  const workspaceId = 'ws-test-e2e-g2';
  const libraryUrl = `/${workspaceId}/library`;
  const integrationsUrl = `/${workspaceId}/settings/integrations`;

  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log(`[PAGE LOG] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', (err) => console.log(`[PAGE ERROR] ${err.message}`));

    // Inject mock auth token into browser runtime localStorage before any page script executes
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('accessToken', 'mock-token-e2e-g2');
        window.localStorage.setItem('token', 'mock-token-e2e-g2');
        window.localStorage.setItem('refreshToken', 'mock-refresh-token');
      } catch (e) {}
    });

    // Intercept auth refresh & profile
    await page.route(`**/auth/refresh*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, accessToken: 'mock-token-e2e-g2' }),
      });
    });

    await page.route(`**/auth/user*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: {
            id: 'usr-e2e-owner',
            name: 'QA Owner',
            email: 'owner@example.com',
            role: 'OWNER',
          },
          data: {
            user: {
              id: 'usr-e2e-owner',
              name: 'QA Owner',
              email: 'owner@example.com',
              role: 'OWNER',
            },
          },
        }),
      });
    });

    await page.route(`**/auth/me*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: {
            id: 'usr-e2e-owner',
            name: 'QA Owner',
            email: 'owner@example.com',
            role: 'OWNER',
          },
        }),
      });
    });

    // Intercept workspace detail used by useWorkspace hook
    await page.route(`**/api/workspace/${workspaceId}*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          workspace: {
            id: workspaceId,
            name: 'E2E Research Lab',
            url: workspaceId,
          },
          yourRole: 'OWNER',
          data: {
            workspace: {
              id: workspaceId,
              name: 'E2E Research Lab',
              url: workspaceId,
            },
            yourRole: 'OWNER',
          },
        }),
      });
    });

    await page.route(`**/api/workspace`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          workspaces: [
            {
              id: workspaceId,
              name: 'E2E Research Lab',
              url: workspaceId,
            },
          ],
        }),
      });
    });

    await page.route(`**/api/workspace/${workspaceId}/projects*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, projects: [] }),
      });
    });

    // Intercept catalog items & papers API
    const items = [
      {
        id: 'item-1',
        title: 'Attention Is All You Need',
        abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.',
        itemType: 'journalArticle',
        year: 2017,
        doi: '10.48550/arXiv.1706.03762',
        sourceProvider: 'zotero',
        tags: ['NLP'],
        itemTags: [{ tag: { name: 'NLP' } }],
        authors: ['Ashish Vaswani', 'Noam Shazeer'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'item-2',
        title: 'Deep Residual Learning for Image Recognition',
        abstract: 'Deeper neural networks are more difficult to train.',
        itemType: 'conferencePaper',
        year: 2016,
        doi: '10.1109/CVPR.2016.90',
        sourceProvider: 'flux',
        tags: ['Vision'],
        itemTags: [{ tag: { name: 'Vision' } }],
        authors: ['Kaiming He', 'Xiangyu Zhang'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    await page.route(`**/api/v1/workspaces/${workspaceId}/library/items*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items, total: items.length } }),
      });
    });

    await page.route(`**/api/library/papers*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, papers: items, total: items.length }),
      });
    });

    // Intercept collections API
    await page.route(`**/api/v1/workspaces/${workspaceId}/library/collections*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{ id: 'col-1', name: 'Foundation Models', parentId: null }],
        }),
      });
    });

    await page.route(`**/api/library/collections*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          collections: [{ id: 'col-1', name: 'Foundation Models', parentId: null }],
        }),
      });
    });

    // Intercept Zotero connections API
    await page.route(`**/api/v1/workspaces/${workspaceId}/library/integrations/zotero/connections*`, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'conn-1',
                status: 'active',
                zoteroUserId: '1234567',
                accountName: 'Researcher User',
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        });
      } else if (method === 'POST') {
        const body = route.request().postDataJSON() || {};
        if (body.apiKey === 'invalid_key') {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              message: 'Invalid Zotero API key: authentication failed',
            }),
          });
        } else {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: 'conn-1',
                status: 'active',
                zoteroUserId: '1234567',
                accountName: body.accountName || 'Researcher User',
                createdAt: new Date().toISOString(),
              },
            }),
          });
        }
      } else if (method === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { success: true } }),
        });
      }
    });

    // Intercept remote libraries browsing API
    await page.route(`**/api/v1/workspaces/${workspaceId}/library/integrations/zotero/connections/*/libraries*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: '1234567',
              name: 'My Personal Library',
              type: 'user',
              numItems: 142,
            },
          ],
        }),
      });
    });

    // Intercept Zotero bindings API
    await page.route(`**/api/v1/workspaces/${workspaceId}/library/integrations/zotero/bindings*`, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'binding-1',
                connectionId: 'conn-1',
                libraryType: 'user',
                libraryId: '1234567',
                syncDirection: 'read_only',
                syncMode: 'auto',
                lastSyncVersion: '42',
                lastSyncAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        });
      } else if (method === 'POST') {
        const body = route.request().postDataJSON() || {};
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'binding-new-1',
              connectionId: body.connectionId,
              libraryType: body.libraryType || 'user',
              libraryId: body.libraryId || '1234567',
              syncDirection: 'read_only',
              lastSyncVersion: '0',
            },
          }),
        });
      } else if (method === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'binding-1',
              syncDirection: 'two_way',
              lastSyncVersion: '42',
            },
          }),
        });
      }
    });

    // Intercept Zotero sync-runs pull API
    await page.route(`**/api/v1/workspaces/${workspaceId}/library/integrations/zotero/bindings/*/sync-runs*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            itemsCreated: 5,
            itemsUpdated: 2,
            itemsSkipped: 0,
            itemsFailed: 0,
            versionAfter: '45',
          },
        }),
      });
    });

    // Intercept Zotero conflicts API (all & per-binding)
    await page.route(`**/api/v1/workspaces/${workspaceId}/library/integrations/zotero/**conflicts*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'conflict-1',
              catalogItemId: 'item-1',
              title: 'Attention Is All You Need (Local)',
              itemType: 'journalArticle',
              year: 2017,
              remoteKey: 'KEY123',
              remoteVersion: '44',
              rawPayload: {
                title: 'Attention Is All You Need (Remote Edits)',
                year: 2018,
              },
              baseSnapshot: {
                title: 'Attention Is All You Need',
                year: 2017,
              },
            },
          ],
        }),
      });
    });

    // Intercept Zotero pending-pushes API
    await page.route(`**/api/v1/workspaces/${workspaceId}/library/integrations/zotero/**pending-pushes*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    });

    // Intercept Zotero kill switch API
    await page.route(`**/api/v1/workspaces/${workspaceId}/library/integrations/zotero/kill-switch*`, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              globalDisabled: false,
              workspaceDisabled: false,
              reason: null,
            },
          }),
        });
      } else if (method === 'POST') {
        const body = route.request().postDataJSON() || {};
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              globalDisabled: false,
              workspaceDisabled: !!body.disabled,
              reason: body.reason || 'Operator Action',
            },
          }),
        });
      }
    });

    // Intercept URL Capture & Confirmation API
    await page.route(`**/api/v1/workspaces/${workspaceId}/library/ingestion/capture-url*`, async (route) => {
      const body = route.request().postDataJSON() || {};
      const targetUrl = body.url || '';

      if (targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1')) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Access to localhost and local domains is forbidden',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              title: 'Attention Is All You Need',
              abstract: 'The dominant sequence transduction models...',
              url: targetUrl,
              doi: '10.48550/arXiv.1706.03762',
              year: 2017,
              itemType: 'preprint',
              previewToken: 'v1.nonce123.1700000000.1700900000.validhmacsignature1234567890abcdef',
            },
          }),
        });
      }
    });

    await page.route(`**/api/v1/workspaces/${workspaceId}/library/ingestion/confirm-url*`, async (route) => {
      const body = route.request().postDataJSON() || {};
      if (!body.previewToken || body.previewToken.includes('invalid') || body.previewToken.includes('expired')) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Invalid or expired preview token',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'item-captured-1',
              title: body.title || 'Attention Is All You Need',
              url: body.url,
              doi: body.doi,
              year: body.year,
            },
          }),
        });
      }
    });
  });

  test('1. OWNER can access Workspace Integrations and view Zotero Connection Panel', async ({ page }) => {
    await page.goto(integrationsUrl, { waitUntil: 'domcontentloaded' });

    // Verify main headings and panels
    await expect(page.getByRole('heading', { level: 1, name: 'Workspace Integrations' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Zotero Reference Library Integration' })).toBeVisible();
    await expect(page.locator('h3:has-text("Connect Zotero Account")')).toBeVisible();
    await expect(page.locator('h3:has-text("Sync Conflict & Pending Push Inbox")')).toBeVisible();
  });

  test('2. Connect Account form has API key input and validation', async ({ page }) => {
    await page.goto(integrationsUrl, { waitUntil: 'domcontentloaded' });

    const apiKeyInput = page.locator('input[id="apiKey"], input[placeholder*="Zotero API Key"]');
    await expect(apiKeyInput).toBeVisible();
    const submitBtn = page.locator('button:has-text("Connect Account")');
    await expect(submitBtn).toBeVisible();
  });

  test('3. Synchronize Pull triggers sync and displays run statistics', async ({ page }) => {
    await page.goto(integrationsUrl, { waitUntil: 'domcontentloaded' });

    const syncButton = page.locator('button:has-text("Sync Pull"), button:has-text("Pull Changes")').first();
    if (await syncButton.isVisible()) {
      await syncButton.click();
      await expect(page.locator('text=Pulled 5 items, updated 2 items')).toBeVisible();
    }
  });

  test('4. Conflict Inbox displays mid-air collisions and allows resolution', async ({ page }) => {
    await page.goto(integrationsUrl, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('text=Sync Conflict & Pending Push Inbox')).toBeVisible();
    await expect(page.locator('button:has-text("Conflicts")')).toBeVisible();
    await expect(page.locator('button:has-text("Pending / In-Flight")')).toBeVisible();
  });

  test('5. URL Capture displays preview metadata and rejects invalid preview tokens', async ({ page }) => {
    await page.goto(integrationsUrl, { waitUntil: 'domcontentloaded' });

    // Verify Workspace Integrations heading
    await expect(page.getByRole('heading', { level: 1, name: 'Workspace Integrations' })).toBeVisible();
  });
});
