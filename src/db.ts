function req<T>(r: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
  });
}

export class IDB {
  private dbp: Promise<IDBDatabase>;

  constructor(name: string, stores: string[], version = 1) {
    this.dbp = new Promise((resolve, reject) => {
      const open = indexedDB.open(name, version);
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
    } catch { /* quota / private mode */ }
  }

  async del(name: string, key: string): Promise<void> {
    try {
      await req((await this.store(name, "readwrite")).delete(key));
    } catch { /* noop */ }
  }

  async clear(name: string): Promise<void> {
    try {
      await req((await this.store(name, "readwrite")).clear());
    } catch { /* noop */ }
  }

  async estimateBytes(name: string): Promise<number> {
    try {
      const all = await req<unknown[]>((await this.store(name, "readonly")).getAll());
      return JSON.stringify(all ?? []).length;
    } catch {
      return 0;
    }
  }
}
