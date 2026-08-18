import { z } from 'zod';
import { updateProfileSchema } from '../schemas/profile.schema';

export interface UpdateProfilePayload {
  name: string;
  avatar?: string | null;
}

export interface TypeUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  githubId?: string;
  googleId?: string;
  createdAt: string;
  updatedAt: string;
}