import { DeepReadonly } from "./types"

export interface Serializer<T> {
  version: number
  encode(snapshot: DeepReadonly<T>): string
  decode(raw: string): T
}

export type Migration = (input: unknown) => unknown

export interface SerializerOptions<T> {
  validate: (x: unknown) => x is T
  migrations?: Record<number, Migration>
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null
}

function isVersioned(x: unknown): x is { v: number; data: unknown } {
  if (!isObject(x)) return false
  const v = x["v"]
  const data = x["data"]
  return typeof v === "number" && typeof data !== "undefined"
}

export function createSerializer<T>(version: number, options: SerializerOptions<T>): Serializer<T> {
  const validate = options.validate
  const migrations = options.migrations ?? {}
  
  return {
    version,
    encode(snapshot: DeepReadonly<T>) {
      return JSON.stringify({ v: version, data: snapshot })
    },
    decode(raw: string) {
      const parsedUnknown: unknown = JSON.parse(raw)
      if (!isVersioned(parsedUnknown)) {
        throw new Error("Invalid payload")
      }
      let currVersion = parsedUnknown.v
      let dataUnknown: unknown = parsedUnknown.data
      if (currVersion > version) {
        throw new Error("Future version")
      }
      while (currVersion < version) {
        const step = migrations[currVersion]
        if (!step) {
          throw new Error("Missing migration")
        }
        dataUnknown = step(dataUnknown)
        currVersion += 1
      }
      if (!validate(dataUnknown)) {
        throw new Error("Validation failed")
      }
      return dataUnknown
    }
  }
}
