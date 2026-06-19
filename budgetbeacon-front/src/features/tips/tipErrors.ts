export const TIPS_SOURCE_DATA_NOT_FOUND_TYPE =
  "urn:budgetbeacon:tips-source-data-not-found";

type ApiProblemError = {
  type?: unknown;
};

export const isTipsSourceDataNotFound = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  (error as ApiProblemError).type === TIPS_SOURCE_DATA_NOT_FOUND_TYPE;
