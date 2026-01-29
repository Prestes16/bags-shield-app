"use client";

import { useState, useEffect } from "react";

export interface ClientFeatureFlags {
  LOCAL_CACHE_ENABLED: boolean;
  JUPITER_SWAP_ENABLED: boolean;
  WALLET_CONNECT_ENABLED: boolean;
}

/**
 * Hook to fetch client-safe feature flags from API
 */
export function useFeatureFlags(): {
  flags: ClientFeatureFlags | null;
  loading: boolean;
  error: string | null;
} {
  const [flags, setFlags] = useState<ClientFeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const fetchFlags = async () => {
      try {
        const response = await fetch("/api/features");
        const data = await response.json();
        if (data.success && data.response) {
          setFlags(data.response);
        } else {
          // Defaults if API fails
          setFlags({
            LOCAL_CACHE_ENABLED: true,
            JUPITER_SWAP_ENABLED: false,
            WALLET_CONNECT_ENABLED: true,
          });
        }
      } catch (err: any) {
        // Defaults on error
        setFlags({
          LOCAL_CACHE_ENABLED: true,
          JUPITER_SWAP_ENABLED: false,
          WALLET_CONNECT_ENABLED: true,
        });
        setError(err.message || "Failed to fetch feature flags");
      } finally {
        setLoading(false);
      }
    };

    fetchFlags();
  }, []);

  return { flags, loading, error };
}
