export type StoreListener = (path: string) => void;

export class Store<T extends object> {
  state: T;
  private listeners = new Set<StoreListener>();

  constructor(initial: T) {
    const self = this;
    this.state = new Proxy(initial, {
      set(target, key: string, value) {
        const prev = (target as Record<string, unknown>)[key];
        (target as Record<string, unknown>)[key] = value;
        if (prev !== value) self.emit(key);
        return true;
      },
    });
  }

  on(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  watch(paths: string[], fn: () => void): () => void {
    return this.on((p) => {
      if (paths.includes("*") || paths.includes(p)) fn();
    });
  }

  setDeep<K extends keyof T>(key: K, updater: (value: T[K]) => T[K]): void {
    (this.state as Record<string, unknown>)[key as string] = updater(this.state[key]);
    this.emit(key as string);
  }

  private emit(path: string): void {
    this.listeners.forEach((l) => l(path));
  }
}
