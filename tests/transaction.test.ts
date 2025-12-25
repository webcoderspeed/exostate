import { describe, it, expect } from "vitest"
import { createStore } from "../src"
import { beginTransaction } from "../src"

type S = { count: number; label: string }

describe("transaction scopes with rollback", () => {
  it("commit applies final state and notifies once", () => {
    const store = createStore<S>({ count: 0, label: "a" })
    let notifications = 0
    store.subscribe(s => s.count, () => { notifications += 1 })
    const tx = beginTransaction(store)
    tx.apply((p, d: number) => ({ ...p, count: p.count + d }), 1)
    tx.apply((p, d: number) => ({ ...p, count: p.count + d }), 2)
    tx.compute(p => ({ ...p, count: p.count * 2 }))
    expect(tx.read().count).toBe(6)
    const out = tx.commit()
    expect(out.count).toBe(6)
    expect(store.read().count).toBe(6)
    expect(notifications).toBe(1)
  })

  it("rollback restores initial tx state without affecting store", () => {
    const store = createStore<S>({ count: 5, label: "a" })
    let notifications = 0
    store.subscribe(s => s.count, () => { notifications += 1 })
    const tx = beginTransaction(store)
    tx.apply((p, d: number) => ({ ...p, count: p.count + d }), 10)
    const rolled = tx.rollback()
    expect(rolled.count).toBe(5)
    expect(store.read().count).toBe(5)
    expect(notifications).toBe(0)
  })
})

