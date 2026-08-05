import { describe, it, expect } from "vitest"
import { createStore } from "../src"
import { registerPlugin, getPlugins, destroyPlugins, logger, freeze } from "../src/plugin"

type S = { count: number; label: string }

describe("plugin system", () => {
  it("registers a plugin and fires onInit", () => {
    const store = createStore<S>({ count: 0, label: "a" })
    let initCalled = false
    const plugin = {
      name: "test-plugin",
      onInit() { initCalled = true }
    }
    registerPlugin(store, plugin)
    expect(initCalled).toBe(true)
  })

  it("getPlugins returns registered plugins", () => {
    const store = createStore<S>({ count: 0, label: "a" })
    const p1 = { name: "p1" }
    const p2 = { name: "p2" }
    registerPlugin(store, p1)
    registerPlugin(store, p2)
    const plugins = getPlugins(store)
    expect(plugins).toHaveLength(2)
    expect(plugins[0].name).toBe("p1")
    expect(plugins[1].name).toBe("p2")
  })

  it("unregister removes plugin and calls cleanup", () => {
    const store = createStore<S>({ count: 0, label: "a" })
    let cleaned = false
    const plugin = {
      name: "cleanup-test",
      onInit() { return () => { cleaned = true } }
    }
    const unregister = registerPlugin(store, plugin)
    expect(getPlugins(store)).toHaveLength(1)
    unregister()
    expect(getPlugins(store)).toHaveLength(0)
    expect(cleaned).toBe(true)
  })

  it("destroyPlugins calls onDestroy and cleanup for all", () => {
    const store = createStore<S>({ count: 0, label: "a" })
    let destroyed1 = false
    let destroyed2 = false
    registerPlugin(store, { name: "p1", onDestroy() { destroyed1 = true } })
    registerPlugin(store, { name: "p2", onDestroy() { destroyed2 = true } })
    destroyPlugins(store)
    expect(destroyed1).toBe(true)
    expect(destroyed2).toBe(true)
    expect(getPlugins(store)).toHaveLength(0)
  })

  it("empty store has no plugins", () => {
    const store = createStore<S>({ count: 0, label: "a" })
    expect(getPlugins(store)).toHaveLength(0)
  })
})

describe("built-in plugins", () => {
  it("logger plugin has correct name", () => {
    const plugin = logger({ name: "MyLogger" })
    expect(plugin.name).toBe("MyLogger")
  })

  it("freeze plugin freezes state", () => {
    const plugin = freeze<S>()
    expect(plugin.name).toBe("ExostateFreeze")
    const frozen = plugin.onBeforeUpdate!(
      { count: 0, label: "a" },
      { count: 1, label: "b" }
    ) as S
    expect(frozen).toEqual({ count: 1, label: "b" })
    expect(Object.isFrozen(frozen)).toBe(true)
  })
})
