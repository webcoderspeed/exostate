import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, waitFor, act, cleanup } from "@testing-library/react"
import React from "react"
import { QueryClient } from "../src/query.js"
import { QueryClientProvider, useQuery, useMutation } from "../src/react/query.js"

afterEach(cleanup)

const withClient = (client: QueryClient, node: React.ReactElement) =>
  React.createElement(QueryClientProvider, { client }, node)

describe("useQuery", () => {
  it("moves from loading to data", async () => {
    const client = new QueryClient()

    function View() {
      const { data, isLoading } = useQuery<string>({
        queryKey: ["greeting"],
        queryFn: async () => "hello",
      })
      return React.createElement("span", { "data-testid": "out" }, isLoading ? "loading" : data)
    }

    render(withClient(client, React.createElement(View)))
    expect(screen.getByTestId("out").textContent).toBe("loading")

    await waitFor(() => {
      expect(screen.getByTestId("out").textContent).toBe("hello")
    })
    client.clear()
  })

  it("shares one request between two components using the same key", async () => {
    const client = new QueryClient()
    const queryFn = vi.fn().mockResolvedValue("shared")

    function View({ id }: { id: string }) {
      const { data } = useQuery<string>({ queryKey: ["shared"], queryFn, staleTime: 10_000 })
      return React.createElement("span", { "data-testid": id }, data ?? "")
    }

    render(withClient(client, React.createElement(
      "div",
      null,
      React.createElement(View, { id: "a", key: "a" }),
      React.createElement(View, { id: "b", key: "b" })
    )))

    await waitFor(() => {
      expect(screen.getByTestId("a").textContent).toBe("shared")
      expect(screen.getByTestId("b").textContent).toBe("shared")
    })
    expect(queryFn).toHaveBeenCalledTimes(1)
    client.clear()
  })

  it("renders the error state when the query fails", async () => {
    const client = new QueryClient()

    function View() {
      const { isError, error } = useQuery<string>({
        queryKey: ["bad"],
        queryFn: async () => { throw new Error("kaput") },
        retry: 0,
      })
      return React.createElement("span", { "data-testid": "out" }, isError ? error?.message : "…")
    }

    render(withClient(client, React.createElement(View)))
    await waitFor(() => {
      expect(screen.getByTestId("out").textContent).toBe("kaput")
    })
    client.clear()
  })

  it("throws a helpful error when no provider is present", () => {
    function View() {
      useQuery<string>({ queryKey: ["x"], queryFn: async () => "x" })
      return null
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(React.createElement(View))).toThrow(/No QueryClient found/)
    spy.mockRestore()
  })
})

describe("useMutation", () => {
  it("tracks loading and success through mutateAsync", async () => {
    const client = new QueryClient()
    let handle: { mutateAsync: (v: number) => Promise<number> } | null = null

    function View() {
      const m = useMutation<number, number>({ mutationFn: async (n) => n * 2 })
      handle = m
      return React.createElement(
        "span",
        { "data-testid": "out" },
        m.isLoading ? "saving" : String(m.data ?? "idle")
      )
    }

    render(withClient(client, React.createElement(View)))
    expect(screen.getByTestId("out").textContent).toBe("idle")

    await act(async () => { await handle!.mutateAsync(21) })
    await waitFor(() => {
      expect(screen.getByTestId("out").textContent).toBe("42")
    })
    client.clear()
  })
})
