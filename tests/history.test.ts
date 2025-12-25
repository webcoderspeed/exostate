import { describe, it, expect } from "vitest"
import { createStore } from "../src"
import { createHistory } from "../src"

type S = { count: number; label: string }

describe("history utilities", () => {
  it("manual record, undo, redo", () => {
    const store = createStore<S>({ count: 0, label: "a" })
    const history = createHistory(store, { limit: 10, recordInitial: true })
    store.set({ count: 1, label: "b" })
    history.record()
    store.set({ count: 2, label: "c" })
    history.record()
    expect(history.size()).toBe(3)
    expect(store.read().count).toBe(2)
    history.undo()
    expect(store.read().count).toBe(1)
    history.undo()
    expect(store.read().count).toBe(0)
    expect(history.canUndo()).toBe(false)
    history.redo()
    expect(store.read().count).toBe(1)
    history.redo()
    expect(store.read().count).toBe(2)
    expect(history.canRedo()).toBe(false)
  })

  it("attach records on notifications and truncates redo on new record", () => {
    const store = createStore<S>({ count: 0, label: "a" })
    const history = createHistory(store, { limit: 10, recordInitial: true })
    history.attach()
    store.update((p, d: number) => ({ ...p, count: p.count + d }), 1)
    store.update((p, d: number) => ({ ...p, count: p.count + d }), 1)
    expect(history.size()).toBe(3)
    history.undo()
    history.undo()
    expect(store.read().count).toBe(0)
    store.update((p, d: number) => ({ ...p, count: p.count + d }), 5)
    expect(history.size()).toBe(2)
    expect(store.read().count).toBe(5)
    expect(history.canRedo()).toBe(false)
    history.detach()
  })

  it("jumpTo moves pointer and sets store state", () => {
    const store = createStore<S>({ count: 0, label: "a" })
    const history = createHistory(store, { limit: 10, recordInitial: true })
    store.set({ count: 3, label: "x" })
    history.record()
    store.set({ count: 6, label: "y" })
    history.record()
    const res = history.jumpTo(0)
    expect(res?.count).toBe(0)
    expect(history.pointer()).toBe(0)
    const res2 = history.jumpTo(1)
    expect(res2?.count).toBe(3)
    expect(history.pointer()).toBe(1)
  })
})

