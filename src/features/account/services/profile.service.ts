import { apiPut } from '@/shared/lib/api';
import type { UpdateProfilePayload } from '../types/profile.types';

export const updateProfile = async (data: UpdateProfilePayload): Promise<void> => {
  await apiPut('/auth/profile', data);
};
