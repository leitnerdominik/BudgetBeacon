import type {
  SpendingFlexibility,
  SpendingFlexibilityOverride,
  Transaction,
} from "../../types/api";

export type SpendingFlexibilityChoice = SpendingFlexibilityOverride | "UseAutomatic";

export const spendingFlexibilityChoices: Record<SpendingFlexibilityChoice, {
  label: string;
  description: string;
}> = {
  UseAutomatic: { label: "Use automatic", description: "Apply the automatic assessment." },
  Essential: { label: "Essential", description: "Difficult to avoid in the short term." },
  Optimizable: { label: "Optimizable", description: "Necessary, with room to reduce the cost." },
  Optional: { label: "Optional", description: "Can be reduced or skipped if needed." },
  Unclassified: { label: "Unclassified", description: "Keep this expense without a class." },
};

export const getSpendingFlexibilitySummary = (
  choice: SpendingFlexibilityChoice,
  category: string,
  transaction?: Pick<Transaction, "category" | "spendingFlexibility" | "spendingFlexibilitySource">,
  defaults?: Partial<Record<string, SpendingFlexibility>>,
) => {
  if (choice !== "UseAutomatic") {
    return `${choice} · Manual`;
  }

  if (transaction?.category === category && transaction.spendingFlexibilitySource === "CategoryDefault") {
    return `${transaction.spendingFlexibility} · Category default`;
  }

  if (transaction?.category === category && transaction.spendingFlexibilitySource === "Unclassified") {
    return "Unclassified · No automatic assessment";
  }

  if (!defaults) {
    return undefined;
  }

  const categoryDefault = defaults[category];
  return categoryDefault
    ? `${categoryDefault} · Category default`
    : "Unclassified · No automatic assessment";
};
