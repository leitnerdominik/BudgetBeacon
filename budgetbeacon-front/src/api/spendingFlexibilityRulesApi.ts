import { apiClient } from "./httpClient";
import type { SpendingFlexibilityOverride } from "../types/api";

export type SpendingFlexibilityRulePattern = {
  matchType: "Exact" | "Prefix";
  pattern: string;
};

export type SpendingFlexibilityRuleWriteRequest = SpendingFlexibilityRulePattern & {
  spendingFlexibility: SpendingFlexibilityOverride;
};

export type SpendingFlexibilityRule = SpendingFlexibilityRuleWriteRequest & {
  id: string;
};

const rulesUrl = "/user/spending-flexibility-rules";

export const getSpendingFlexibilityRules = () =>
  apiClient.get<SpendingFlexibilityRule[], SpendingFlexibilityRule[]>(rulesUrl);

export const createSpendingFlexibilityRule = (request: SpendingFlexibilityRuleWriteRequest) =>
  apiClient.post<SpendingFlexibilityRule, SpendingFlexibilityRule>(rulesUrl, request);

export const updateSpendingFlexibilityRule = (id: string, request: SpendingFlexibilityRuleWriteRequest) =>
  apiClient.put<void, void>(`${rulesUrl}/${id}`, request);

export const deleteSpendingFlexibilityRule = (id: string) =>
  apiClient.delete<void, void>(`${rulesUrl}/${id}`);
