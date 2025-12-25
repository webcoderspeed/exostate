import { describe, it, expect } from "vitest"
import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { createStore } from "../src"
import { useStore, useSelector } from "../src/react"

type S = { count: number; label: string }

function View({ store }: { store: ReturnType<typeof createStore<S>> }) {
  const state = useStore(store)
  const count = useSelector(store, s => s.count)
  const label = useSelector(store, s => s.label)
  return React.createElement("div", null,
    React.createElement("span", { "data-testid": "state" }, `${state.label}:${state.count}`),
    React.createElement("span", { "data-testid": "count" }, String(count)),
    React.createElement("span", { "data-testid": "label" }, label),
  )
}

describe("react hooks adapter", () => {
  it("renders and updates on store changes", async () => {
    const store = createStore<S>({ count: 0, label: "a" })
    render(React.createElement(View, { store }))
    expect(screen.getByTestId("state").textContent).toBe("a:0")
    store.set({ count: 1, label: "b" })
    await waitFor(() => {
      expect(screen.getByTestId("state").textContent).toBe("b:1")
    })
    store.update((p, d: number) => ({ ...p, count: p.count + d }), 2)
    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("3")
    })
    store.compute(p => ({ ...p, label: "c" }))
    await waitFor(() => {
      expect(screen.getByTestId("label").textContent).toBe("c")
    })
  })
})
