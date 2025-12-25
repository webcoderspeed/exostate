import { describe, it, expect } from "vitest"
import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { createStore } from "../src"
import { useStoresSelector } from "../src/react"

type A = { a: number }
type B = { b: string }

function View({ sa, sb }: { sa: ReturnType<typeof createStore<A>>; sb: ReturnType<typeof createStore<B>> }) {
  const derived = useStoresSelector<{ sa: A; sb: B }, string>({ sa, sb }, s => `${s.sa.a}:${s.sb.b}`)
  return React.createElement("div", null,
    React.createElement("span", { "data-testid": "derived" }, derived),
  )
}

describe("useStoresSelector react hook", () => {
  it("renders derived and updates when underlying changes", async () => {
    const sa = createStore<A>({ a: 1 })
    const sb = createStore<B>({ b: "x" })
    render(React.createElement(View, { sa, sb }))
    expect(screen.getByTestId("derived").textContent).toBe("1:x")
    sa.update((p, d: number) => ({ a: p.a + d }), 1)
    await waitFor(() => {
      expect(screen.getByTestId("derived").textContent).toBe("2:x")
    })
    sb.set({ b: "y" })
    await waitFor(() => {
      expect(screen.getByTestId("derived").textContent).toBe("2:y")
    })
  })
})

