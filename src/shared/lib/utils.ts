import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'text-9',
        'text-10',
        'text-11',
        'text-12',
        'text-13',
        'text-14',
        'text-16',
        'text-18',
        'text-20',
        'text-24',
        'text-28',
        'text-32',
        'text-40',
        'text-micro',
        'text-caption',
        'text-dense',
        'text-sub',
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return customTwMerge(clsx(inputs));
}

// Ergonomic re-exports for shared utilities
export { copyToClipboard } from './clipboard';
export { logger } from './logger';
export {
  getErrorMessage,
  tryCatch,
  tryCatchSync,
  isOk,
  isErr,
  Ok,
  Err,
  type Result,
  type Ok as OkType,
  type Err as ErrType,
} from '../utils/error.util';
export {
  formatDate,
  formatRelativeTime,
  formatBytes,
  fixMojibake,
  getInitials,
} from '../utils/format';
