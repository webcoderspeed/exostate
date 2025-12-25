import { describe, it, expect } from "vitest"
import { createSerializer } from "../src"

type V2 = { count: number; label: string }

function isV2(x: unknown): x is V2 {
  return typeof x === "object" && x !== null &&
    typeof (x as Record<string, unknown>)["count"] === "number" &&
    typeof (x as Record<string, unknown>)["label"] === "string"
}

function isV1(x: unknown): x is { count: number } {
  return typeof x === "object" && x !== null &&
    typeof (x as Record<string, unknown>)["count"] === "number"
}

describe("serialization with migrations", () => {
  it("encodes version and decodes same version", () => {
    const s = createSerializer<V2>(2, { validate: isV2 })
    const raw = s.encode({ count: 1, label: "a" })
    const out = s.decode(raw)
    expect(out).toEqual({ count: 1, label: "a" })
  })

  it("migrates from v1 to v2 using step migration", () => {
    const s = createSerializer<V2>(2, {
      validate: isV2,
      migrations: {
        1: (input: unknown) => {
          if (!isV1(input)) throw new Error("bad v1")
          return { count: input.count, label: "" }
        }
      }
    })
    const raw = JSON.stringify({ v: 1, data: { count: 5 } })
    const out = s.decode(raw)
    expect(out).toEqual({ count: 5, label: "" })
  })

  it("throws on missing migration", () => {
    const s = createSerializer<V2>(2, { validate: isV2 })
    const raw = JSON.stringify({ v: 1, data: { count: 5 } })
    expect(() => s.decode(raw)).toThrow()
  })

  it("throws on invalid payload", () => {
    const s = createSerializer<V2>(2, { validate: isV2 })
    const raw = JSON.stringify({ data: { count: 5 } })
    expect(() => s.decode(raw)).toThrow()
  })

  it("throws on future version", () => {
    const s = createSerializer<V2>(2, { validate: isV2 })
    const raw = JSON.stringify({ v: 3, data: { count: 5, label: "" } })
    expect(() => s.decode(raw)).toThrow()
  })
})

