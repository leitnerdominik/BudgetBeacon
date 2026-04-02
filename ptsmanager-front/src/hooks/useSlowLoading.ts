import { useEffect, useState } from "react";

export const useSlowLoading = (isActive: boolean, delay = 1400) => {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setIsSlow(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsSlow(true);
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [delay, isActive]);

  return isSlow;
};
