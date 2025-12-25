
import { Bench } from 'tinybench';

const bench = new Bench({ time: 100 });

let stateSpread = { count: 0, a: 1, b: 2, c: 3 };
let stateAssign = { count: 0, a: 1, b: 2, c: 3 };

bench
  .add('Spread + Write', () => {
    const next = { ...stateSpread, count: stateSpread.count + 1 };
    stateSpread = next;
  })
  .add('Assign + Write', () => {
    const next = Object.assign({}, stateAssign, { count: stateAssign.count + 1 });
    stateAssign = next;
  });

await bench.run();

console.table(bench.table());
