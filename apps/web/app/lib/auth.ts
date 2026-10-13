import { apiClient, ApiError } from "@quizmaster/api-client";
import { useQuery } from "@tanstack/react-query";

export const authQuery = {
  queryKey: ["auth", "me"] as const,
  queryFn: async () => {
    try {
      return await apiClient.me();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },
};

export function useAuth() {
  return useQuery(authQuery);
}
