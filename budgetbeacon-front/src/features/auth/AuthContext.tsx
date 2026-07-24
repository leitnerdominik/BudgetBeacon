import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getCurrentSession } from "../../api/authApi";
import { refreshCsrfToken } from "../../api/httpClient";
import { AUTH_UNAUTHORIZED_EVENT } from "../../events/authEvents";
import { clearLegacyPersistentTipsCache } from "../tips/tipsCache";
import type { User } from "./types";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const authStateVersionRef = useRef(0);

  const clearAuthenticatedClientState = useCallback(() => {
    queryClient.removeQueries();
    clearLegacyPersistentTipsCache();
  }, [queryClient]);

  const login = useCallback((newUser: User) => {
    authStateVersionRef.current += 1;
    clearAuthenticatedClientState();
    setUser(newUser);
    setIsInitializing(false);
  }, [clearAuthenticatedClientState]);

  const logout = useCallback(() => {
    authStateVersionRef.current += 1;
    clearAuthenticatedClientState();
    setUser(null);
    setIsInitializing(false);
  }, [clearAuthenticatedClientState]);

  useEffect(() => {
    clearLegacyPersistentTipsCache();

    let isMounted = true;
    const requestVersion = authStateVersionRef.current;
    const isCurrentRequest = () =>
      isMounted && authStateVersionRef.current === requestVersion;

    const loadSession = async () => {
      try {
        await refreshCsrfToken().catch(() => undefined);
        const session = await getCurrentSession();
        if (isCurrentRequest()) {
          setUser(session.user);
        }
      } catch {
        if (isCurrentRequest()) {
          clearAuthenticatedClientState();
          setUser(null);
        }
      } finally {
        if (isCurrentRequest()) {
          setIsInitializing(false);
        }
      }
    };

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, [clearAuthenticatedClientState]);

  useEffect(() => {
    const handleUnauthorized = () => logout();

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);

    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, [logout]);

  const value = {
    user,
    isAuthenticated: !!user,
    isInitializing,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Tell Vite's Fast Refresh Linter that exporting this custom hook alongside
// the component is intentional and safe.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
