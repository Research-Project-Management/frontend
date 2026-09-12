import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authKeys } from '@/features/auth/constants/auth.keys';
import type { AuthUser } from '@/features/auth/types/auth.types';
import { getErrorMessage } from "@/shared/lib/utils";
import { updateProfile } from '../services/profile.service';
import type { UpdateProfilePayload } from '../types/profile.types';

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfilePayload) => updateProfile(data),
    onMutate: () => {
      toast.loading('Updating profile...', { id: 'profile-update' });
    },
    onSuccess: (res, variables) => {
      toast.success('Profile updated', { id: 'profile-update' });
      const updatedUser = res?.user;
      queryClient.setQueryData<AuthUser | null>(authKeys.session(), (old) => {
        if (!old) return old;
        return {
          ...old,
          ...(updatedUser
            ? updatedUser
            : {
                name: variables.name,
                ...(variables.avatar !== undefined ? { avatar: variables.avatar ?? undefined } : {}),
              }),
        };
      });
      queryClient.invalidateQueries({ queryKey: authKeys.session() });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error) || 'Failed to update profile', { id: 'profile-update' });
    },
  });
};
