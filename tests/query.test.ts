import { describe, it, expect, vi } from "vitest"
import { QueryClient, createMutation, hashQueryKey } from "../src/query.js"

const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms))

describe("hashQueryKey", () => {
  it("is stable regardless of object key order", () => {
    expect(hashQueryKey(["u", { a: 1, b: 2 }])).toBe(hashQueryKey(["u", { b: 2, a: 1 }]))
  })

  it("distinguishes different keys", () => {
    expect(hashQueryKey(["u", 1])).not.toBe(hashQueryKey(["u", 2]))
  })
})

describe("QueryClient", () => {
  it("fetches and caches data", async () => {
    const client = new QueryClient()
    const queryFn = vi.fn().mockResolvedValue({ name: "ada" })

    const data = await client.fetchQuery({ queryKey: ["user", 1], queryFn })
    expect(data).toEqual({ name: "ada" })
    expect(client.getQueryData(["user", 1])).toEqual({ name: "ada" })
    client.clear()
  })

  it("deduplicates concurrent requests for the same key", async () => {
    const client = new QueryClient()
    let calls = 0
    const queryFn = async () => {
      calls++
      await tick(20)
      return calls
    }

    const [a, b, c] = await Promise.all([
      client.fetchQuery({ queryKey: ["dedupe"], queryFn }),
      client.fetchQuery({ queryKey: ["dedupe"], queryFn }),
      client.fetchQuery({ queryKey: ["dedupe"], queryFn }),
    ])

    expect(calls).toBe(1)
    expect([a, b, c]).toEqual([1, 1, 1])
    client.clear()
  })

  it("serves fresh cache without refetching within staleTime", async () => {
    const client = new QueryClient()
    const queryFn = vi.fn().mockResolvedValue("v1")

    await client.fetchQuery({ queryKey: ["fresh"], queryFn, staleTime: 10_000 })
    await client.fetchQuery({ queryKey: ["fresh"], queryFn, staleTime: 10_000 })

    expect(queryFn).toHaveBeenCalledTimes(1)
    client.clear()
  })

  it("refetches once data goes stale", async () => {
    let clock = 1000
    const client = new QueryClient({ now: () => clock })
    const queryFn = vi.fn().mockResolvedValue("v")

    await client.fetchQuery({ queryKey: ["stale"], queryFn, staleTime: 100 })
    clock += 500
    await client.fetchQuery({ queryKey: ["stale"], queryFn, staleTime: 100 })

    expect(queryFn).toHaveBeenCalledTimes(2)
    client.clear()
  })

  it("retries with backoff and eventually succeeds", async () => {
    const client = new QueryClient()
    let attempts = 0
    const queryFn = async () => {
      attempts++
      if (attempts < 3) throw new Error("boom")
      return "ok"
    }

    const data = await client.fetchQuery({
      queryKey: ["retry"],
      queryFn,
      retry: 3,
      retryDelay: 1,
    })

    expect(data).toBe("ok")
    expect(attempts).toBe(3)
    client.clear()
  })

  it("surfaces an error state after retries are exhausted", async () => {
    const client = new QueryClient()
    const queryFn = async () => { throw new Error("always fails") }

    await expect(
      client.fetchQuery({ queryKey: ["fail"], queryFn, retry: 0 })
    ).rejects.toThrow("always fails")

    const state = client.getQueryState(["fail"])
    expect(state?.isError).toBe(true)
    expect(state?.status).toBe("error")
    expect(state?.error?.message).toBe("always fails")
    client.clear()
  })

  it("serves stale data while revalidating in the background", async () => {
    let clock = 0
    const client = new QueryClient({ now: () => clock })
    let version = 0
    const queryFn = async () => {
      version++
      await tick(10)
      return `v${version}`
    }

    const observer = client.watch({ queryKey: ["swr"], queryFn, staleTime: 50 })
    await tick(30)
    expect(observer.getState().data).toBe("v1")

    clock += 1000 // now stale
    const refetching = observer.refetch()
    // Cached data stays visible while the new request is in flight.
    expect(observer.getState().data).toBe("v1")
    expect(observer.getState().isFetching).toBe(true)

    await refetching
    expect(observer.getState().data).toBe("v2")
    expect(observer.getState().isFetching).toBe(false)

    observer.destroy()
    client.clear()
  })

  it("invalidates by key prefix and refetches observed queries", async () => {
    const client = new QueryClient()
    const userFn = vi.fn().mockResolvedValue("user")
    const postFn = vi.fn().mockResolvedValue("post")

    const users = client.watch({ queryKey: ["users", 1], queryFn: userFn, staleTime: 10_000 })
    const posts = client.watch({ queryKey: ["posts", 1], queryFn: postFn, staleTime: 10_000 })
    await tick(5)
    expect(userFn).toHaveBeenCalledTimes(1)
    expect(postFn).toHaveBeenCalledTimes(1)

    await client.invalidateQueries({ queryKey: ["users"] })

    expect(userFn).toHaveBeenCalledTimes(2)
    expect(postFn).toHaveBeenCalledTimes(1) // untouched by the prefix filter

    users.destroy()
    posts.destroy()
    client.clear()
  })

  it("garbage collects entries once the last observer leaves", async () => {
    const client = new QueryClient()
    const observer = client.watch({
      queryKey: ["gc"],
      queryFn: async () => "x",
      gcTime: 20,
    })
    await tick(5)
    expect(client.size()).toBe(1)

    observer.destroy()
    expect(client.size()).toBe(1) // still within the gc window

    await tick(40)
    expect(client.size()).toBe(0)
    client.clear()
  })

  it("setQueryData writes the cache directly", () => {
    const client = new QueryClient()
    client.setQueryData(["todos"], [{ id: 1 }])
    expect(client.getQueryData(["todos"])).toEqual([{ id: 1 }])

    client.setQueryData<Array<{ id: number }>>(["todos"], prev => [...(prev ?? []), { id: 2 }])
    expect(client.getQueryData(["todos"])).toEqual([{ id: 1 }, { id: 2 }])
    client.clear()
  })

  it("does not fetch while disabled", async () => {
    const client = new QueryClient()
    const queryFn = vi.fn().mockResolvedValue("x")
    const observer = client.watch({ queryKey: ["off"], queryFn, enabled: false })
    await tick(10)
    expect(queryFn).not.toHaveBeenCalled()
    observer.destroy()
    client.clear()
  })

  it("falls back to placeholderData before the first resolution", async () => {
    const client = new QueryClient()
    const observer = client.watch({
      queryKey: ["placeholder"],
      queryFn: async () => { await tick(20); return "real" },
      placeholderData: "placeholder",
    })
    expect(observer.getState().data).toBe("placeholder")
    await tick(40)
    expect(observer.getState().data).toBe("real")
    observer.destroy()
    client.clear()
  })

  it("seeds the cache from initialData", () => {
    const client = new QueryClient()
    const observer = client.watch({
      queryKey: ["seeded"],
      queryFn: async () => "fetched",
      initialData: "seed",
      staleTime: 10_000,
    })
    expect(observer.getState().data).toBe("seed")
    observer.destroy()
    client.clear()
  })
})

