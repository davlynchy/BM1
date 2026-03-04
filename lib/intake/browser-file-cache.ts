"use client";

const DB_NAME = "bidmetric-intake";
const STORE_NAME = "files";
const DB_VERSION = 1;

type CachedIntakeFile = {
  sessionId: string;
  file: File;
  createdAt: number;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "sessionId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open upload cache."));
  });
}

async function withStore<T>(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = callback(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Upload cache request failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("Upload cache transaction failed."));
  });
}

export async function saveIntakeFile(sessionId: string, file: File) {
  await withStore("readwrite", (store) =>
    store.put({
      sessionId,
      file,
      createdAt: Date.now(),
    } satisfies CachedIntakeFile),
  );
}

export async function getIntakeFile(sessionId: string) {
  const cached = await withStore<CachedIntakeFile | undefined>("readonly", (store) =>
    store.get(sessionId),
  );

  return cached?.file ?? null;
}

export async function clearIntakeFile(sessionId: string) {
  await withStore("readwrite", (store) => store.delete(sessionId));
}
