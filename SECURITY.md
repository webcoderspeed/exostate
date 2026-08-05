# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report them privately through
[GitHub Security Advisories](https://github.com/webcoderspeed/exostate/security/advisories/new),
or by email to <webcoderspeed@gmail.com>.

Include, where possible:

- A description of the vulnerability and its impact
- Steps or a proof-of-concept to reproduce it
- The affected version(s)
- Any suggested remediation

You can expect an initial response within 72 hours, and a fix or mitigation
plan communicated within 7 days for confirmed issues.

## Scope notes

Exostate is a client-and-server state container with no runtime dependencies.
Areas most relevant to security reports:

- **Persistence adapters** (`persistLocal`, `persistIndexedDB`, `persistFs`) —
  these serialize application state to storage. Do not place secrets in
  persisted state.
- **`serialize.ts` migrations** — decoding untrusted payloads.
- **`devtools-redux.ts`** — accepts state pushed from the browser extension
  during time travel. Intended for development only.
- **SSR hydration** (`rehydrate`, `QueryClient.hydrate`) — treats the payload
  as trusted; never hydrate from user-controlled input without validating it
  first (see `createSerializer` and `schema.ts`).
