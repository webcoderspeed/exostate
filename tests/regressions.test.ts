import { describe, it, expect, vi } from "vitest"
import { createStore, combineStores, withMiddleware, shallow, deepEqual } from "../src/index.js"
import { asyncAction } from "../src/async-action.js"
import type { StoreImpl } from "../src/store.js"

const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms))

describe("combineStores: read without an active subscription", () => {
  it("returns fresh child state when never subscribed", () => {
    const a = createStore({ n: 1 })
    const combined = combineStores({ a })

    a.set({ n: 2 })

    // Previously `current` was frozen at construction time because nothing was
    // attached to the child stores.
    expect(combined.read()).toEqual({ a: { n: 2 } })
  })

  it("catches up on changes that happened while detached", () => {
    const a = createStore({ n: 1 })
    const combined = combineStores({ a })

    const unsub = combined.subscribe(() => {})
    a.set({ n: 2 })
    unsub() // last subscriber leaves -> detaches from child stores

    a.set({ n: 3 }) // changes while nobody is attached

    const seen: Array<{ a: { n: number } }> = []
    combined.subscribe(s => { seen.push(s as { a: { n: number } }) }, { fireImmediately: true })

    expect(seen[0]).toEqual({ a: { n: 3 } })
  })

  it("does not notify when a child commits an identical snapshot", () => {
    const a = createStore({ n: 1 })
    const combined = combineStores({ a })
    let calls = 0
    combined.subscribe(() => { calls++ })

    const same = a.read()
    a.set(same as { n: number }) // same reference committed again

    expect(calls).toBe(0)
  })
})

describe("asyncAction: concurrent invocations", () => {
  it("aborting one invocation does not cancel another", async () => {
    const store = createStore({ value: "" })
    const action = asyncAction(store, async (_s, value: string, delay: number) => {
      await tick(delay)
      return { value }
    })

    const first = action("first", 50)
    const second = action("second", 10)
    first.abort() // must only cancel `first`

    await second
    await tick(80)

    expect(store.read().value).toBe("second")
  })

  it("discards a slow earlier result in favour of the latest invocation", async () => {
    const store = createStore({ value: "" })
    const action = asyncAction(store, async (_s, value: string, delay: number) => {
      await tick(delay)
      return { value }
    })

    const slow = action("slow", 60)
    const fast = action("fast", 5)

    await fast
    await slow
    // Without latestOnly, the slow request would land last and clobber "fast".
    expect(store.read().value).toBe("fast")
  })

  it("onStart applies before the async work runs", async () => {
    const store = createStore({ loading: false, value: "" })
    const action = asyncAction(store, async () => {
      await tick(10)
      return { value: "done", loading: false }
    }, { onStart: () => ({ loading: true }) })

    const promise = action()
    expect(store.read().loading).toBe(true)
    await promise
    expect(store.read()).toEqual({ loading: false, value: "done" })
  })
})

describe("store: plugin pipeline is actually wired", () => {
  it("fires onBeforeUpdate and onAfterUpdate on every mutation", () => {
    const store = createStore({ n: 0 })
    const before = vi.fn()
    const after = vi.fn()
    store.use({ name: "spy", onBeforeUpdate: before, onAfterUpdate: after })

    store.set({ n: 1 })
    store.patch({ n: 2 })
    store.update((s, p: number) => ({ n: s.n + p }), 1)
    store.compute(s => ({ n: s.n + 1 }))
    store.batch(apply => apply((s, p: number) => ({ n: s.n + p }), 1))

    expect(before).toHaveBeenCalledTimes(5)
    expect(after).toHaveBeenCalledTimes(5)
  })

  it("lets onBeforeUpdate transform the committed value", () => {
    const store = createStore({ n: 0 })
    store.use({
      name: "clamp",
      onBeforeUpdate: (_prev, next) => ({ n: Math.min(next.n, 10) })
    })

    store.set({ n: 999 })
    expect(store.read()).toEqual({ n: 10 })
  })

  it("detaching a plugin stops its hooks", () => {
    const store = createStore({ n: 0 })
    const after = vi.fn()
    const detach = store.use({ name: "spy", onAfterUpdate: after })

    store.set({ n: 1 })
    detach()
    store.set({ n: 2 })

    expect(after).toHaveBeenCalledTimes(1)
  })

  it("destroy fires onDestroy for attached plugins", () => {
    const store = createStore({ n: 0 })
    const onDestroy = vi.fn()
    store.use({ name: "p", onDestroy })
    store.destroy()
    expect(onDestroy).toHaveBeenCalledTimes(1)
  })
})

