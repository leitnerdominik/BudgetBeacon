import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSpendingFlexibilityRule,
  deleteSpendingFlexibilityRule,
  getSpendingFlexibilityRules,
  updateSpendingFlexibilityRule,
  type SpendingFlexibilityRuleWriteRequest,
} from "../../api/spendingFlexibilityRulesApi";

export const spendingFlexibilityRulesQueryKey = ["spending-flexibility-rules"] as const;

export const useSpendingFlexibilityRules = () =>
  useQuery({
    queryKey: spendingFlexibilityRulesQueryKey,
    queryFn: getSpendingFlexibilityRules,
  });

type RuleMutation = {
  action: "save";
  id?: string;
  request: SpendingFlexibilityRuleWriteRequest;
} | {
  action: "delete";
  id: string;
};

export const useSpendingFlexibilityRuleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mutation: RuleMutation) => {
      if (mutation.action === "delete") {
        await deleteSpendingFlexibilityRule(mutation.id);
      } else if (mutation.id) {
        await updateSpendingFlexibilityRule(mutation.id, mutation.request);
      } else {
        await createSpendingFlexibilityRule(mutation.request);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: spendingFlexibilityRulesQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      ]);
    },
  });
};
