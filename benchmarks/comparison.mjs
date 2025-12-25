import { performance } from 'perf_hooks'
import { createStore as createExoStore } from '../dist/index.js'
import { createStore as createReduxStore } from 'redux'
import { createStore as createZustandStore } from 'zustand/vanilla'

// --- Benchmark Runner ---

function formatNumber(n) {
  return Intl.NumberFormat('en-US').format(n)
}

function bench(name, iterations, fn) {
  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    fn(i)
  }
  const end = performance.now()
  const totalMs = end - start
  const opsPerSec = (iterations / totalMs) * 1000
  return { name, opsPerSec }
}

function runBenchmarks() {
  const iterations = 100_000
  console.log(`Running benchmarks with ${formatNumber(iterations)} iterations...\n`)
  
  const results = []

  // --- Setup Stores ---
  
  // 1. Exostate
  const exStore = createExoStore({ count: 0 })
  
  // 2. Redux
  const reduxReducer = (state = { count: 0 }, action) => {
    if (action.type === 'INC') return { ...state, count: state.count + action.payload }
    return state
  }
  const reduxStore = createReduxStore(reduxReducer)
  
  // 3. Zustand (Vanilla)
  const zustandStore = createZustandStore((set) => ({
    count: 0,
    inc: (payload) => set((state) => ({ count: state.count + payload })),
  }))

  // --- Warmup ---
  console.log('Warming up JIT...')
  for(let i=0; i<10000; i++) {
    exStore.update((s, n) => ({ ...s, count: s.count + n }), 1)
    reduxStore.dispatch({ type: 'INC', payload: 1 })
    zustandStore.setState({ count: 1 }) // Direct set for fair comparison of "external update"
    zustandStore.getState().inc(1) // Action call
  }

  // --- Benchmark 1: Simple Updates (No Subscribers) ---
  console.log('\n--- Scenario 1: Updates (No Subscribers) ---')
  
  results.push(bench('Exostate (update)', iterations, () => {
    exStore.update((s, n) => ({ ...s, count: s.count + n }), 1)
  }))

  results.push(bench('Exostate (assign)', iterations, () => {
    exStore.update((s, n) => Object.assign({}, s, { count: s.count + n }), 1)
  }))
  
  results.push(bench('Redux (dispatch)', iterations, () => {
    reduxStore.dispatch({ type: 'INC', payload: 1 })
  }))
  
  // For Zustand, we can test both `setState` (external) and action invocation (internal)
  results.push(bench('Zustand (setState)', iterations, () => {
    zustandStore.setState((state) => ({ count: state.count + 1 }))
  }))
  
  // --- Benchmark 2: Updates with Subscribers ---
  console.log('\n--- Scenario 2: Updates with 1 Subscriber ---')
  
  // Reset / New Stores
  const exStoreSub = createExoStore({ count: 0 })
  exStoreSub.subscribe(s => s.count, () => {})
  
  const reduxStoreSub = createReduxStore(reduxReducer)
  reduxStoreSub.subscribe(() => {})
  
  const zustandStoreSub = createZustandStore((set) => ({
    count: 0,
  }))
  zustandStoreSub.subscribe(() => {})

  results.push(bench('Exostate (sub)', iterations, () => {
    exStoreSub.update((s, n) => ({ ...s, count: s.count + n }), 1)
  }))

  results.push(bench('Exostate (sub-assign)', iterations, () => {
    exStoreSub.update((s, n) => Object.assign({}, s, { count: s.count + n }), 1)
  }))
  
  results.push(bench('Redux (sub)', iterations, () => {
    reduxStoreSub.dispatch({ type: 'INC', payload: 1 })
  }))
  
  results.push(bench('Zustand (sub)', iterations, () => {
    zustandStoreSub.setState((state) => ({ count: state.count + 1 }))
  }))

  // --- Output Table ---
  console.log('\n| Library | Scenario | Ops/sec |')
  console.log('|---|---|---|')
  results.forEach(r => {
    const [lib, scenario] = r.name.split(' (')
    const scenClean = scenario.replace(')', '')
    console.log(`| ${lib} | ${scenClean} | ${formatNumber(Math.round(r.opsPerSec))} |`)
  })
}

runBenchmarks()
