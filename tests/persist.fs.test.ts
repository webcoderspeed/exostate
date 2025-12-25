import { describe, it, expect } from "vitest"
import { createStore } from "../src"
import { persistFs } from "../src"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"

type S = { count: number; label: string }

describe("persistFs", () => {
  it("loads initial from file and writes on updates", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "exostate-"))
    const file = path.join(dir, "state.json")
    await fs.writeFile(file, JSON.stringify({ count: 7, label: "seed" }), "utf8")
    
    const store = createStore<S>({ count: 0, label: "a" })
    const ctrl = await persistFs(store, file, { loadInitial: true })
    expect(store.read()).toEqual({ count: 7, label: "seed" })
    
    store.update((p, d: number) => ({ ...p, count: p.count + d }), 3)
    await new Promise(r => setTimeout(r, 10))
    const raw = await fs.readFile(file, "utf8")
    expect(JSON.parse(raw)).toEqual({ count: 10, label: "seed" })
    
    ctrl.detach()
    store.update((p, d: number) => ({ ...p, count: p.count + d }), 3)
    await new Promise(r => setTimeout(r, 10))
    const raw2 = await fs.readFile(file, "utf8")
    expect(JSON.parse(raw2)).toEqual({ count: 10, label: "seed" })
  })
})

