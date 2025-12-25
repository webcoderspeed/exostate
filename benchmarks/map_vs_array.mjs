
import { Bench } from 'tinybench';

const bench = new Bench({ time: 100 });

let listenersArray = [];
for (let i = 0; i < 10; i++) listenersArray.push(() => {});

let listenersSet = new Set();
for (let i = 0; i < 10; i++) listenersSet.add(() => {});

const dummy = () => {};

bench
  .add('Array Iteration', () => {
    for (const l of listenersArray) {
      l();
    }
  })
  .add('Set Iteration', () => {
    for (const l of listenersSet) {
      l();
    }
  })
  .add('Array COW Add', () => {
    const next = [...listenersArray, dummy];
  })
  .add('Set COW Add', () => {
    const next = new Set(listenersSet);
    next.add(dummy);
  });

await bench.run();

console.table(bench.table());
