import { describe, it, expect } from "vitest"
import { createError, isSafeError, toSafeError, applyPolicy } from "../src"

describe("typed error policy and safe errors", () => {
  it("creates and identifies SafeError", () => {
    const err = createError("bad_input", "Invalid payload", { field: "count" })
    expect(isSafeError(err)).toBe(true)
    expect(err.code).toBe("bad_input")
    expect(err.message).toBe("Invalid payload")
  })

  it("converts unknown to SafeError with fallback code", () => {
    const err1 = toSafeError(new Error("boom"), "internal")
    expect(isSafeError(err1)).toBe(true)
    expect(err1.code).toBe("internal")
    const err2 = toSafeError("oops")
    expect(err2.code).toBe("unknown")
  })

  it("applies error policy mapping", () => {
    const policy = {
      map(code: string, err: ReturnType<typeof createError>) {
        if (code === "internal") return createError("internal_masked", "Something went wrong")
        return err
      }
    }
    const err = toSafeError(new Error("x"), "internal")
    const out = applyPolicy(err, policy)
    expect(out.code).toBe("internal_masked")
  })
})
