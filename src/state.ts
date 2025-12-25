import { DeepReadonly } from "./types"

export interface State<T> {
  readonly version: number
  read(): T
  snapshot(): DeepReadonly<T>
}

export function createState<T>(initial: T): State<T> {
  let current = initial
  let version = 0
  return {
    get version() {
      return version
    },
    read() {
      return current
    },
    snapshot() {
      return current as DeepReadonly<T>
    },
  }
}
