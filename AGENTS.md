<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Frontend AI Agent & Developer Guidelines

> Tham khảo tài liệu đầy đủ tại `../AGENTS.md`.

## ⚡ Nguyên Tắc Kiểm Tra & Build Nhanh:
1. **Tuyệt đối KHÔNG chạy các lệnh audit nặng**: `jscpd`, `madge`, `knip` hoặc full repo audits.
2. **Chỉ chạy test scoped theo feature**:
   - `pnpm test:library`
   - `pnpm test:editor`
   - `pnpm test:projects`
   - `pnpm test:storage`
   - `pnpm test:reader`
   - `pnpm test:ai`
   - `pnpm test:changed`
   - Hoặc chạy trực tiếp file test: `pnpm vitest run tests/unit/<file>.test.ts`
3. **Build**:
   - `pnpm build` (Next.js Turbopack).