describe("store: lifecycle hooks", () => {
  it("reports listener counts on subscribe and unsubscribe", () => {
    const events: string[] = []
    const store = createStore({ n: 0 }, {
      onSubscribe: (_s, count) => { events.push(`sub:${count}`) },
      onUnsubscribe: (_s, count) => { events.push(`unsub:${count}`) },
    })

    const a = store.subscribe(s => s.n, () => {})
    const b = store.subscribe(s => s.n, () => {})
    a()
    b()

    expect(events).toEqual(["sub:1", "sub:2", "unsub:1", "unsub:0"])
  })

  it("is idempotent when unsubscribe is called twice", () => {
    const onUnsubscribe = vi.fn()
    const store = createStore({ n: 0 }, { onUnsubscribe })
    const unsub = store.subscribe(s => s.n, () => {})
    unsub()
    unsub()
    expect(onUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it("debounces teardown by unmountDelay so a quick remount keeps resources", async () => {
    const onUnsubscribe = vi.fn()
    const store = createStore({ n: 0 }, { onUnsubscribe, unmountDelay: 30 })

    const first = store.subscribe(s => s.n, () => {})
    first()
    // Remount inside the grace window — teardown must be cancelled.
    const second = store.subscribe(s => s.n, () => {})
    await tick(50)
    expect(onUnsubscribe).not.toHaveBeenCalled()

    second()
    await tick(50)
    expect(onUnsubscribe).toHaveBeenCalledTimes(1)
  })
})

describe("store: microtask batching", () => {
  it("collapses synchronous mutations into one notification", async () => {
    const store = createStore({ n: 0 }, { notify: "microtask" })
    let calls = 0
    store.subscribe(s => s.n, () => { calls++ })

    store.patch({ n: 1 })
    store.patch({ n: 2 })
    store.patch({ n: 3 })

    expect(calls).toBe(0) // nothing delivered yet
    await Promise.resolve()
    expect(calls).toBe(1)
    expect(store.read().n).toBe(3)
  })

  it("sync mode still notifies once per mutation", () => {
    const store = createStore({ n: 0 })
    let calls = 0
    store.subscribe(s => s.n, () => { calls++ })
    store.patch({ n: 1 })
    store.patch({ n: 2 })
    expect(calls).toBe(2)
  })

  it("flush delivers a queued notification immediately", () => {
    const store = createStore({ n: 0 }, { notify: "microtask" })
    let calls = 0
    store.subscribe(s => s.n, () => { calls++ })
    store.patch({ n: 1 })
    store.flush()
    expect(calls).toBe(1)
  })
})

describe("withMiddleware: passthrough completeness", () => {
  it("proxies destroyed, listeners and current", () => {
    const base = createStore({ n: 0 })
    const wrapped = withMiddleware(base, [])

    expect(wrapped.destroyed).toBe(false)
    expect((wrapped as unknown as StoreImpl<{ n: number }>).current).toEqual({ n: 0 })

    wrapped.subscribe(s => s.n, () => {})
    expect((wrapped as unknown as StoreImpl<{ n: number }>).listeners.size).toBe(1)

    wrapped.destroy()
    expect(wrapped.destroyed).toBe(true)
  })

  it("proxies the plugin API onto the wrapped store", () => {
    const base = createStore({ n: 0 })
    const wrapped = withMiddleware(base, [])
    const after = vi.fn()
    wrapped.use({ name: "p", onAfterUpdate: after })

    wrapped.set({ n: 1 })
    expect(after).toHaveBeenCalledTimes(1)
    expect(wrapped.plugins()).toHaveLength(1)
  })
})

describe("equality helpers", () => {
  it("shallow compares one level deep", () => {
    expect(shallow({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
    expect(shallow({ a: 1 }, { a: 2 })).toBe(false)
    expect(shallow({ a: { n: 1 } }, { a: { n: 1 } })).toBe(false) // nested refs differ
    expect(shallow([1, 2], [1, 2])).toBe(true)
    expect(shallow([1, 2], [1, 2, 3])).toBe(false)
    expect(shallow({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })

  it("deepEqual recurses", () => {
    expect(deepEqual({ a: { n: [1, 2] } }, { a: { n: [1, 2] } })).toBe(true)
    expect(deepEqual({ a: { n: [1, 2] } }, { a: { n: [1, 3] } })).toBe(false)
    expect(deepEqual(new Date(5), new Date(5))).toBe(true)
    expect(deepEqual(new Map([["a", 1]]), new Map([["a", 1]]))).toBe(true)
    expect(deepEqual(new Set([1, 2]), new Set([2, 1]))).toBe(true)
  })
})
