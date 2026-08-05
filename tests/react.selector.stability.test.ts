import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, act, cleanup } from "@testing-library/react"
import React from "react"
import { createStore, shallow } from "../src/index.js"
import { useSelector } from "../src/react/index.js"

afterEach(cleanup)

const span = (testid: string, text: string) =>
  React.createElement("span", { "data-testid": testid }, text)

describe("useSelector stability", () => {
  it("survives an inline selector that allocates a new object each call", () => {
    const store = createStore({ a: 1, b: 2, unrelated: 0 })
    let renders = 0

    function View() {
      renders++
      // The classic footgun: a fresh object every call. With an uncached
      // getSnapshot this trips React's "getSnapshot should be cached to avoid
      // an infinite loop" error.
      const slice = useSelector(store, s => ({ a: s.a, b: s.b }))
      return span("out", `${slice.a}-${slice.b}`)
    }

    render(React.createElement(View))
    expect(screen.getByTestId("out").textContent).toBe("1-2")

    const rendersAfterMount = renders
    act(() => { store.patch({ unrelated: 99 }) })

    // The guarantee is that render count stays bounded. Under the default
    // `Object.is` comparator the freshly allocated slice still counts as a
    // change, so exactly one re-render is expected — not the unbounded cascade
    // an uncached getSnapshot would produce.
    expect(renders).toBe(rendersAfterMount + 1)
    expect(screen.getByTestId("out").textContent).toBe("1-2")
  })

  it("skips the re-render entirely when compared with shallow", () => {
    const store = createStore({ a: 1, b: 2, unrelated: 0 })
    let renders = 0

    function View() {
      renders++
      const slice = useSelector(
        store,
        s => ({ a: s.a, b: s.b }),
        shallow as (x: { a: number; b: number }, y: { a: number; b: number }) => boolean
      )
      return span("out", `${slice.a}-${slice.b}`)
    }

    render(React.createElement(View))
    const rendersAfterMount = renders

    act(() => { store.patch({ unrelated: 99 }) })

    expect(renders).toBe(rendersAfterMount)
    expect(screen.getByTestId("out").textContent).toBe("1-2")
  })

  it("re-renders when the selected slice actually changes", () => {
    const store = createStore({ a: 1, b: 2 })

    function View() {
      const slice = useSelector(store, s => ({ a: s.a }), shallow as (x: { a: number }, y: { a: number }) => boolean)
      return span("out", String(slice.a))
    }

    render(React.createElement(View))
    expect(screen.getByTestId("out").textContent).toBe("1")

    act(() => { store.patch({ a: 5 }) })
    expect(screen.getByTestId("out").textContent).toBe("5")
  })

  it("does not resubscribe on every render when the selector is inline", () => {
    const store = createStore({ n: 0, other: 0 })
    const subscribeSpy = vi.spyOn(store, "subscribe")

    function View() {
      const n = useSelector(store, s => s.n)
      return span("out", String(n))
    }

    render(React.createElement(View))
    const afterMount = subscribeSpy.mock.calls.length

    act(() => { store.patch({ n: 1 }) })
    act(() => { store.patch({ n: 2 }) })

    // A new selector identity per render must not tear down the subscription.
    expect(subscribeSpy.mock.calls.length).toBe(afterMount)
    expect(screen.getByTestId("out").textContent).toBe("2")
    subscribeSpy.mockRestore()
  })

  it("keeps a stable reference for an equal slice across store versions", () => {
    const store = createStore({ a: 1, tick: 0 })
    const seen: Array<{ a: number }> = []

    function View() {
      const slice = useSelector(store, s => ({ a: s.a }), shallow as (x: { a: number }, y: { a: number }) => boolean)
      seen.push(slice)
      return span("out", String(slice.a))
    }

    render(React.createElement(View))
    act(() => { store.patch({ tick: 1 }) })
    act(() => { store.patch({ tick: 2 }) })

    // Every render observed the same object identity, so memo/effect deps
    // downstream stay stable.
    for (const s of seen) expect(s).toBe(seen[0])
  })
})
