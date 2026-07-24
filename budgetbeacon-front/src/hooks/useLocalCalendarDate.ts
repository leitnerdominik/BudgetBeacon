import { useEffect, useState } from "react";

import { getLocalCalendarDate } from "../utils/calendarDate";

const getMillisecondsUntilNextLocalDay = () => {
  const now = new Date();
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );

  return tomorrow.getTime() - now.getTime();
};

export const useLocalCalendarDate = () => {
  const [calendarDate, setCalendarDate] = useState(getLocalCalendarDate);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNextDay = () => {
      timeoutId = setTimeout(() => {
        setCalendarDate(getLocalCalendarDate());
        scheduleNextDay();
      }, getMillisecondsUntilNextLocalDay() + 100);
    };

    scheduleNextDay();

    return () => clearTimeout(timeoutId);
  }, []);

  return calendarDate;
};
