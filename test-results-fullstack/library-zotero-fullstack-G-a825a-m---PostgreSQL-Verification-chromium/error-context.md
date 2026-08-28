# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: library-zotero-fullstack.spec.ts >> Gate H.1.1: Real Full-Stack Product Workflow (Next.js -> NestJS -> PostgreSQL) >> 1. Full-Stack URL Ingestion: Next.js UI -> NestJS capture-url -> Preview -> Confirm -> PostgreSQL Verification
- Location: tests\e2e\library-zotero-fullstack.spec.ts:37:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Add Link to File...')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Add Link to File...')

```

```yaml
- region "Notifications alt+T"
- navigation "Workspace Header Navigation":
  - button "Search..."
  - button "Inbox"
- navigation:
  - link "Projects":
    - /url: /ws-test-e2e-fullstack
  - link "AI AI":
    - /url: /ws-test-e2e-fullstack/ai
    - img "AI"
    - text: AI
  - link "Library":
    - /url: /ws-test-e2e-fullstack/library
  - link "Storage":
    - /url: /ws-test-e2e-fullstack/storage
  - link "Settings":
    - /url: /ws-test-e2e-fullstack/settings
- complementary "Library navigation and collections":
  - text: Library
  - button "Search collections"
  - button "New collection"
  - button "Toggle sidebar"
  - navigation "Library Navigation":
    - link "My Library":
      - /url: /ws-test-e2e-fullstack/library
    - link "Recently Read":
      - /url: /ws-test-e2e-fullstack/library/recently-read
    - link "Favorites":
      - /url: /ws-test-e2e-fullstack/library/favorites
    - link "Duplicate Items":
      - /url: /ws-test-e2e-fullstack/library/duplicates
    - link "Unfiled Items":
      - /url: /ws-test-e2e-fullstack/library/unfiled
    - link "Trash":
      - /url: /ws-test-e2e-fullstack/library/trash
