/* ============================================================
   Кастомна Vanilla JS обгортка над IndexedDB (без бібліотек)
   Сховища: chats, settings, models, misc
   ============================================================ */

function req<T>(r: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
  });
}

export class IDB {
  private dbp: Promise<IDBDatabase>;

  constructor(name: string, stores: string[]) {
    this.dbp = new Promise((resolve, reject) => {
      const open = indexedDB.open(name, 1);
      open.onupgradeneeded = () => {
        for (const s of stores) {
          if (!open.result.objectStoreNames.contains(s)) open.result.createObjectStore(s);
        }
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
      open.onblocked = () => reject(new Error("db blocked"));
    });
  }

  private async store(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.dbp;
    return db.transaction(name, mode).objectStore(name);
  }

  async get<T = unknown>(name: string, key: string): Promise<T | undefined> {
    try {
      return await req<T | undefined>((await this.store(name, "readonly")).get(key));
    } catch {
      return undefined;
    }
  }

  async set(name: string, key: string, value: unknown): Promise<void> {
    try {
      await req((await this.store(name, "readwrite")).put(value, key));
    } catch {
      /* ignore quota / private mode */
    }
  }

  async del(name: string, key: string): Promise<void> {
    try {
      await req((await this.store(name, "readwrite")).delete(key));
    } catch {
      /* noop */
    }
  }

  async clear(name: string): Promise<void> {
    try {
      await req((await this.store(name, "readwrite")).clear());
    } catch {
      /* noop */
    }
  }

  async keys(name: string): Promise<IDBValidKey[]> {
    try {
      return await req<IDBValidKey[]>((await this.store(name, "readonly")).getAllKeys());
    } catch {
      return [];
    }
  }

  /** Приблизний об'єм даних у байтах (JSON-серіалізація) */
  async estimateBytes(name: string): Promise<number> {
    try {
      const store = await this.store(name, "readonly");
      const all = await req<unknown[]>(store.getAll());
      return JSON.stringify(all ?? []).length;
    } catch {
      return 0;
    }
  }
}
