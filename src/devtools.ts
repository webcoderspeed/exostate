import { Middleware } from "./middleware"

export interface DevtoolsConnection {
  init(state: unknown): void
  send(op: string, payload: unknown, state: unknown, meta?: { version: number; name?: string }): void
}

export function devtoolsMiddleware<T>(conn: DevtoolsConnection, name?: string): Middleware<T> {
  let initialized = false
  return {
    before(_op, ctx) {
      if (!initialized) {
        conn.init(ctx.snapshot)
        initialized = true
      }
    },
    after(op, ctx) {
      conn.send(op, ctx.payload, ctx.snapshot, { version: ctx.version, name })
    }
  }
}

export function createMemoryConnection() {
  const inits: unknown[] = []
  const events: Array<{ op: string; payload: unknown; state: unknown; meta?: { version: number; name?: string } }> = []
  const conn: DevtoolsConnection = {
    init(state: unknown) {
      inits.push(state)
    },
    send(op, payload, state, meta) {
      events.push({ op, payload, state, meta })
    }
  }
  return { conn, inits, events }
}

