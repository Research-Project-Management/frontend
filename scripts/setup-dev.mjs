/**
 * setup-dev.mjs
 *
 * Solves EPERM/atomic-rename failures on Windows when the project lives on a
 * VirtualBox shared folder (or any network-mapped drive).
 *
 * Strategy: create a Windows directory junction
 *   <project>/.next  →  C:\flux-next-cache
 *
 * Junctions are transparent to all tools — Next.js, Webpack, and Turbopack
 * see a normal local directory while the actual files land on C:\ (true NTFS),
 * where atomic renames and unlinking always succeed.
 *
 * No admin rights required (junctions ≠ symlinks on Windows).
 * Falls back silently on non-Windows (Linux/macOS use real local FS anyway).
 */

import { existsSync, mkdirSync, rmSync, lstatSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(__dirname, '..');
const nextDir = join(projectRoot, '.next');
const cacheDir = 'C:\\flux-next-cache';

// ── Only needed on Windows ──────────────────────────────────────────────────
if (process.platform !== 'win32') {
  process.exit(0);
}

// ── 1. Ensure the local cache directory exists on C:\ ───────────────────────
if (!existsSync(cacheDir)) {
  mkdirSync(cacheDir, { recursive: true });
  console.log(`[dev-setup] Created cache dir: ${cacheDir}`);
}

const cacheNodeModules = join(cacheDir, 'node_modules');
const projectNodeModules = join(projectRoot, 'node_modules');
if (!existsSync(cacheNodeModules) && existsSync(projectNodeModules)) {
  try {
    execSync(`cmd /c mklink /J "${cacheNodeModules}" "${projectNodeModules}"`, { stdio: 'pipe' });
    console.log(`[dev-setup] ✅ Linked node_modules to cache dir`);
  } catch {}
}

// ── 2. Check if .next is already a junction pointing to C:\ ─────────────────
function isJunction(p) {
  try {
    const stat = lstatSync(p);
    // Junction shows as JUNCTION symlink on Windows via lstat
    return stat.isSymbolicLink();
  } catch {
    return false;
  }
}

if (isJunction(nextDir)) {
  console.log('[dev-setup] .next junction already in place — skipping.');
  process.exit(0);
}

// ── 3. Remove any existing .next (real dir or junction) ─────────────────────
if (existsSync(nextDir) || isJunction(nextDir)) {
  try {
    // First try as junction (no /s — only removes the link, not the target)
    execSync(`cmd /c rmdir /q "${nextDir}"`, { stdio: 'pipe' });
  } catch {
    try {
      // Fall back: it's a real non-empty directory — remove recursively
      execSync(`cmd /c rmdir /s /q "${nextDir}"`, { stdio: 'pipe' });
    } catch {
      // If removal fails (e.g. locked files or permission issue on network drive), rename out of the way
      try {
        const backupName = `.next_old_${Date.now()}`;
        execSync(`cmd /c ren "${nextDir}" "${backupName}"`, { stdio: 'pipe' });
      } catch {
        // Continue
      }
    }
  }
}

// ── 4. Create the junction .next → C:\flux-next-cache ───────────────────────
try {
  execSync(`cmd /c mklink /J "${nextDir}" "${cacheDir}"`, { stdio: 'pipe' });
  console.log(`[dev-setup] ✅ .next → ${cacheDir} (Windows junction)`);
} catch (err) {
  // Non-fatal: if junction creation fails, Next.js will create .next normally.
  // This may happen if .next already exists as a real directory after a failed cleanup.
  console.warn('[dev-setup] ⚠ Could not create junction, continuing without it:', err.message);
}
