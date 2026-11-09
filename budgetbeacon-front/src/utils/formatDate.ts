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
const isoCalendarDatePattern =
  /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

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

// Booking dates represent calendar days, even when the API includes a time/offset.
export const formatCalendarDate = (value: string): string => {
  const match = isoCalendarDatePattern.exec(value);
  if (!match || Number.isNaN(new Date(value).getTime())) {
    return value;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);

  if (
    year < 1 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return value;
  }

  return dateOnlyFormatter.format(date);
};

export const formatCurrency = (value: number) => currencyFormatter.format(value);
