
import { Bench } from 'tinybench';

const bench = new Bench({ time: 100 });

let stateClosure = { count: 0 };

class Store {
  constructor() {
    this.state = { count: 0 };
  }
}
const store = new Store();

bench
  .add('Closure Access', () => {
    const next = { ...stateClosure, count: stateClosure.count + 1 };
    stateClosure = next;
  })
  .add('Property Access', () => {
    const next = { ...store.state, count: store.state.count + 1 };
    store.state = next;
  });

await bench.run();

console.table(bench.table());
