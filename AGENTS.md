<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Frontend Quality Rules

- **Preserve custom design & layer rules** in `eslint.config.mjs` (DESIGN.md 600 weight cap, semantic CSS tokens, TanStack Query, `features/ai/*` layer boundaries).
- **No new `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`**, **no new `as unknown`**, and **no empty `catch {}`** without error name + reason comment.
- **Keep `src/shared/` independent of `src/features/`** and keep `**/domain/**` free of `next/*` imports.
- **Do not weaken or bypass quality gates** (`lefthook.yml`, `.oxlintrc*.json`, `eslint.config.mjs`, `.dependency-cruiser.js`, `scripts/gates/**`, `.github/workflows/**`, `AGENTS.md`); never use `--no-verify`.

## Required verification before finishing

```sh
pnpm run verify:quick
```

Before opening a PR or after cross-feature refactors:

```sh
pnpm run verify:ci
```

