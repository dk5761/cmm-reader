import React, {
  createContext,
  useContext,
  useCallback,
  ReactNode,
} from "react";
import { cookieJar } from "@/core/http/CookieJar";

/**
 * Simplified SessionContext for Mihon-style architecture.
 */

type SessionContextType = {
  invalidateSession: (baseUrl: string) => void;
};

const SessionContext = createContext<SessionContextType | null>(null);

type SessionProviderProps = {
  children: ReactNode;
};

/**
 * Provider that manages session invalidation.
 */
export function SessionProvider({ children }: SessionProviderProps) {
  /**
   * Invalidate session (clear cookies for a domain)
   * Called when CF challenge is detected or on manual logout
   */
  const invalidateSession = useCallback((baseUrl: string) => {
    console.log("[SessionProvider] Invalidating session for:", baseUrl);
    cookieJar.invalidateDomain(baseUrl);
  }, []);

  return (
    <SessionContext.Provider value={{ invalidateSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
