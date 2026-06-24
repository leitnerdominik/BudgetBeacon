import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type BeforeInstallPromptOutcome = "accepted" | "dismissed";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: BeforeInstallPromptOutcome; platform: string }>;
  prompt: () => Promise<void>;
}

interface StandaloneNavigator extends Navigator {
  readonly standalone?: boolean;
}

interface PwaInstallContextType {
  canInstall: boolean;
  isInstalled: boolean;
  installApp: () => Promise<void>;
}

const PwaInstallContext = createContext<PwaInstallContextType | undefined>(
  undefined,
);

const isStandaloneDisplayMode = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: fullscreen)").matches ||
  (window.navigator as StandaloneNavigator).standalone === true;

const getInitialInstalledState = () =>
  typeof window === "undefined" ? false : isStandaloneDisplayMode();

export const PwaInstallProvider = ({ children }: { children: ReactNode }) => {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(getInitialInstalledState);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);

    if (choice.outcome === "accepted") {
      setIsInstalled(true);
    }
  }, [installPrompt]);

  const value = useMemo(
    () => ({
      canInstall: !!installPrompt && !isInstalled,
      isInstalled,
      installApp,
    }),
    [installApp, installPrompt, isInstalled],
  );

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
    </PwaInstallContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const usePwaInstall = () => {
  const context = useContext(PwaInstallContext);

  if (context === undefined) {
    throw new Error("usePwaInstall must be used within a PwaInstallProvider");
  }

  return context;
};
