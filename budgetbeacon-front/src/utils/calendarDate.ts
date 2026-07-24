const calendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

const formatCalendarDateParts = (
  year: number,
  month: number,
  day: number,
) =>
  `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export const getLocalCalendarDate = (date = new Date()) =>
  formatCalendarDateParts(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );

export const subtractCalendarMonths = (
  calendarDate: string,
  monthsBack: number,
) => {
  const match = calendarDatePattern.exec(calendarDate);
  if (!match || !Number.isInteger(monthsBack) || monthsBack < 0) {
    throw new RangeError("A valid calendar date and nonnegative month count are required.");
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const sourceDaysInMonth = new Date(
    Date.UTC(year, monthIndex + 1, 0),
  ).getUTCDate();

  if (
    monthIndex < 0 ||
    monthIndex > 11 ||
    day < 1 ||
    day > sourceDaysInMonth
  ) {
    throw new RangeError("A valid calendar date and nonnegative month count are required.");
  }

  const targetMonthIndex = year * 12 + monthIndex - monthsBack;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const normalizedTargetMonthIndex =
    ((targetMonthIndex % 12) + 12) % 12;
  const targetDaysInMonth = new Date(
    Date.UTC(targetYear, normalizedTargetMonthIndex + 1, 0),
  ).getUTCDate();

  return formatCalendarDateParts(
    targetYear,
    normalizedTargetMonthIndex + 1,
    Math.min(day, targetDaysInMonth),
  );
};
