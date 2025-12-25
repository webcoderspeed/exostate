
import { Bench } from 'tinybench';

const bench = new Bench({ time: 100 });

const state = { count: 0, a: 1, b: 2, c: 3 };

bench
  .add('Spread', () => {
    const next = { ...state, count: state.count + 1 };
  })
  .add('Object.assign', () => {
    const next = Object.assign({}, state, { count: state.count + 1 });
  });

await bench.run();

console.table(bench.table());
