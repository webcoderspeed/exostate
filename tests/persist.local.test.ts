import { describe, it, expect } from "vitest"
import { createStore } from "../src"
import { persistLocal } from "../src"

type S = { count: number; label: string }

class MemoryStorage {
  private map = new Map<string, string>()
  getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null }
  setItem(key: string, value: string) { this.map.set(key, value) }
  removeItem(key: string) { this.map.delete(key) }
}

describe("persistLocal", () => {
  it("loads initial from storage and writes on updates", () => {
    const store = createStore<S>({ count: 0, label: "a" })
    const storage = new MemoryStorage()
    storage.setItem("ex/1", JSON.stringify({ count: 10, label: "seed" }))
    
    const ctrl = persistLocal(store, "ex/1", storage, { loadInitial: true })
    expect(store.read()).toEqual({ count: 10, label: "seed" })
    
    store.update((p, d: number) => ({ ...p, count: p.count + d }), 5)
    const raw = storage.getItem("ex/1")
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!)).toEqual({ count: 15, label: "seed" })
    
    ctrl.detach()
    store.update((p, d: number) => ({ ...p, count: p.count + d }), 5)
    const raw2 = storage.getItem("ex/1")
    expect(JSON.parse(raw2!)).toEqual({ count: 15, label: "seed" })
  })
})

