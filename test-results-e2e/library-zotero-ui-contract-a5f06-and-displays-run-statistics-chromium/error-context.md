# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: library-zotero-ui-contract.spec.ts >> Library & Zotero UI Contract Tests (Gate H) >> 3. Synchronize Pull triggers sync and displays run statistics
- Location: tests\e2e\library-zotero-ui-contract.spec.ts:494:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:2915/ws-test-e2e-g2/settings/integrations
Call log:
  - navigating to "http://127.0.0.1:2915/ws-test-e2e-g2/settings/integrations", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e6]:
    - heading "This site can’t be reached" [level=1] [ref=e7]
    - paragraph [ref=e8]:
      - strong [ref=e9]: 127.0.0.1
      - text: refused to connect.
    - generic [ref=e10]:
      - paragraph [ref=e11]: "Try:"
      - list [ref=e12]:
        - listitem [ref=e13]: Checking the connection
        - listitem [ref=e14]:
          - link "Checking the proxy and the firewall" [ref=e15] [cursor=pointer]:
            - /url: "#buttons"
    - generic [ref=e16]: ERR_CONNECTION_REFUSED
  - generic [ref=e17]:
    - button "Reload" [ref=e19] [cursor=pointer]
    - button "Details" [ref=e20] [cursor=pointer]
```

# Test source

```ts
  395 |         });
  396 |       } else if (method === 'POST') {
  397 |         const body = route.request().postDataJSON() || {};
  398 |         await route.fulfill({
  399 |           status: 200,
  400 |           contentType: 'application/json',
  401 |           body: JSON.stringify({
  402 |             success: true,
  403 |             data: {
  404 |               globalDisabled: false,
  405 |               workspaceDisabled: !!body.disabled,
  406 |               reason: body.reason || 'Operator Action',
  407 |             },
  408 |           }),
  409 |         });
  410 |       }
  411 |     });
  412 | 
  413 |     // Intercept URL Capture & Confirmation API
  414 |     await page.route(`**/api/v1/workspaces/${workspaceId}/library/ingestion/capture-url*`, async (route) => {
  415 |       const body = route.request().postDataJSON() || {};
  416 |       const targetUrl = body.url || '';
  417 | 
  418 |       if (targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1')) {
  419 |         await route.fulfill({
  420 |           status: 400,
  421 |           contentType: 'application/json',
  422 |           body: JSON.stringify({
  423 |             message: 'Access to localhost and local domains is forbidden',
  424 |           }),
  425 |         });
  426 |       } else {
  427 |         await route.fulfill({
  428 |           status: 200,
  429 |           contentType: 'application/json',
  430 |           body: JSON.stringify({
  431 |             success: true,
  432 |             data: {
  433 |               title: 'Attention Is All You Need',
  434 |               abstract: 'The dominant sequence transduction models...',
  435 |               url: targetUrl,
  436 |               doi: '10.48550/arXiv.1706.03762',
  437 |               year: 2017,
  438 |               itemType: 'preprint',
  439 |               previewToken: 'v1.nonce123.1700000000.1700900000.validhmacsignature1234567890abcdef',
  440 |             },
  441 |           }),
  442 |         });
  443 |       }
  444 |     });
  445 | 
  446 |     await page.route(`**/api/v1/workspaces/${workspaceId}/library/ingestion/confirm-url*`, async (route) => {
  447 |       const body = route.request().postDataJSON() || {};
  448 |       if (!body.previewToken || body.previewToken.includes('invalid') || body.previewToken.includes('expired')) {
  449 |         await route.fulfill({
  450 |           status: 400,
  451 |           contentType: 'application/json',
  452 |           body: JSON.stringify({
  453 |             message: 'Invalid or expired preview token',
  454 |           }),
  455 |         });
  456 |       } else {
  457 |         await route.fulfill({
  458 |           status: 200,
  459 |           contentType: 'application/json',
  460 |           body: JSON.stringify({
  461 |             success: true,
  462 |             data: {
  463 |               id: 'item-captured-1',
  464 |               title: body.title || 'Attention Is All You Need',
  465 |               url: body.url,
  466 |               doi: body.doi,
  467 |               year: body.year,
  468 |             },
  469 |           }),
  470 |         });
  471 |       }
  472 |     });
  473 |   });
  474 | 
  475 |   test('1. OWNER can access Workspace Integrations and view Zotero Connection Panel', async ({ page }) => {
  476 |     await page.goto(integrationsUrl);
  477 | 
  478 |     // Verify main headings and panels
  479 |     await expect(page.locator('h1')).toContainText('Workspace Integrations');
  480 |     await expect(page.locator('h2')).toContainText('Zotero Reference Library Integration');
  481 |     await expect(page.locator('h3:has-text("Connect Zotero Account")')).toBeVisible();
  482 |     await expect(page.locator('h3:has-text("Sync Conflict & Pending Push Inbox")')).toBeVisible();
  483 |   });
  484 | 
  485 |   test('2. Connect Account form has API key input and validation', async ({ page }) => {
  486 |     await page.goto(integrationsUrl);
  487 | 
  488 |     const apiKeyInput = page.locator('input[id="apiKey"]');
  489 |     await expect(apiKeyInput).toBeVisible();
  490 |     const submitBtn = page.locator('button:has-text("Connect Account")');
  491 |     await expect(submitBtn).toBeVisible();
  492 |   });
  493 | 
  494 |   test('3. Synchronize Pull triggers sync and displays run statistics', async ({ page }) => {
> 495 |     await page.goto(integrationsUrl);
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:2915/ws-test-e2e-g2/settings/integrations
  496 | 
  497 |     const syncButton = page.locator('button:has-text("Sync Pull"), button:has-text("Pull Changes")').first();
  498 |     if (await syncButton.isVisible()) {
  499 |       await syncButton.click();
  500 |       await expect(page.locator('text=Pulled 5 items, updated 2 items')).toBeVisible();
  501 |     }
  502 |   });
  503 | 
  504 |   test('4. Conflict Inbox displays mid-air collisions and allows resolution', async ({ page }) => {
  505 |     await page.goto(integrationsUrl);
  506 | 
  507 |     await expect(page.locator('text=Sync Conflict & Pending Push Inbox')).toBeVisible();
  508 |     await expect(page.locator('button:has-text("Conflicts")')).toBeVisible();
  509 |     await expect(page.locator('button:has-text("Pending / In-Flight")')).toBeVisible();
  510 |   });
  511 | 
  512 |   test('5. URL Capture displays preview metadata and rejects invalid preview tokens', async ({ page }) => {
  513 |     await page.goto(libraryUrl);
  514 | 
  515 |     // Verify Library heading
  516 |     await expect(page.locator('h1, h2').first()).toBeVisible();
  517 |   });
  518 | });
  519 | 
```