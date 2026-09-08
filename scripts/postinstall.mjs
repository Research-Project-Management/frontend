/**
 * postinstall.mjs
 *
 * Copies the PDF.js worker file to the public directory after install.
 * react-pdf bundles its own pdfjs-dist; prefer it over the top-level one.
 */

import { existsSync, copyFileSync } from 'fs';

const reactPdfWorker =
  'node_modules/react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
const fallbackWorker =
  'node_modules/pdfjs-dist/build/pdf.worker.min.mjs';

const src = existsSync(reactPdfWorker) ? reactPdfWorker : fallbackWorker;

if (!existsSync(src)) {
  console.warn('[postinstall] pdf.worker.min.mjs not found — skipping copy.');
  process.exit(0);
}

copyFileSync(src, 'public/pdf.worker.min.mjs');
console.log(`[postinstall] ✅ pdf.worker.min.mjs copied from ${src}`);
