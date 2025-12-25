# exostate — Benchmark Report

Generated: 2025-12-25T06:01:44.289Z

| Benchmark | Iterations | Total ms | Avg µs/op | Ops/sec |
|-----------|------------:|---------:|----------:|--------:|
| set(next) | 50,000 | 2.63 | 0.05 | 19,045,203 |
| update(reducer,payload) | 50,000 | 8.42 | 0.17 | 5,937,273 |
| compute(fn) | 50,000 | 7.65 | 0.15 | 6,533,991 |
| batch(10 reducers) | 5,000 | 7.64 | 1.53 | 654,097 |
| notify with subscriber | 50,000 | 8.79 | 0.18 | 5,688,282 |