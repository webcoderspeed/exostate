import { describe, it, expect } from "vitest"
import * as exostate from "../src/index.js"
import * as reactAdapter from "../src/react/index.js"
import * as reactQuery from "../src/react/query.js"
import * as svelteAdapter from "../src/svelte/index.js"

/**
 * Guards the documented surface. Every name here is promised by the README's
 * API reference, so removing or renaming one is a breaking change that should
 * fail loudly rather than silently rot the docs.
 */
const CORE_EXPORTS = [
  // core
  "createStore", "StoreImpl", "createState", "defineStore",
  "storeFactory", "cachedStoreFactory", "combineStores",
  "computed", "derive", "shallow", "deepEqual",
  // query
  "QueryClient", "createMutation", "hashQueryKey",
  // persistence / integrity
  "persistLocal", "persistIndexedDB", "createHistory", "beginTransaction",
  "createEventSource", "createSerializer", "dehydrate", "rehydrate",
  // plugins / observability
  "withMiddleware", "logger", "freeze", "registerPlugin", "getPlugins",
  "destroyPlugins", "devtoolsMiddleware", "connectReduxDevTools",
  // errors / validation
  "SafeError", "createError", "isSafeError", "toSafeError", "applyPolicy",
  "fromZod", "fromPredicate",
  // async
  "asyncAction",
] as const

const STORE_METHODS = [
  "read", "snapshot", "patch", "set", "update", "compute", "batch",
  "effect", "subscribe", "use", "plugins", "flush", "destroy",
] as const

const QUERY_CLIENT_METHODS = [
  "watch", "fetchQuery", "prefetchQuery", "getQueryData", "setQueryData",
  "getQueryState", "invalidateQueries", "refetchQueries", "cancelQueries",
  "removeQueries", "dehydrate", "hydrate", "size", "clear",
] as const

describe("public API surface", () => {
  it.each(CORE_EXPORTS)("exports %s from the core entry", (name) => {
    expect(exostate[name as keyof typeof exostate]).toBeDefined()
  })

  it.each(STORE_METHODS)("store exposes %s", (method) => {
    const store = exostate.createStore({ n: 0 })
    expect(typeof store[method as keyof typeof store]).toBe("function")
  })

  it("store exposes version and destroyed", () => {
    const store = exostate.createStore({ n: 0 })
    expect(typeof store.version).toBe("number")
    expect(typeof store.destroyed).toBe("boolean")
  })

  it.each(QUERY_CLIENT_METHODS)("QueryClient exposes %s", (method) => {
    const client = new exostate.QueryClient()
    expect(typeof client[method as keyof exostate.QueryClient]).toBe("function")
    client.clear()
  })

  it("does not leak node-only filesystem persistence into the core entry", () => {
    // persistFs must stay behind `exostate/node`, or bundlers pull in node:fs.
    expect("persistFs" in exostate).toBe(false)
  })

  it("exports the documented React hooks", () => {
    for (const hook of ["useStore", "useSelector", "useStores", "useCombined", "useStoresSelector"]) {
      expect(typeof reactAdapter[hook as keyof typeof reactAdapter]).toBe("function")
    }
  })

  it("exports the documented React query hooks", () => {
    for (const name of ["QueryClientProvider", "useQuery", "useMutation", "useQueryClient", "useInvalidateQueries"]) {
      expect(typeof reactQuery[name as keyof typeof reactQuery]).toBe("function")
    }
  })

  it("exports the documented Svelte adapters", () => {
    expect(typeof svelteAdapter.exostore).toBe("function")
    expect(typeof svelteAdapter.exoselector).toBe("function")
  })
})

