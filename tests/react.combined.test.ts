import { describe, it, expect } from "vitest"
import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { createStore } from "../src"
import { useStores } from "../src/react"

type A = { a: number }
type B = { b: string }

function View({ sa, sb }: { sa: ReturnType<typeof createStore<A>>; sb: ReturnType<typeof createStore<B>> }) {
  const combined = useStores<{ sa: A; sb: B }>({ sa, sb })
  return React.createElement("div", null,
    React.createElement("span", { "data-testid": "a" }, String(combined.sa.a)),
    React.createElement("span", { "data-testid": "b" }, combined.sb.b),
  )
}

describe("useCombined react hook", () => {
  it("renders and updates when any store changes", async () => {
    const sa = createStore<A>({ a: 1 })
    const sb = createStore<B>({ b: "x" })
    render(React.createElement(View, { sa, sb }))
    expect(screen.getByTestId("a").textContent).toBe("1")
    expect(screen.getByTestId("b").textContent).toBe("x")
    sa.update((p, d: number) => ({ a: p.a + d }), 1)
    await waitFor(() => {
      expect(screen.getByTestId("a").textContent).toBe("2")
    })
    sb.set({ b: "y" })
    await waitFor(() => {
      expect(screen.getByTestId("b").textContent).toBe("y")
    })
  })
})
