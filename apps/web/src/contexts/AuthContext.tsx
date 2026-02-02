"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SessionInfo {
  organizationId: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  cloudProvider: string;
  cloudIdentity: string;
  isAdmin: boolean;
}

interface AuthContextType {
  session: SessionInfo | null;
  loading: boolean;
  login: (sessionToken: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Load session on mount
  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    const token = localStorage.getItem("cloud_session_token");

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("http://localhost:3333/auth/session", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Invalid session");
      }

      const data = await response.json();
      setSession(data.session);
    } catch (error) {
      // Invalid session, clear token
      localStorage.removeItem("cloud_session_token");
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (sessionToken: string) => {
    localStorage.setItem("cloud_session_token", sessionToken);
    await loadSession();
  };

  const logout = async () => {
    const token = localStorage.getItem("cloud_session_token");

    if (token) {
      try {
        await fetch("http://localhost:3333/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.error("Logout error:", error);
      }
    }

    localStorage.removeItem("cloud_session_token");
    setSession(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        login,
        logout,
        isAuthenticated: !!session,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
