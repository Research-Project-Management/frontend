import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authKeys } from '@/features/auth/constants/auth.keys';
import { updateProfile } from '../services/profile.service';
import type { UpdateProfilePayload } from '../types/profile.types';

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: UpdateProfilePayload) => updateProfile(data),
    onMutate: () => {
      toast.loading('Updating profile...', { id: 'profile-update' });
    },
    onSuccess: (_, variables) => {
      toast.success('Profile updated', { id: 'profile-update' });
      // Optimistically update the user cache or invalidate
      queryClient.setQueryData(authKeys.session(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          name: variables.name,
          ...(variables.avatar !== undefined ? { avatar: variables.avatar } : {}),
        };
      });
      queryClient.invalidateQueries({ queryKey: authKeys.session() });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update profile', { id: 'profile-update' });
    }
  });
};
