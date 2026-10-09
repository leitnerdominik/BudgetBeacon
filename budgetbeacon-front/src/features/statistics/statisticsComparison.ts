const percentFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

// Display-only comparison: preserve the existing absolute-baseline formula.
export const describeStatisticsChange = (
  current: number,
  previous: number,
  favorableDirection?: "increase" | "decrease",
) => {
  const delta = current - previous;
  const direction = delta > 0 ? "Increased" : "Decreased";
  const color = delta === 0
    ? "text.secondary"
    : favorableDirection === undefined
      ? "primary.main"
      : (delta > 0) === (favorableDirection === "increase")
        ? "success.main"
        : "error.main";

  if (delta === 0) return { label: "Unchanged (0 %)", color };
  if (previous === 0) {
    return { label: `New (${direction.toLowerCase()} from zero)`, color };
  }

  const percentage = (delta / Math.abs(previous)) * 100;
  const prefix = percentage > 0 ? "+" : "";
  return { label: `${direction} (${prefix}${percentFormatter.format(percentage)} %)`, color };
};