describe("README examples still work", () => {
  it("quick start: patch, update and scoped subscribe", () => {
    interface CartState {
      items: Array<{ id: string; qty: number }>
      coupon: string | null
    }
    const cart = exostate.createStore<CartState>({ items: [], coupon: null })

    cart.patch({ coupon: "SUMMER25" })
    cart.patch(prev => ({ items: [...prev.items, { id: "sku-1", qty: 1 }] }))

    const addItem = (prev: CartState, item: { id: string; qty: number }) => ({
      ...prev,
      items: [...prev.items, item],
    })
    cart.update(addItem, { id: "sku-2", qty: 3 })

    const seen: number[] = []
    const unsubscribe = cart.subscribe(s => s.items.length, n => seen.push(n))
    cart.patch(prev => ({ items: [...prev.items, { id: "sku-3", qty: 1 }] }))
    unsubscribe()

    expect(cart.read().coupon).toBe("SUMMER25")
    expect(cart.read().items).toHaveLength(3)
    expect(seen).toEqual([3])
  })

  it("batch produces a single notification", () => {
    const store = exostate.createStore({ count: 1 })
    let calls = 0
    store.subscribe(s => s.count, () => { calls++ })

    store.batch(apply => {
      apply((prev, by: number) => ({ count: prev.count + by }), 1)
      apply((prev, by: number) => ({ count: prev.count * by }), 3)
    })

    expect(store.read().count).toBe(6)
    expect(calls).toBe(1)
  })

  it("transaction stages changes and seals after commit", () => {
    const store = exostate.createStore({ total: 0 })
    const tx = exostate.beginTransaction(store)
    tx.apply((prev, n: number) => ({ total: prev.total + n }), 10)

    expect(store.read().total).toBe(0) // untouched while staged
    tx.commit()
    expect(store.read().total).toBe(10)
    expect(() => tx.commit()).toThrow()
  })

  it("history undo/redo/jumpTo", () => {
    const store = exostate.createStore({ count: 0 })
    const history = exostate.createHistory(store, { limit: 50 })
    history.attach()

    store.patch({ count: 1 })
    store.patch({ count: 2 })

    history.undo()
    expect(store.read().count).toBe(1)
    history.redo()
    expect(store.read().count).toBe(2)
    history.jumpTo(0)
    expect(store.read().count).toBe(0)

    history.detach()
  })

  it("defineStore co-locates actions with state", () => {
    const counter = exostate.defineStore<{
      count: number
      increment: () => void
      reset: () => void
    }>((set) => ({
      count: 0,
      increment: () => set(s => ({ ...s, count: s.count + 1 })),
      reset: () => set({ count: 0 }),
    }))

    counter.read().increment()
    counter.read().increment()
    expect(counter.read().count).toBe(2)
    counter.read().reset()
    expect(counter.read().count).toBe(0)
  })

  it("cachedStoreFactory returns one instance per key", () => {
    const stores = exostate.cachedStoreFactory((userId: string) => ({ id: userId, name: "" }))
    expect(stores.get("u1")).toBe(stores.get("u1"))
    expect(stores.get("u1")).not.toBe(stores.get("u2"))
    stores.delete("u1")
    expect(stores.has("u1")).toBe(false)
  })

  it("createError produces a named SafeError", () => {
    const err = exostate.createError("NOT_FOUND", "User does not exist", { id: 42 })
    expect(err.name).toBe("SafeError")
    expect(err.code).toBe("NOT_FOUND")
    expect(err.details).toEqual({ id: 42 })
    expect(exostate.isSafeError(err)).toBe(true)
  })

  it("createSerializer migrates across versions and rejects future ones", () => {
    interface V3 { count: number; theme: string; locale: string }
    const serializer = exostate.createSerializer<V3>(3, {
      validate: (x): x is V3 => typeof x === "object" && x !== null,
      migrations: {
        1: (v1) => ({ ...(v1 as object), theme: "light" }),
        2: (v2) => ({ ...(v2 as object), locale: "en" }),
      },
    })

    const fromV1 = serializer.decode(JSON.stringify({ v: 1, data: { count: 5 } }))
    expect(fromV1).toEqual({ count: 5, theme: "light", locale: "en" })

    expect(() => serializer.decode(JSON.stringify({ v: 9, data: {} }))).toThrow()
  })
})
