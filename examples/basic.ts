import { createStore } from "../src"

const store = createStore({ count: 0, label: "init" })

const unsubscribe = store.subscribe(
  s => s.count,
  v => {
    console.log("count:", v)
  },
  { fireImmediately: true, }
)

store.update((prev, delta: number) => ({ ...prev, count: prev.count + delta }), 1)
store.update((prev, delta: number) => ({ ...prev, count: prev.count + delta }), 2)

store.set({ count: 10, label: "manual" })

unsubscribe()

