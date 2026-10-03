'use client';

import React from 'react';
import { type CompileStatus } from '@/features/editor/store';
import type { ParsedLog } from './Logs';

export interface StatusProps {
  compileStatus: CompileStatus;
  lastCompiledAt: Date | null;
  pdfUrl: string | null;
  parsedLog?: ParsedLog | null;
  onToggleLog: () => void;
  onJumpToFirstError?: () => void;
}

export default React.memo(function Status(_props: StatusProps) {
  return null;
});