describe("QueryClient SSR", () => {
  it("round-trips through dehydrate/hydrate without refetching", async () => {
    const server = new QueryClient()
    await server.prefetchQuery({ queryKey: ["user", 7], queryFn: async () => ({ id: 7 }) })

    // Must survive the JSON boundary between server and client.
    const wire = JSON.parse(JSON.stringify(server.dehydrate())) as ReturnType<QueryClient["dehydrate"]>
    expect(wire.queries).toHaveLength(1)

    const client = new QueryClient()
    client.hydrate(wire)
    expect(client.getQueryData(["user", 7])).toEqual({ id: 7 })

    const queryFn = vi.fn().mockResolvedValue({ id: 7 })
    const data = await client.fetchQuery({ queryKey: ["user", 7], queryFn, staleTime: 60_000 })
    expect(data).toEqual({ id: 7 })
    expect(queryFn).not.toHaveBeenCalled() // hydrated data was still fresh

    server.clear()
    client.clear()
  })

  it("omits failed queries from the dehydrated payload", async () => {
    const client = new QueryClient()
    await client.prefetchQuery({
      queryKey: ["broken"],
      queryFn: async () => { throw new Error("nope") },
      retry: 0,
    })
    expect(client.dehydrate().queries).toHaveLength(0)
    client.clear()
  })
})

describe("createMutation", () => {
  it("tracks loading then success", async () => {
    const mutation = createMutation({ mutationFn: async (n: number) => n * 2 })
    expect(mutation.getState().status).toBe("idle")

    const promise = mutation.mutate(21)
    expect(mutation.getState().isLoading).toBe(true)

    await expect(promise).resolves.toBe(42)
    expect(mutation.getState().data).toBe(42)
    expect(mutation.getState().isSuccess).toBe(true)
  })

  it("rolls back an optimistic update through onMutate context", async () => {
    const client = new QueryClient()
    client.setQueryData<string[]>(["todos"], ["a"])

    const mutation = createMutation<string, string, string[] | undefined>({
      mutationFn: async () => { throw new Error("server rejected") },
      onMutate: (text) => {
        const previous = client.getQueryData<string[]>(["todos"])
        client.setQueryData<string[]>(["todos"], old => [...(old ?? []), text])
        return previous
      },
      onError: (_error, _vars, previous) => {
        client.setQueryData(["todos"], previous ?? [])
      },
    })

    await expect(mutation.mutate("b")).rejects.toThrow("server rejected")
    expect(client.getQueryData(["todos"])).toEqual(["a"]) // rolled back
    expect(mutation.getState().isError).toBe(true)
    client.clear()
  })

  it("reset returns to idle", async () => {
    const mutation = createMutation({ mutationFn: async () => "x" })
    await mutation.mutate(undefined as void)
    expect(mutation.getState().isSuccess).toBe(true)
    mutation.reset()
    expect(mutation.getState().status).toBe("idle")
    expect(mutation.getState().data).toBeUndefined()
  })
})
