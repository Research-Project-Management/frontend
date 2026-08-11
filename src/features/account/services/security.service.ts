import { apiPut } from '@/shared/lib/api';
import type { ChangePasswordPayload } from '../types/security.types';

export const changePassword = async (data: ChangePasswordPayload): Promise<void> => {
  await apiPut('/auth/change-password', data);
};
