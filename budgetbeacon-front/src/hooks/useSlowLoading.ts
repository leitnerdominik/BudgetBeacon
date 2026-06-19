import { useEffect, useState } from "react";

export const useSlowLoading = (isActive: boolean, delay = 1400) => {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!isActive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
