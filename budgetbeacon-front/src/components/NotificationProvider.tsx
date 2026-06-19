import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Alert, Snackbar, type AlertColor, type SnackbarCloseReason } from "@mui/material";

interface NotificationOptions {
  message: string;
  severity?: AlertColor;
  duration?: number;
}

interface NotificationState {
  open: boolean;
  message: string;
  severity: AlertColor;
  duration: number;
  key: number;
}

interface NotificationContextType {
  showNotification: (options: NotificationOptions) => void;
}

const DEFAULT_DURATION = 4000;

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: "",
    severity: "info",
    duration: DEFAULT_DURATION,
    key: 0,
  });

  const handleClose = (
    _event?: Event | React.SyntheticEvent,
    reason?: SnackbarCloseReason,
  ) => {
    if (reason === "clickaway") {
      return;
    }

    setNotification((current) => ({
      ...current,
      open: false,
    }));
  };

  const showNotification = useCallback((options: NotificationOptions) => {
    setNotification({
      open: true,
      message: options.message,
      severity: options.severity ?? "info",
      duration: options.duration ?? DEFAULT_DURATION,
      key: Date.now(),
    });
  }, []);

  const value = useMemo(
    () => ({
      showNotification,
    }),
    [showNotification],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Snackbar
        key={notification.key}
        open={notification.open}
        autoHideDuration={notification.duration}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={handleClose}
          severity={notification.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useNotification = () => {
  const context = useContext(NotificationContext);

  if (context === undefined) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }

  return context;
};
