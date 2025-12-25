import { Store } from "./store"
import { DeepReadonly } from "./types"
import { Serializer } from "./serialize"

export function dehydrate<T>(store: Store<T>, serializer?: Serializer<T>): string {
  const snap = store.snapshot() as DeepReadonly<T>
  return serializer ? serializer.encode(snap) : JSON.stringify(snap)
}

export function rehydrate<T>(store: Store<T>, raw: string, serializer?: Serializer<T>): T {
  const next = serializer ? serializer.decode(raw) : (JSON.parse(raw) as T)
  return store.set(next)
}

