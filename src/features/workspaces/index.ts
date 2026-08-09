// ── workspaces/index.ts ───────────────────────────────────────────────────────
// Public API — outer sidebar maps 1:1 to each mini-module below.

// ── Shell (chrome: Topbar, outer Sidebar, Avatar...) ─────────────────────────
export * from './shell';

// ── Projects tab ─────────────────────────────────────────────────────────────
export * from './projects';

// ── AI tab ───────────────────────────────────────────────────────────────
export * from './ai';

// ── Library tab ───────────────────────────────────────────────────────────────
export * from './library';

// ── Storage tab ───────────────────────────────────────────────────────────────
export * from './storage';

// ── Settings tab ──────────────────────────────────────────────────────────────
export * from './settings';
