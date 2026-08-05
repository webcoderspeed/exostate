# Contributing to Exostate

Thanks for your interest in improving Exostate. This document covers everything
you need to get productive quickly.

## Table of Contents

- [Getting started](#getting-started)
- [Project layout](#project-layout)
- [Development workflow](#development-workflow)
- [Design constraints](#design-constraints)
- [Testing](#testing)
- [Commit convention](#commit-convention)
- [Releasing](#releasing)
- [Reporting bugs](#reporting-bugs)

## Getting started

```bash
git clone https://github.com/webcoderspeed/exostate.git
cd exostate
npm install
npm run validate   # build + typecheck + lint + tests
```

**Node 20 or newer is required for development.** Vitest 4 declares
`engines: ^20 || ^22 || >=24`, so the test suite cannot run on Node 18.

The *published package* still supports Node 18 (`engines.node: >=18`) — its
source uses nothing newer than ES2020. CI proves this in the
`node18-compat` job, which runs the built artifact on Node 18 with no
dependencies installed. If you add a runtime API newer than ES2020, that job
will fail; either drop the API or raise `engines.node` deliberately.

## Project layout

```
src/
├── store.ts           Core store: commit pipeline, plugins, batching, lifecycle
├── types.ts           Shared types, plugin and options contracts
├── query.ts           Query cache: SWR, dedup, retries, GC, mutations, SSR
├── equality.ts        shallow / deepEqual comparators
├── combine.ts         Multi-store composition
├── computed.ts        Version-cached derived values
├── derived.ts         Thin selector wrapper (kept for compatibility)
├── history.ts         Undo / redo / time travel
├── transaction.ts     Atomic multi-step updates with rollback
├── persist.ts         localStorage-style persistence (browser-safe)
├── persist-idb.ts     IndexedDB persistence
├── plugin.ts          Plugin helpers and built-in plugins
├── middleware.ts      Operation-level middleware wrapper
├── devtools.ts        Devtools middleware
├── devtools-redux.ts  Redux DevTools extension bridge
├── event-source.ts    Append-only event log
├── define-store.ts    Creator-pattern store definition
├── store-factory.ts   Scoped and cached store factories
├── serialize.ts       Versioned serialization with migrations
├── ssr.ts             dehydrate / rehydrate
├── errors.ts          SafeError and error policies
├── schema.ts          Schema validation adapters (incl. Zod)
├── node/              Node-only entry (filesystem persistence)
├── react/             React adapter and query hooks
├── vue/               Vue adapter
├── svelte/            Svelte adapter
└── solid/             Solid adapter

tests/                 Vitest suites, one per area
benchmarks/            Comparative benchmarks vs Redux and Zustand
examples/              Runnable usage examples
```

## Development workflow

```bash
npm run test           # run the suite once
npm run test:watch     # watch mode
npm run typecheck      # tsc --noEmit
npm run lint           # eslint, zero warnings tolerated
npm run lint:fix       # auto-fix what can be auto-fixed
npm run build          # emit dist/
npm run size           # bundle size budgets
npm run bench          # micro-benchmarks
npm run validate       # everything above, as CI runs it
```

Run `npm run validate` before opening a pull request.

## Design constraints

These are the non-negotiables that shape every change:

1. **Zero runtime dependencies.** Exostate ships no `dependencies`. Framework
   packages are optional peer dependencies.
2. **The core entry must stay browser-safe.** No `node:` builtin may be
   reachable from `src/index.ts`. Node-only code lives in `src/node/` and is
   published as the `exostate/node` subpath. CI enforces this.
3. **Relative imports need explicit `.js` extensions.** The package builds with
   `moduleResolution: NodeNext`; extensionless specifiers emit ESM that Node
   cannot resolve.
4. **State is immutable.** Mutating methods produce a new value and go through
   `StoreImpl.commit`, which is the single write path — plugins and batching
   must never be bypassable.
5. **Every public export carries JSDoc.** Types are the documentation for most
   users.
6. **Bundle size is a feature.** Check `npm run size` when adding to the core
   entry; prefer a new subpath export over growing the default import.

## Testing

Tests use [Vitest](https://vitest.dev) with the jsdom environment.

- Put a test next to the concern it covers (`tests/query.test.ts`,
  `tests/regressions.test.ts`, …).
- Every bug fix needs a regression test that fails without the fix.
- Async timing tests should use an injected clock where possible
  (`new QueryClient({ now: () => clock })`) rather than long sleeps.
- React tests follow the existing `React.createElement` style so the `.ts`
  lint configuration applies to them.

```bash
npm test -- tests/query.test.ts     # single file
```

## Commit convention

This project uses [Conventional Commits](https://www.conventionalcommits.org).
Release versions are derived from commit titles automatically:

| Prefix              | Release |
| ------------------- | ------- |
| `feat:`             | minor   |
| `fix:`              | patch   |
| `perf:`             | patch   |
| `refactor:`         | patch   |
| `docs:`             | patch   |
| `test:` `chore:` `ci:` `build:` `style:` | none |
| `feat!:` or a `BREAKING CHANGE:` footer  | major |

Examples:

```
feat(query): add refetchInterval option
fix(react): cache getSnapshot so inline selectors cannot loop
perf(store): skip the plugin pipeline when no plugins are attached
```

## Releasing

Releases are fully automated. Merging to the default branch runs
[semantic-release](https://semantic-release.gitbook.io), which determines the
version from commit history, updates `CHANGELOG.md`, publishes to npm with
provenance, and creates a GitHub release. Maintainers never bump versions by
hand.

## Reporting bugs

Open an issue with the [bug report template](https://github.com/webcoderspeed/exostate/issues/new?template=bug_report.yml).
A minimal reproduction is worth more than any amount of description.

Security vulnerabilities should be reported privately through
[GitHub Security Advisories](https://github.com/webcoderspeed/exostate/security/advisories/new),
not as a public issue.
