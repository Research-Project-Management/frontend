import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { changePassword } from '../services/security.service';
import type { ChangePasswordPayload } from '../types/security.types';
import { getErrorMessage } from "@/shared/lib/utils";

export const useChangePassword = () => {
  return useMutation({
    mutationFn: (data: ChangePasswordPayload) => changePassword(data),
    onMutate: () => {
      toast.loading('Changing password...', { id: 'password-change' });
    },
    onSuccess: () => {
      toast.success('Password changed successfully', { id: 'password-change' });
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error) || 'Failed to change password', { id: 'password-change' });
    },
  });
};
