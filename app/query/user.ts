import { apiGet } from "~/lib/api";
import type { TypeUser } from "~/types/user";

export const fetchUser = async (): Promise<TypeUser> => {
  const data = await apiGet<{ user: TypeUser }>("/auth/user");
  return data.user;
};

export const logoutUser = async () => {
  await apiGet("/auth/logout");
  return window.location.replace("/login");
};