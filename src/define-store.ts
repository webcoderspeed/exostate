import { Store, createStore } from "./store.js"

export type StateCreator<T> = (
  set: (partial: Partial<T> | ((prev: T) => T)) => T,
  get: () => T
) => T;

export function defineStore<T>(creator: StateCreator<T>): Store<T> {
  let store: Store<T> | undefined;

  const get = (): T => {
    if (!store) {
      throw new Error("Cannot call get during store initialization");
    }
    return store.read();
  };

  const set = (partial: Partial<T> | ((prev: T) => T)): T => {
    if (!store) {
      throw new Error("Cannot call set during store initialization");
    }
    
    const current = store.read();
    let next: T;
    
    if (typeof partial === "function") {
      next = (partial as (prev: T) => T)(current);
    } else {
      next = { ...current, ...partial } as T;
    }
    
    return store.set(next);
  };

  const initialState = creator(set, get);
  store = createStore(initialState);
  
  return store;
}
