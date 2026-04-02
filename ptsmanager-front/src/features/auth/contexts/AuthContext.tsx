import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "../types";

const AUTH_UNAUTHORIZED_EVENT = "auth:unauthorized";

const isLikelyJwt = (token: string) => token.split(".").length === 3;

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  // Lazy Initialization: This callback only runs ONCE during the initial mount.
  // It prevents double-rendering and synchronously sets the correct initial state.
  const [user, setUser] = useState<User | null>(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (storedToken && storedUser) {
      if (!isLikelyJwt(storedToken)) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        return null;
      }

      try {
        return JSON.parse(storedUser);
      } catch {
        console.error("Failed to parse user from local storage");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        return null;
      }
    }
    return null;
  });

  const login = (token: string, newUser: User) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(newUser));
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);

    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
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

export const notifyUnauthorized = () => {
  window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
};
