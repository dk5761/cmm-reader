import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { SessionWarmup } from "../components/SessionWarmup";

type SessionState = {
  isReady: boolean;
  warmedUpUrls: Set<string>;
};

type SessionContextType = {
  isSessionReady: (baseUrl: string) => boolean;
  warmupSession: (baseUrl: string) => void;
};

const SessionContext = createContext<SessionContextType | null>(null);

type SessionProviderProps = {
  children: ReactNode;
};

/**
 * Provider that manages session warmup for manga sources.
 * Renders hidden WebViews to establish cookies before loading images.
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const [warmingUrls, setWarmingUrls] = useState<string[]>([]);
  const [readyUrls, setReadyUrls] = useState<Set<string>>(new Set());

  const isSessionReady = useCallback(
    (baseUrl: string) => {
      return readyUrls.has(baseUrl);
    },
    [readyUrls]
  );

  const warmupSession = useCallback(
    (baseUrl: string) => {
      if (readyUrls.has(baseUrl) || warmingUrls.includes(baseUrl)) {
        return; // Already ready or warming up
      }
      console.log("[SessionProvider] Starting warmup for:", baseUrl);
      setWarmingUrls((prev) => [...prev, baseUrl]);
    },
    [readyUrls, warmingUrls]
  );

  const handleWarmupReady = useCallback((baseUrl: string) => {
    console.log("[SessionProvider] Session ready for:", baseUrl);
    setReadyUrls((prev) => new Set([...prev, baseUrl]));
    setWarmingUrls((prev) => prev.filter((url) => url !== baseUrl));
  }, []);

  return (
    <SessionContext.Provider value={{ isSessionReady, warmupSession }}>
      {children}
      {/* Render hidden WebViews for each URL being warmed up */}
      {warmingUrls.map((url) => (
        <SessionWarmup
          key={url}
          url={url}
          onReady={() => handleWarmupReady(url)}
          timeout={8000}
        />
      ))}
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
