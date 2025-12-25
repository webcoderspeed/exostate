
import { Bench } from 'tinybench';

const bench = new Bench({ time: 100 });

class Store {
  constructor(current) {
    this.current = current;
    this.version = 0;
    this.listeners = new Set();
  }
  
  update(reducer, payload) {
    const next = reducer(this.current, payload);
    this.current = next;
    this.version += 1;
    if (this.listeners.size > 0) this.notifyListeners();
    return this.current;
  }

  updateNoVersion(reducer, payload) {
    const next = reducer(this.current, payload);
    this.current = next;
    // this.version += 1;
    if (this.listeners.size > 0) this.notifyListeners();
    return this.current;
  }

  updateNoListenerCheck(reducer, payload) {
    const next = reducer(this.current, payload);
    this.current = next;
    this.version += 1;
    // if (this.listeners.size > 0) this.notifyListeners();
    return this.current;
  }

  updateDirect(reducer, payload) {
    this.current = reducer(this.current, payload);
    return this.current;
  }
  
  updateInline(payload) {
    this.current = { ...this.current, count: this.current.count + payload };
    return this.current;
  }
  
  notifyListeners() {
    for (const notify of this.listeners) notify();
  }
}

const store = new Store({ count: 0 });
const reducer = (s, n) => ({ ...s, count: s.count + n });

bench
  .add('Full Update', () => {
    store.update(reducer, 1);
  })
  .add('Inline Reducer', () => {
    store.updateInline(1);
  })
  .add('Raw Loop', () => {
    store.current = { ...store.current, count: store.current.count + 1 };
  });

await bench.run();

console.table(bench.table());
