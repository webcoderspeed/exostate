import { describe, it, expect } from "vitest"
import { createStore, withMiddleware } from "../src"

type S = { count: number; label: string }

describe("middleware API for logging/metrics", () => {
  it("before/after fire around set/update/compute/batch", () => {
    const store = createStore<S>({ count: 0, label: "a" })
    const calls: Array<{ op: string; when: "before" | "after"; version: number; duration?: number }> = []
    const mw = {
      before(op: "set" | "update" | "compute" | "batch" | "effect", ctx: { version: number }) {
        calls.push({ op, when: "before", version: ctx.version })
      },
      after(op: "set" | "update" | "compute" | "batch" | "effect", ctx: { version: number; durationMs: number }) {
        calls.push({ op, when: "after", version: ctx.version, duration: ctx.durationMs })
      }
    }
    const wrapped = withMiddleware(store, [mw])
    wrapped.set({ count: 1, label: "b" })
    wrapped.update((p, d: number) => ({ ...p, count: p.count + d }), 2)
    wrapped.compute(p => ({ ...p, count: p.count * 2 }))
    wrapped.batch(apply => {
      apply((p, d: number) => ({ ...p, count: p.count + d }), 1)
      apply((p, d: number) => ({ ...p, count: p.count + d }), 1)
    })
    expect(calls.filter(c => c.when === "before").length).toBe(4)
    expect(calls.filter(c => c.when === "after").length).toBe(4)
    for (const c of calls.filter(c => c.when === "after")) {
      expect(typeof c.duration).toBe("number")
    }
    expect(wrapped.read().count).toBe(8)
  })

  it("effect supports async and after fires post resolution", async () => {
    const store = createStore<S>({ count: 0, label: "a" })
    const calls: Array<{ op: string; when: "before" | "after" }> = []
    const mw = {
      before(op: "set" | "update" | "compute" | "batch" | "effect") { calls.push({ op, when: "before" }) },
      after(op: "set" | "update" | "compute" | "batch" | "effect") { calls.push({ op, when: "after" }) },
    }
    const wrapped = withMiddleware(store, [mw])
    const effect = (snap: Readonly<S>, delay: number) => new Promise<void>(resolve => setTimeout(resolve, delay))
    const p = wrapped.effect(effect, 10)
    if (p instanceof Promise) await p
    expect(calls.map(c => c.when)).toEqual(["before", "after"])
  })
})
