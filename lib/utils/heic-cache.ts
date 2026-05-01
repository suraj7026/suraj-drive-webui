/**
 * Two-tier cache for decoded HEIC -> JPEG blobs.
 *
 * Tier 1: in-memory Map for instant hits within the current session.
 * Tier 2: IndexedDB so decodes survive page reloads / tab restarts.
 *
 * Cache keys are stable MinIO object keys (e.g. "photos/2024/img.heic"),
 * NOT presigned URLs (which rotate every 15 minutes).
 */

const DB_NAME = "suraj-drive-heic-cache";
const DB_VERSION = 1;
const STORE_NAME = "decoded";
const MAX_CACHE_BYTES = 200 * 1024 * 1024; // 200 MB

type CachedEntry = {
  key: string;
  blob: Blob;
  size: number;
  updatedAt: number;
};

const memoryCache = new Map<string, Blob>();

let dbPromise: Promise<IDBDatabase | null> | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase | null> {
  if (!isBrowser()) {
    return Promise.resolve(null);
  }
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | null
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        let tx: IDBTransaction;
        try {
          tx = db.transaction(STORE_NAME, mode);
        } catch {
          resolve(null);
          return;
        }
        const store = tx.objectStore(STORE_NAME);
        const request = fn(store);
        if (!request) {
          tx.oncomplete = () => resolve(null);
          tx.onerror = () => resolve(null);
          tx.onabort = () => resolve(null);
          return;
        }
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => resolve(null);
      })
  );
}

export async function getCachedHeicJpeg(objectKey: string): Promise<Blob | null> {
  if (!objectKey) return null;

  const inMemory = memoryCache.get(objectKey);
  if (inMemory) return inMemory;

  const entry = await withStore<CachedEntry>("readonly", (store) =>
    store.get(objectKey) as IDBRequest<CachedEntry>
  );

  if (!entry || !entry.blob) return null;

  memoryCache.set(objectKey, entry.blob);
  // Touch updatedAt so LRU eviction reflects recent reads.
  void withStore<IDBValidKey>("readwrite", (store) =>
    store.put({ ...entry, updatedAt: Date.now() })
  );
  return entry.blob;
}

export async function cacheHeicJpeg(
  objectKey: string,
  jpegBlob: Blob
): Promise<void> {
  if (!objectKey || !jpegBlob) return;

  memoryCache.set(objectKey, jpegBlob);

  const entry: CachedEntry = {
    key: objectKey,
    blob: jpegBlob,
    size: jpegBlob.size,
    updatedAt: Date.now(),
  };

  await withStore<IDBValidKey>("readwrite", (store) => store.put(entry));
  await evictIfNeeded();
}

async function evictIfNeeded(): Promise<void> {
  const entries = await withStore<CachedEntry[]>("readonly", (store) => {
    const req = store.getAll() as IDBRequest<CachedEntry[]>;
    return req;
  });

  if (!entries || entries.length === 0) return;

  let total = entries.reduce((sum, e) => sum + (e.size ?? 0), 0);
  if (total <= MAX_CACHE_BYTES) return;

  const sorted = entries
    .slice()
    .sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));

  for (const entry of sorted) {
    if (total <= MAX_CACHE_BYTES) break;
    await withStore<undefined>("readwrite", (store) =>
      store.delete(entry.key) as IDBRequest<undefined>
    );
    memoryCache.delete(entry.key);
    total -= entry.size ?? 0;
  }
}
