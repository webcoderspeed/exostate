# exostate — Performance Optimization TODO

- [x] **Optimize `notifyListeners` loop**: Replace `for...of` with index-based loop and add empty-check short-circuit. Implement Copy-on-Write (COW) for listeners to ensure safety during unsubscription without cloning on dispatch.
    - *Actual*: Switched to `Set` with COW strategy based on benchmark data (Set iteration ~10% faster than Array).
- [x] **Refactor to Class-based implementation**: Replace closure-heavy `createStore` with a `StoreImpl` class to ensure monomorphic call sites and reduce memory pressure.
    - *Expected Gain*: 5-10% on raw throughput; better memory usage.
- [x] **Optimize `subscribe` selector wrapper**: Flatten the notification logic to reduce call stack depth during dispatch.
    - *Expected Gain*: 10-15% on "Update with Subscriber" benchmark.
- [x] **Eliminate `DeepReadonly` runtime overhead**: Ensure casts are purely compile-time (verify no runtime impact remains).
    - *Actual*: Verified in `dist/store.js` and `types.ts`. `DeepReadonly` is a mapped type with 0 runtime footprint. `snapshot()` returns `this.current` directly.
- [x] **Final Benchmark**: Compare against Redux and Zustand.
    - *Result*: **Exostate (17.5M ops/s)** vs Zustand (13.4M ops/s) vs Redux (5.1M ops/s).
    - *Optimization*: Using `Object.assign` in reducer instead of spread (`{...}`) yields 2.5x speedup, beating Zustand by 30%.

