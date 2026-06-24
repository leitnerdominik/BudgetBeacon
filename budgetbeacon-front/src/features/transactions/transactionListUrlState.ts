import {
  defaultTransactionQuery,
  type TransactionQueryRequest,
  type TransactionSortDirection,
  type TransactionSortField,
  type TransactionTypeFilter,
} from "../../api/transactionsApi";

export type TransactionListState = {
  page: number;
  pageSize: number;
  query: TransactionQueryRequest;
};

const defaultPage = 0;
const defaultPageSize = 10;
const allowedPageSizes = new Set([5, 10, 25]);
const allowedTransactionTypes = new Set<TransactionTypeFilter>([
  "all",
  "income",
  "expense",
]);
const allowedSortFields = new Set<TransactionSortField>([
  "date",
  "amount",
  "category",
  "description",
]);
const allowedSortDirections = new Set<TransactionSortDirection>(["asc", "desc"]);

const getPositiveInteger = (value: string | null) => {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const getAllowedValue = <Value extends string>(
  value: string | null,
  allowedValues: Set<Value>,
) => (value && allowedValues.has(value as Value) ? (value as Value) : undefined);

export const parseTransactionListUrlState = (
  searchParams: URLSearchParams,
): TransactionListState => {
  const page = getPositiveInteger(searchParams.get("page"));
  const pageSize = getPositiveInteger(searchParams.get("pageSize"));
  const transactionType = getAllowedValue(
    searchParams.get("type"),
    allowedTransactionTypes,
  );
  const sortBy = getAllowedValue(searchParams.get("sortBy"), allowedSortFields);
  const sortDirection = getAllowedValue(
    searchParams.get("sortDirection"),
    allowedSortDirections,
  );

  return {
    page: page ? page - 1 : defaultPage,
    pageSize: pageSize && allowedPageSizes.has(pageSize) ? pageSize : defaultPageSize,
    query: {
      searchTerm: searchParams.get("search") ?? defaultTransactionQuery.searchTerm,
      category: searchParams.get("category") ?? defaultTransactionQuery.category,
      transactionType: transactionType ?? defaultTransactionQuery.transactionType,
      startDate: searchParams.get("startDate") ?? defaultTransactionQuery.startDate,
      endDate: searchParams.get("endDate") ?? defaultTransactionQuery.endDate,
      sortBy: sortBy ?? defaultTransactionQuery.sortBy,
      sortDirection: sortDirection ?? defaultTransactionQuery.sortDirection,
    },
  };
};

export const buildTransactionListSearchParams = (
  state: TransactionListState,
) => {
  const params = new URLSearchParams();
  const searchTerm = state.query.searchTerm.trim();

  if (state.page > defaultPage) {
    params.set("page", String(state.page + 1));
  }

  if (state.pageSize !== defaultPageSize) {
    params.set("pageSize", String(state.pageSize));
  }

  if (searchTerm.length > 0) {
    params.set("search", searchTerm);
  }

  if (state.query.category.length > 0) {
    params.set("category", state.query.category);
  }

  if (state.query.transactionType !== defaultTransactionQuery.transactionType) {
    params.set("type", state.query.transactionType);
  }

  if (state.query.startDate.length > 0) {
    params.set("startDate", state.query.startDate);
  }

  if (state.query.endDate.length > 0) {
    params.set("endDate", state.query.endDate);
  }

  if (state.query.sortBy !== defaultTransactionQuery.sortBy) {
    params.set("sortBy", state.query.sortBy);
  }

  if (state.query.sortDirection !== defaultTransactionQuery.sortDirection) {
    params.set("sortDirection", state.query.sortDirection);
  }

  return params;
};

export const getTransactionsReturnPath = (search: string) =>
  search.length > 0 ? `/transactions${search}` : "/transactions";
