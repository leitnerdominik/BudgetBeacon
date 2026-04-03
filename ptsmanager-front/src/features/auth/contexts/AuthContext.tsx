import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AUTH_UNAUTHORIZED_EVENT } from "../auth-events";
import { getCurrentSession } from "../api/session";
import { refreshCsrfToken } from "../../../lib/api-client";
import type { User } from "../types";

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
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const login = (newUser: User) => {
    setUser(newUser);
  };

  const logout = () => {
    setUser(null);
  };

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        await refreshCsrfToken().catch(() => undefined);
        const session = await getCurrentSession();
        if (isMounted) {
          setUser(session.user);
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setIsInitializing(false);
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);

    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, []);

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
