export function clearStoredAuthSession() {
  if (typeof window === "undefined") return;

  for (const storage of [window.localStorage, window.sessionStorage]) {
    Object.keys(storage)
      .filter((key) => key.startsWith("sb-") || key.toLowerCase().includes("supabase"))
      .forEach((key) => storage.removeItem(key));
  }

  const hosts = [window.location.hostname, `.${window.location.hostname}`, ""];
  document.cookie
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .filter((name) => name.startsWith("sb-") || name.toLowerCase().includes("supabase"))
    .forEach((name) => {
      for (const host of hosts) {
        const domain = host ? `; domain=${host}` : "";
        document.cookie = `${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
      }
    });
}

function currentRedirectPath() {
  if (typeof window === "undefined") return "/dashboard";
  const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return path.startsWith("/login") || path.startsWith("/auth") ? "/dashboard" : path;
}

export function redirectToAuthForFreshSession() {
  if (typeof window === "undefined") return;

  const url = new URL("/auth", window.location.origin);
  url.searchParams.set("redirect", currentRedirectPath());
  url.searchParams.set("reason", "session");
  window.location.replace(`${url.pathname}${url.search}`);
}

export const redirectToLoginForFreshSession = redirectToAuthForFreshSession;

export function recoverFromInvalidAuthSession() {
  clearStoredAuthSession();
}

export function isAuthTokenError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /Unauthorized: Invalid token|JWT|invalid token|Sessão expirada/i.test(message);
}
