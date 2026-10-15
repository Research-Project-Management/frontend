'use client';

import { toast } from 'sonner';

export const WORK_ITEM_TOAST_IDS = {
  action: 'work-item-action',
  bulk: 'work-item-bulk',
  reorder: 'work-item-reorder',
  assignment: 'work-item-assignment',
  attachment: 'work-item-attachment',
  upload: 'work-item-upload',
  comment: 'work-item-comment',
  relation: 'work-item-relation',
  clipboard: 'work-item-clipboard',
  info: 'work-item-info',
} as const;

export type WorkItemToastScope = keyof typeof WORK_ITEM_TOAST_IDS;

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return fallback;
}

export const workItemToast = {
  success: (message: string, scope: WorkItemToastScope = 'action') => {
    toast.success(message, { id: WORK_ITEM_TOAST_IDS[scope] });
  },
  error: (error: unknown, fallback: string, scope: WorkItemToastScope = 'action') => {
    toast.error(resolveErrorMessage(error, fallback), { id: WORK_ITEM_TOAST_IDS[scope] });
  },
  info: (message: string, scope: WorkItemToastScope = 'info') => {
    toast.info(message, { id: WORK_ITEM_TOAST_IDS[scope] });
  },
  dismiss: (scope: WorkItemToastScope) => {
    toast.dismiss(WORK_ITEM_TOAST_IDS[scope]);
  },
};