- main:
  - heading "Library" [level=1]
  - textbox "Search references..."
  - button "New"
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * Gate H.1.1: Real Full-Stack E2E Test Suite
  5   |  * Validates:
  6   |  * Next.js UI -> Real NestJS Backend -> Real PostgreSQL Database.
  7   |  * Zero mocks for internal APIs.
  8   |  * Assertions verify DOM state AND query PostgreSQL tables directly:
  9   |  * (CatalogItem, CapturePreview, LibraryChange, OutboxEvent).
  10  |  */
  11  | test.describe('Gate H.1.1: Real Full-Stack Product Workflow (Next.js -> NestJS -> PostgreSQL)', () => {
  12  |   const workspaceId = 'ws-test-e2e-fullstack';
  13  |   const libraryUrl = `/${workspaceId}/library`;
  14  |   const databaseUrl =
  15  |     process.env.DATABASE_URL ||
  16  |     'postgresql://postgres:Thanh26102006@localhost:5432/flux-db?schema=public';
  17  | 
  18  |   let prisma: any;
  19  | 
  20  |   test.beforeAll(async () => {
  21  |     try {
  22  |       const { PrismaClient } = require('d:/project/flux/backend/node_modules/@prisma/client');
  23  |       prisma = new PrismaClient({
  24  |         datasources: { db: { url: databaseUrl } },
  25  |       });
  26  |     } catch (e: any) {
  27  |       console.warn(`[E2E] Prisma init warning: ${e.message}`);
  28  |     }
  29  |   });
  30  | 
  31  |   test.afterAll(async () => {
  32  |     if (prisma) {
  33  |       await prisma.$disconnect();
  34  |     }
  35  |   });
  36  | 
  37  |   test('1. Full-Stack URL Ingestion: Next.js UI -> NestJS capture-url -> Preview -> Confirm -> PostgreSQL Verification', async ({
  38  |     page,
  39  |     request,
  40  |   }) => {
  41  |     // 1. Navigate to Library workspace page
  42  |     await page.goto(libraryUrl);
  43  |     await page.waitForLoadState('domcontentloaded');
  44  | 
  45  |     // 2. Open Add Link Modal via Topbar "New" menu
  46  |     const newBtn = page.getByRole('button', { name: 'New', exact: true });
  47  |     await expect(newBtn).toBeVisible({ timeout: 10000 });
  48  |     await newBtn.click();
  49  | 
  50  |     const addLinkMenuOption = page.getByText('Add Link to File...');
> 51  |     await expect(addLinkMenuOption).toBeVisible({ timeout: 5000 });
      |                                     ^ Error: expect(locator).toBeVisible() failed
  52  |     await addLinkMenuOption.click();
  53  | 
  54  |     // 3. Verify modal is open
  55  |     const modal = page.locator('[role="dialog"]');
  56  |     await expect(modal).toBeVisible();
  57  | 
  58  |     // 4. Enter normalized arXiv identifier
  59  |     const urlInput = modal.locator('input[placeholder*="arxiv.org"], input[placeholder*="http"]').first();
  60  |     await expect(urlInput).toBeVisible();
  61  |     await urlInput.fill('https://arxiv.org/abs/1706.03762');
  62  | 
  63  |     // 5. Click Lookup to trigger backend capture-url endpoint
  64  |     const lookupBtn = modal.getByRole('button', { name: /lookup|re-capture/i });
  65  |     await lookupBtn.click();
  66  | 
  67  |     // 6. Wait for preview resolution and form fields
  68  |     const titleInput = modal.locator('input[placeholder*="title" i]').first();
  69  |     await expect(titleInput).toBeVisible({ timeout: 15000 });
  70  | 
  71  |     // Set deterministic test title and tags
  72  |     const testTitle = `Attention Is All You Need (E2E Test ${Date.now()})`;
  73  |     await titleInput.fill(testTitle);
  74  | 
  75  |     const tagsInput = modal.locator('input[placeholder*="deep-learning"]').first();
  76  |     if (await tagsInput.isVisible()) {
  77  |       await tagsInput.fill('nlp, transformers, fullstack-e2e');
  78  |     }
  79  | 
  80  |     // 7. Click Confirm & Add to Library
  81  |     const confirmBtn = modal.getByRole('button', { name: /confirm & add/i });
  82  |     await expect(confirmBtn).toBeEnabled();
  83  |     await confirmBtn.click();
  84  | 
  85  |     // 8. Verify modal closes on HTTP 201/200 success
  86  |     await expect(modal).not.toBeVisible({ timeout: 15000 });
  87  | 
  88  |     // 9. DIRECT POSTGRESQL VERIFICATION
  89  |     if (prisma) {
  90  |       const createdItem = await prisma.catalogItem.findFirst({
  91  |         where: {
  92  |           workspaceId,
  93  |           title: testTitle,
  94  |         },
  95  |         include: {
  96  |           itemTags: {
  97  |             include: { tag: true },
  98  |           },
  99  |         },
  100 |       });
  101 | 
  102 |       expect(createdItem).toBeTruthy();
  103 |       expect(createdItem?.title).toBe(testTitle);
  104 |       expect(createdItem?.url).toBe('https://arxiv.org/abs/1706.03762');
  105 | 
  106 |       // Verify tags were persisted atomically
  107 |       const tagNames = createdItem?.itemTags.map((it: any) => it.tag.name) || [];
  108 |       expect(tagNames).toContain('nlp');
  109 |       expect(tagNames).toContain('transformers');
  110 | 
  111 |       // Verify CapturePreview was marked consumed
  112 |       const preview = await prisma.capturePreview.findFirst({
  113 |         where: {
  114 |           workspaceId,
  115 |           url: 'https://arxiv.org/abs/1706.03762',
  116 |         },
  117 |         orderBy: { createdAt: 'desc' },
  118 |       });
  119 |       expect(preview).toBeTruthy();
  120 |       expect(preview?.consumedAt).not.toBeNull();
  121 | 
  122 |       // Verify OutboxEvent was recorded
  123 |       const outbox = await prisma.outboxEvent.findFirst({
  124 |         where: {
  125 |           workspaceId,
  126 |           aggregateId: createdItem?.id,
  127 |           eventType: 'library.item.ingested_url',
  128 |         },
  129 |       });
  130 |       expect(outbox).toBeTruthy();
  131 |       expect(outbox?.status).toBeDefined();
  132 | 
  133 |       // Verify LibraryChange log entry was recorded
  134 |       const change = await prisma.libraryChange.findFirst({
  135 |         where: {
  136 |           workspaceId,
  137 |           entityId: createdItem?.id,
  138 |           action: 'create',
  139 |         },
  140 |       });
  141 |       expect(change).toBeTruthy();
  142 |     }
  143 |   });
  144 | 
  145 |   test('2. Anti-Replay Invariant: Backend rejects second confirmation of same preview token with 409 Conflict', async ({
  146 |     request,
  147 |   }) => {
  148 |     // Direct backend integration verification
  149 |     const testUrl = `https://arxiv.org/abs/2103.00020`;
  150 | 
  151 |     // 1. Capture preview
```