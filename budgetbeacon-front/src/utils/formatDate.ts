const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export const formatDate = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date);
};

export const formatCurrency = (value: number) => currencyFormatter.format(value);
