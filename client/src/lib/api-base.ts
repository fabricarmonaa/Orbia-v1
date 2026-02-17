const rawApiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

function normalizeApiBase(base?: string) {
  if (!base) return "/api";
  const withoutTrailing = base.replace(/\/+$/, "");
  return withoutTrailing.endsWith("/api") ? withoutTrailing : `${withoutTrailing}/api`;
}

export const API_BASE_URL = normalizeApiBase(rawApiBase);

export function withApiBase(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/api")) {
    if (API_BASE_URL === "/api") return path;
    return `${API_BASE_URL}${path.slice(4)}`;
  }
  if (path.startsWith("/")) return `${API_BASE_URL}${path}`;
  return `${API_BASE_URL}/${path}`;
}
