export interface Schema<T> {
  parse(x: unknown): T
}

export function fromPredicate<T>(predicate: (x: unknown) => x is T): Schema<T> {
  return {
    parse(x: unknown): T {
      if (!predicate(x)) {
        throw new Error("Invalid schema")
      }
      return x
    }
  }
}

export function zodSchema<T>(schema: { parse: (x: unknown) => T }): Schema<T> {
  return {
    parse(x: unknown): T {
      return schema.parse(x)
    }
  }
}

export const fromZod = zodSchema
