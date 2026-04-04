import { apiGet, apiPost, apiPut } from "~/lib/api";
import type { TypeUser } from "~/types/user";

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};

type RegisterResponse = {
  user: TypeUser;
};

type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

type ChangePasswordResponse = {
  message: string;
};

export const fetchUser = async (): Promise<TypeUser> => {
  const data = await apiGet<{ user: TypeUser }>("/auth/user");
  return data.user;
};

export const registerUser = async (
  payload: RegisterPayload,
): Promise<RegisterResponse> => {
  return apiPost<RegisterResponse>("/auth/register", payload);
};

export const logoutUser = async () => {
  await apiGet("/auth/logout");
  return window.location.replace("/login");
};

export const changePassword = async (
  payload: ChangePasswordPayload,
): Promise<ChangePasswordResponse> => {
  return apiPut<ChangePasswordResponse>("/auth/change-password", payload);
};