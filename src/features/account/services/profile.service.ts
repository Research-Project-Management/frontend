import { apiPut } from '@/shared/lib/api';
import type { AuthUser } from '@/features/auth/types/auth.types';
import type { UpdateProfilePayload } from '../types/profile.types';

export const updateProfile = async (
  data: UpdateProfilePayload,
): Promise<{ user: AuthUser }> => {
  return apiPut<{ user: AuthUser }>('/auth/profile', {
    name: data.name,
    avatar: data.avatar ?? null,
  });
};
