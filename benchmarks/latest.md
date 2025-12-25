# exostate — Benchmark Report

Generated: 2025-12-25T04:05:29.906Z

| Benchmark | Iterations | Total ms | Avg µs/op | Ops/sec |
|-----------|------------:|---------:|----------:|--------:|
| set(next) | 50,000 | 2.52 | 0.05 | 19,845,861 |
| update(reducer,payload) | 50,000 | 7.41 | 0.15 | 6,748,929 |
| compute(fn) | 50,000 | 7.49 | 0.15 | 6,671,670 |
| batch(10 reducers) | 5,000 | 7.37 | 1.47 | 678,741 |
| notify with subscriber | 50,000 | 8.09 | 0.16 | 6,183,145 |