import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateUserPreferences,
  type UpdateUserPreferencesRequest,
} from "../../api/userPreferencesApi";
import { useNotification } from "../../components/NotificationProvider";
import { userPreferencesQueryKey } from "./useUserPreferences";

export const useUpdateUserPreferences = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  return useMutation({
    mutationFn: (request: UpdateUserPreferencesRequest) =>
      updateUserPreferences(request),
    onSuccess: (preferences) => {
      queryClient.setQueryData(userPreferencesQueryKey, preferences);
      queryClient.invalidateQueries({ queryKey: ["tips"] });
      showNotification({
        severity: "success",
        message: "Settings saved.",
      });
    },
    onError: (error) => {
      showNotification({
        severity: "error",
        message:
          error instanceof Error ? error.message : "Settings could not be saved.",
      });
    },
  });
};
