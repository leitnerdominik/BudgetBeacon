import { useQuery } from "@tanstack/react-query";
import { getUserPreferences } from "../../api/userPreferencesApi";

export const userPreferencesQueryKey = ["userPreferences"] as const;

export const useUserPreferences = () => {
  return useQuery({
    queryKey: userPreferencesQueryKey,
    queryFn: getUserPreferences,
    staleTime: 1000 * 60 * 5,
  });
};
