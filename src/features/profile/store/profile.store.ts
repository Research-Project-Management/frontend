import { create } from 'zustand';
import type { TypeUser } from '@/features/profile/types/profile.types';

interface UserState {
  user: TypeUser | null;
  isAuthenticated: boolean;
  
  setUser: (user: TypeUser | null) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));
