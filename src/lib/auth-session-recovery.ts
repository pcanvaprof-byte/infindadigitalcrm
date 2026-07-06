export function clearStoredAuthSession() {
  if (typeof window === "undefined") return;

  for (const storage of [window.localStorage, window.sessionStorage]) {
    Object.keys(storage)
      .filter((key) => key.startsWith("sb-"))
      .forEach((key) => storage.removeItem(key));
  }

  document.cookie
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .filter((name) => name.startsWith("sb-"))
    .forEach((name) => {
      document.cookie = `${name}=; Max-Age=0; path=/`;
    });
}

function currentRedirectPath() {
  if (typeof window === "undefined") return "/dashboard";
  const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return path.startsWith("/login") ? "/dashboard" : path;
}

export function redirectToLoginForFreshSession() {
  if (typeof window === "undefined") return;

  const url = new URL("/login", window.location.origin);
  url.searchParams.set("redirect", currentRedirectPath());
  url.searchParams.set("reason", "session");
  window.location.replace(`${url.pathname}${url.search}`);
}

export function recoverFromInvalidAuthSession() {
  clearStoredAuthSession();
  redirectToLoginForFreshSession();
}

export function isAuthTokenError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /Unauthorized: Invalid token|JWT|invalid token|Sessão expirada/i.test(message);
}
