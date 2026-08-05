import { describe, it, expect } from "vitest"
import { storeFactory, cachedStoreFactory } from "../src/store-factory"


describe("storeFactory", () => {
  it("creates isolated store instances", () => {
    const createWidgetStore = storeFactory((id: string) => ({
      id,
      items: [] as string[],
      loading: false,
    }))

    const s1 = createWidgetStore("w1")
    const s2 = createWidgetStore("w2")

    expect(s1.read().id).toBe("w1")
    expect(s2.read().id).toBe("w2")

    s1.set({ ...s1.read(), items: ["a"] })
    expect(s1.read().items).toEqual(["a"])
    expect(s2.read().items).toEqual([])
  })

  it("each call creates a new store", () => {
    const create = storeFactory(() => ({ count: 0 }))
    const a = create()
    const b = create()
    expect(a).not.toBe(b)
  })
})

describe("cachedStoreFactory", () => {
  it("returns same store for same key", () => {
    const factory = cachedStoreFactory((id: string) => ({
      id,
      name: "",
    }))

    const s1 = factory.get("user-1")
    const s2 = factory.get("user-1")
    expect(s1).toBe(s2)
  })

  it("returns different stores for different keys", () => {
    const factory = cachedStoreFactory((id: string) => ({ id }))
    const s1 = factory.get("a")
    const s2 = factory.get("b")
    expect(s1).not.toBe(s2)
    expect(s1.read().id).toBe("a")
    expect(s2.read().id).toBe("b")
  })

  it("has/delete/clear/size work correctly", () => {
    const factory = cachedStoreFactory((id: string) => ({ id }))
    factory.get("a")
    factory.get("b")

    expect(factory.has("a")).toBe(true)
    expect(factory.has("c")).toBe(false)
    expect(factory.size).toBe(2)

    factory.delete("a")
    expect(factory.has("a")).toBe(false)
    expect(factory.size).toBe(1)

    factory.clear()
    expect(factory.size).toBe(0)
  })

  it("keys returns all stored keys", () => {
    const factory = cachedStoreFactory((id: string) => ({ id }))
    factory.get("x")
    factory.get("y")
    factory.get("z")

    const keys = [...factory.keys()]
    expect(keys).toEqual(["x", "y", "z"])
  })
})
