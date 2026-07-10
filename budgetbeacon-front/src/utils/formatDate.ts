const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const dateOnlyFormatter = new Intl.DateTimeFormat("de-DE", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  timeZone: "UTC",
});

const isoDateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export const formatDate = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const formatter =
    typeof value === "string" && isoDateOnlyPattern.test(value)
      ? dateOnlyFormatter
      : dateFormatter;

  return formatter.format(date);
};

export const formatCurrency = (value: number) => currencyFormatter.format(value);
