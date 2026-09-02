import { apiPut } from '@/shared/lib/api';
import type { ChangePasswordPayload } from '../types/security.types';

export const changePassword = async (data: ChangePasswordPayload): Promise<{ message: string }> => {
  return apiPut<{ message: string }>('/auth/change-password', {
    currentPassword: data.currentPassword,
    newPassword: data.newPassword,
  });
};
