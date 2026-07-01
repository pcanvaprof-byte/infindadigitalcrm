import { proxyFetchExternal } from "./proxy.functions";

// Wraps external HTTP calls through a server function so the preview iframe's
// fetch proxy (which blocks/rewrites some cross-origin requests) can't break
// enrichment. Returns a Response-like object with .ok/.status/.json()/.text().
export async function pfetch(url: string): Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}> {
  const res = await proxyFetchExternal({ data: { url } });
  const body = res.body ?? "";
  return {
    ok: res.ok,
    status: res.status,
    json: async () => (body ? JSON.parse(body) : null),
    text: async () => body,
  };
}
