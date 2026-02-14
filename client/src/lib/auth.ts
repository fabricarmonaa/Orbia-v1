import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { parseApiError } from "@/lib/api-errors";

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
  tenantId: number | null;
  isSuperAdmin: boolean;
  branchId: number | null;
  subscriptionWarning?: string | null;
}

let currentUser: AuthUser | null = null;
let currentToken: string | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

function loadFromStorage() {
  const token = localStorage.getItem("orbia_token");
  const userStr = localStorage.getItem("orbia_user");
  if (token && userStr) {
    try {
      currentUser = JSON.parse(userStr);
      currentToken = token;
    } catch {
      currentUser = null;
      currentToken = null;
    }
  }
}

loadFromStorage();

export function login(token: string, user: AuthUser) {
  localStorage.setItem("orbia_token", token);
  localStorage.setItem("orbia_user", JSON.stringify(user));
  currentUser = user;
  currentToken = token;
  notifyListeners();
}

export function logout() {
  localStorage.removeItem("orbia_token");
  localStorage.removeItem("orbia_user");
  currentUser = null;
  currentToken = null;
  notifyListeners();
}

export function getToken(): string | null {
  return currentToken;
}

export function getUser(): AuthUser | null {
  return currentUser;
}

export function useAuth() {
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);

  const getSnapshot = useCallback(() => ({
    user: currentUser,
    token: currentToken,
    isAuthenticated: !!currentToken && !!currentUser,
  }), []);

  const [state, setState] = useState(getSnapshot);

  useEffect(() => {
    const unsub = subscribe(() => {
      setState({
        user: currentUser,
        token: currentToken,
        isAuthenticated: !!currentToken && !!currentUser,
      });
    });
    return unsub;
  }, [subscribe]);

  return { ...state, login, logout };
}

export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (options.body && typeof options.body === "string") {
    headers["Content-Type"] = "application/json";
  }
  return fetch(url, { ...options, headers });
}

export async function apiRequest(method: string, url: string, data?: unknown): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const info = await parseApiError(res);
    throw new Error(info.message);
  }
  return res;
}
