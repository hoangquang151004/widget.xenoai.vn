"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";

export type AccountRole = "tenant" | "platform_admin";

interface Tenant {
  id: string;
  name: string;
  email: string;
  plan: "starter" | "pro" | "enterprise" | "enterprise_pro";
  role: AccountRole;
  sales_enabled?: boolean;
  public_key: string | null;
  widget: WidgetConfig;
  ai_settings: AiSettings;
}

interface WidgetConfig {
  bot_name: string;
  primary_color: string;
  logo_url?: string | null;
  greeting: string;
  placeholder: string;
  position: "bottom-right" | "bottom-left";
  show_sources: boolean;
  font_size: string;
  font_family?: string;
  product_layout?: string;
  show_stock?: boolean;
  show_rating?: boolean;
  form_fields?: unknown[];
  payment_methods?: Record<string, unknown>;
  bank_info?: unknown;
  action_mode?: string;
}

interface AiSettings {
  system_prompt: string;
  is_rag_enabled: boolean;
  is_sql_enabled: boolean;
  temperature: number;
  max_tokens: number;
}

interface AuthContextType {
  accessToken: string | null;
  tenant: Tenant | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  /** Tải lại `/admin/me` (sau khi PATCH tenant/widget). */
  refreshTenant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

  const logout = useCallback(() => {
    setAccessToken(null);
    setTenant(null);
    localStorage.removeItem("access_token");
    router.push("/login");
  }, [router]);

  const verifyToken = useCallback(async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/api/v1/admin/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data: Tenant = await response.json();
        setAccessToken(token);
        setTenant(data);
        localStorage.setItem("access_token", token);
        return true;
      } else {
        logout();
        return false;
      }
    } catch (error) {
      console.error("Login verification failed:", error);
      logout();
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [API_URL, logout]);

  const refreshTenant = useCallback(async () => {
    const t = localStorage.getItem("access_token");
    if (t) await verifyToken(t);
  }, [verifyToken]);

  // Check storage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("access_token");
    if (savedToken) {
      verifyToken(savedToken);
    } else {
      setIsLoading(false);
    }
  }, [verifyToken]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        setAccessToken(data.access_token);
        localStorage.setItem("access_token", data.access_token);

        await verifyToken(data.access_token);
        const role = (data.role || "tenant") as AccountRole;
        if (role === "platform_admin") {
          router.push("/admin");
        } else {
          router.push("/dashboard");
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        tenant,
        isLoading,
        login,
        logout,
        refreshTenant,
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
