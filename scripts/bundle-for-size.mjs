/**
 * Produces real, tree-shaken bundles for size measurement.
 *
 * Measuring `dist/index.js` directly is meaningless: it is a barrel of
 * re-exports, so a file-size check reports a few hundred bytes while a real
 * consumer pulls in far more. These scenarios bundle the way an application
 * actually would, so `npm run size` reports numbers users will really see.
 */
import { build } from 'esbuild'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OUT = '.size'

// The generated entry lives in .size/src/, so a './dist/…' specifier would
// resolve relative to that folder. Absolute paths keep it unambiguous.
const core = path.resolve('dist/index.js')
const react = path.resolve('dist/react/index.js')
const reactQuery = path.resolve('dist/react/query.js')

const scenarios = [
  { file: 'store-only.js', code: `export { createStore } from ${JSON.stringify(core)}` },
  {
    file: 'store-plus.js',
    code: `export { createStore, computed, persistLocal, shallow, createHistory } from ${JSON.stringify(core)}`,
  },
  { file: 'query.js', code: `export { QueryClient, createMutation } from ${JSON.stringify(core)}` },
  { file: 'react.js', code: `export * from ${JSON.stringify(react)}` },
  { file: 'react-query.js', code: `export * from ${JSON.stringify(reactQuery)}` },
  { file: 'everything.js', code: `export * from ${JSON.stringify(core)}` },
]

await rm(OUT, { recursive: true, force: true })
await mkdir(path.join(OUT, 'src'), { recursive: true })

for (const { file, code } of scenarios) {
  const entry = path.join(OUT, 'src', file)
  await writeFile(entry, code)
  await build({
    entryPoints: [entry],
    outfile: path.join(OUT, file),
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    // Framework packages are peer dependencies — a consumer already ships
    // them, so counting them here would misrepresent the adapter's cost.
    external: ['react', 'vue', 'svelte', 'solid-js'],
    logLevel: 'error',
  })
}

console.log(`Built ${scenarios.length} size scenarios into ${OUT}/`)
