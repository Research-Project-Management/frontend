import type { LogEntry, ParsedLog } from '@/features/editor/domain/types';
import { parseLatexLog } from '@/features/editor/domain/latex/latex-structure';

export { parseLatexLog };
export type { LogEntry, ParsedLog };

export const DEFAULT_OUTPUT_FILES = [
  'output.aux',
  'output.chktex',
  'output.log',
  'output.pdfxref',
  'output.stderr',
  'output.stdout',
  'output.synctex.gz',
];
