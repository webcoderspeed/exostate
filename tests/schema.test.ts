import { describe, it, expect } from "vitest"
import { fromPredicate, fromZod } from "../src"
import { z } from "zod"

type S = { count: number; label: string }

function isS(x: unknown): x is S {
  return typeof x === "object" && x !== null &&
    typeof (x as Record<string, unknown>)["count"] === "number" &&
    typeof (x as Record<string, unknown>)["label"] === "string"
}

describe("schema validation integration", () => {
  it("validates using predicate-based schema", () => {
    const schema = fromPredicate<S>(isS)
    const out = schema.parse({ count: 1, label: "a" })
    expect(out).toEqual({ count: 1, label: "a" })
    expect(() => schema.parse({ count: "x", label: "a" })).toThrow()
  })

  it("wraps real zod schema via fromZod", () => {
    const Z = z.object({ count: z.number(), label: z.string() })
    const schema = fromZod<S>(Z)
    const out = schema.parse({ count: 2, label: "b" })
    expect(out).toEqual({ count: 2, label: "b" })
  })
})
