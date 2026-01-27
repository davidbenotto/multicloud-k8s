"use client";

import { useState, useEffect, useCallback } from "react";
import { healthApi, type HealthStatus } from "@/lib/api";

interface UseHealthReturn {
  health: HealthStatus | null;
  isHealthy: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useHealth(): UseHealthReturn {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      const data = await healthApi.check();
      setHealth(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    // Poll every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  return {
    health,
    isHealthy: health?.status === "healthy",
    loading,
    refetch: fetchHealth,
  };
}
