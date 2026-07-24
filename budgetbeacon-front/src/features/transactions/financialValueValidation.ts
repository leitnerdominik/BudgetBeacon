export const minimumSupportedTransactionDate = "2000-01-01";
export const maximumSupportedTransactionDate = "2100-12-31";
export const maximumAbsoluteTransactionAmount = 9_999_999_999_999.99;
export const maximumAbsoluteTransactionAmountInput = "9999999999999.99";

type AmountValidationResult =
  | { value: number; error: null }
  | { value: null; error: string };

export const validateTransactionAmount = (
  rawAmount: string,
): AmountValidationResult => {
  const amount = rawAmount.trim();

  if (amount.length === 0) {
    return { value: null, error: "Amount is required." };
  }

  if (!/^\d+(?:\.\d+)?$/.test(amount)) {
    return {
      value: null,
      error: "Enter a positive amount using digits and an optional decimal point.",
    };
  }

  const parsedAmount = Number(amount);

  if (!Number.isFinite(parsedAmount) || parsedAmount === 0) {
    return { value: null, error: "Amount must be greater than zero." };
  }

  const fractionalPart = amount.split(".", 2)[1] ?? "";
  const meaningfulFractionalPart = fractionalPart.replace(/0+$/, "");

  if (meaningfulFractionalPart.length > 2) {
    return {
      value: null,
      error: "Amount must have no more than 2 decimal places.",
    };
  }

  if (parsedAmount > maximumAbsoluteTransactionAmount) {
    return {
      value: null,
      error: "Amount must not exceed 9,999,999,999,999.99.",
    };
  }

  return { value: parsedAmount, error: null };
};

export const validateTransactionDate = (date: string): string | null => {
  if (date.length === 0) {
    return "Date is required.";
  }

  if (
    date < minimumSupportedTransactionDate ||
    date > maximumSupportedTransactionDate
  ) {
    return "Date must be between 2000-01-01 and 2100-12-31.";
  }

  return null;
};
