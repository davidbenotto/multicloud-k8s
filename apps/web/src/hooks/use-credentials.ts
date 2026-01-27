"use client";

import { useState, useEffect, useCallback } from "react";
import {
  credentialApi,
  type CredentialStatus,
  type ConnectCredentialsInput,
} from "@/lib/api";

interface UseCredentialsReturn {
  status: CredentialStatus | null;
  loading: boolean;
  error: string | null;
  checkStatus: (provider: string) => Promise<void>;
  connect: (
    provider: string,
    credentials: ConnectCredentialsInput,
  ) => Promise<void>;
  disconnect: (provider: string) => Promise<void>;
}

export function useCredentials(initialProvider?: string): UseCredentialsReturn {
  const [status, setStatus] = useState<CredentialStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async (provider: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await credentialApi.getStatus(provider);
      setStatus(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to check credentials",
      );
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialProvider) {
      checkStatus(initialProvider);
    }
  }, [initialProvider, checkStatus]);

  const connect = useCallback(
    async (provider: string, credentials: ConnectCredentialsInput) => {
      try {
        setLoading(true);
        setError(null);
        await credentialApi.connect(provider, credentials);
        await checkStatus(provider);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to connect");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [checkStatus],
  );

  const disconnect = useCallback(
    async (provider: string) => {
      try {
        setLoading(true);
        setError(null);
        await credentialApi.disconnect(provider);
        await checkStatus(provider);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to disconnect");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [checkStatus],
  );

  return {
    status,
    loading,
    error,
    checkStatus,
    connect,
    disconnect,
  };
}
