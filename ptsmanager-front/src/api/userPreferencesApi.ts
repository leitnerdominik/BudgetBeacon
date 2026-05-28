import { apiClient } from "./httpClient";
import type { UserPreferences } from "../types/api";

export interface UpdateUserPreferencesRequest {
  aiLocationContext: string | null;
}

export const getUserPreferences = async (): Promise<UserPreferences> => {
  return apiClient.get<UserPreferences, UserPreferences>("/user/preferences");
};

export const updateUserPreferences = async (
  request: UpdateUserPreferencesRequest,
): Promise<UserPreferences> => {
  return apiClient.put<UserPreferences, UserPreferences>(
    "/user/preferences",
    request,
  );
};
