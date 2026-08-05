<!--
Thanks for contributing to Exostate!

Commit titles follow Conventional Commits — the release version is derived
from them automatically:
  feat: …      → minor release
  fix: …       → patch release
  perf: …      → patch release
  docs: …      → patch release
  chore: …     → no release
  feat!: …     → major release (or a "BREAKING CHANGE:" footer)
-->

## What does this change?

<!-- A short description of the change and the problem it solves. -->

## Why?

<!-- Link the issue it closes, e.g. "Closes #123", or explain the motivation. -->

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds capability)
- [ ] Breaking change (existing API behaves differently)
- [ ] Performance improvement
- [ ] Documentation only
- [ ] Internal / tooling

## Checklist

- [ ] `npm run validate` passes locally (build, typecheck, lint, tests)
- [ ] Added or updated tests covering this change
- [ ] Public API changes are documented (JSDoc + README)
- [ ] No new runtime dependency was added (Exostate is dependency-free)
- [ ] The core entry point stays browser-safe (no `node:` builtins outside `src/node/`)
- [ ] Bundle size impact considered (`npm run size`)

## Notes for reviewers

<!-- Anything tricky, intentional trade-offs, or areas you want scrutinised. -->
