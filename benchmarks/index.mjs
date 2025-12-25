import { performance } from 'perf_hooks'
import fs from 'node:fs'
import path from 'node:path'
import { createStore } from '../dist/index.js'

function formatNumber(n) {
  return Intl.NumberFormat('en-US').format(n)
}

function bench(name, iterations, fn) {
  const start = performance.now()
  for (let i = 0; i < iterations; i++) fn(i)
  const end = performance.now()
  const totalMs = end - start
  const avgUs = (totalMs * 1000) / iterations
  const opsPerSec = (iterations / totalMs) * 1000
  return { name, iterations, totalMs, avgUs, opsPerSec }
}

function writeDashboard(results) {
  const lines = []
  lines.push(`# exostate — Benchmark Report`)
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push('')
  lines.push('| Benchmark | Iterations | Total ms | Avg µs/op | Ops/sec |')
  lines.push('|-----------|------------:|---------:|----------:|--------:|')
  for (const r of results) {
    lines.push(`| ${r.name} | ${formatNumber(r.iterations)} | ${r.totalMs.toFixed(2)} | ${r.avgUs.toFixed(2)} | ${formatNumber(Math.round(r.opsPerSec))} |`)
  }
  const outDir = path.resolve(process.cwd(), 'benchmarks')
  const outFile = path.join(outDir, 'latest.md')
  fs.writeFileSync(outFile, lines.join('\n'))
  console.log(`Benchmark dashboard written to ${outFile}`)
}

function main() {
  const iterations = 50000
  const store = createStore({ count: 0, label: 'init' })
  const results = []

  results.push(
    bench('set(next)', iterations, (i) => {
      store.set({ count: i, label: 'x' })
    })
  )

  results.push(
    bench('update(reducer,payload)', iterations, () => {
      store.update((p, d) => ({ ...p, count: p.count + d }), 1)
    })
  )

  results.push(
    bench('compute(fn)', iterations, () => {
      store.compute((p) => ({ ...p, count: p.count + 1 }))
    })
  )

  // Batch: apply 10 reducers per batch for fewer notifications
  results.push(
    bench('batch(10 reducers)', Math.floor(iterations / 10), () => {
      store.batch((apply) => {
        for (let j = 0; j < 10; j++) {
          apply((p, d) => ({ ...p, count: p.count + d }), 1)
        }
      })
    })
  )

  // Subscribe overhead with equality dedup
  const unsub = store.subscribe((s) => s.count, () => {}, { fireImmediately: false })
  results.push(
    bench('notify with subscriber', iterations, () => {
      store.update((p, d) => ({ ...p, count: p.count + d }), 1)
    })
  )
  unsub()

  writeDashboard(results)
  for (const r of results) {
    console.log(
      `${r.name}: iterations=${formatNumber(r.iterations)} totalMs=${r.totalMs.toFixed(2)} avgUs=${r.avgUs.toFixed(
        2
      )} ops/sec=${formatNumber(Math.round(r.opsPerSec))}`
    )
  }
}

main()

