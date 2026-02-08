
import type { TypeUser } from "~/types/user";

export const fetchUser = async () :Promise<TypeUser>=> {
  const response = await fetch(import.meta.env.VITE_API_URL+"/auth/user", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user");
  }

  const data = await response.json();
  return data.user;
}

export const logoutUser = async () => {
  const response = await fetch(import.meta.env.VITE_API_URL+"/auth/logout", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to logout");
  }

  return window.location.replace("/login");
}