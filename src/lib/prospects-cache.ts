import type { Prospect } from "./mock-prospects";

const DB_NAME = "infinda_crm_offline";
const STORE_NAME = "prospects_cache";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function getCacheKey(userId: string, orgId?: string | null): string {
  return `prospects_${userId}_${orgId || "default"}`;
}

export async function getPersistedProspects(
  userId: string,
  orgId?: string | null,
): Promise<Prospect[] | null> {
  try {
    const db = await openDB();
    if (!db) return null;
    const key = getCacheKey(userId, orgId);
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
          const val = req.result;
          if (Array.isArray(val) && val.length > 0) {
            resolve(val as Prospect[]);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

export async function setPersistedProspects(
  userId: string,
  orgId: string | null | undefined,
  data: Prospect[],
): Promise<void> {
  try {
    const db = await openDB();
    if (!db) return;
    const key = getCacheKey(userId, orgId);
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(data, key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch (err) {
    console.warn("Failed to save prospects to IndexedDB", err);
  }
}

export async function clearPersistedProspects(): Promise<void> {
  try {
    const db = await openDB();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // ignore
  }
}
