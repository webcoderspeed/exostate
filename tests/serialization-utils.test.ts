import { describe, it, expect, beforeEach } from "vitest"
import { z } from "zod"
import {
  createAdvancedSerializer,
  createSerializerFromZod,
  createZodBoundary,
  createMigration,
  createChecksum,
  validateChecksum,
  measureSerialization,
  createSerializationError,
  SerializationErrorHandler
} from "../src/utils/serialization"
import { DeepReadonly } from "../src/types"

// Test schemas
const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  preferences: z.object({
    theme: z.enum(["light", "dark"]),
    notifications: z.boolean()
  }).optional()
})

type User = z.infer<typeof userSchema>

const counterSchema = z.object({
  count: z.number(),
  label: z.string()
})

type Counter = z.infer<typeof counterSchema>

describe("Advanced Serialization Utilities", () => {
  describe("createAdvancedSerializer", () => {
    it("should serialize and deserialize data with validation", () => {
      const serializer = createAdvancedSerializer<User>(1, {
        validate: (x): x is User => {
          try {
            userSchema.parse(x)
            return true
          } catch {
            return false
          }
        }
      })

      const user: User = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        preferences: {
          theme: "dark",
          notifications: true
        }
      }

      const serialized = serializer.encode(user as unknown as DeepReadonly<User>)
      const deserialized = serializer.decode(serialized)

      expect(deserialized).toEqual(user)
      expect(serializer.canSerialize(user)).toBe(true)
      expect(serializer.canSerialize({ invalid: "data" })).toBe(false)
    })

    it("should handle migrations between versions", () => {
      const serializer = createAdvancedSerializer<Counter>(2, {
        validate: (x): x is Counter => {
          try {
            counterSchema.parse(x)
            return true
          } catch {
            return false
          }
        },
        migrations: {
          1: (input: unknown) => {
            if (typeof input === "object" && input !== null && "count" in input) {
              const inputObj = input as { count: unknown }
              if (typeof inputObj.count === "number") {
                return { count: inputObj.count, label: "default" }
              }
            }
            throw new Error("Invalid v1 data")
          }
        }
      })

      // Simulate v1 payload
      const v1Payload = JSON.stringify({
        metadata: { version: 1, timestamp: Date.now() },
        data: { count: 42 }
      })

      const result = serializer.decode(v1Payload)
        expect(result).toEqual({ count: 42, label: "default" })
    })

    it("should handle error handling strategies", () => {
      const serializer = createAdvancedSerializer<Counter>(1, {
        validate: (x): x is Counter => false, // Always invalid
        errorHandling: "default",
        defaultValue: { count: 0, label: "error" } as Counter
      })

      const invalidData = { invalid: "data" }
      const result = serializer.decode(JSON.stringify({
        metadata: { version: 1, timestamp: Date.now() },
        data: invalidData
      }))

      expect(result).toEqual({ count: 0, label: "error" })
    })
  })

  describe("createSerializerFromZod", () => {
    it("should create serializer from Zod schema", () => {
      const serializer = createSerializerFromZod(userSchema, 1)

      const user: User = {
        id: 1,
        name: "Jane Doe",
        email: "jane@example.com"
      }

      const serialized = serializer.encode(user as unknown as DeepReadonly<User>)
      const deserialized = serializer.decode(serialized)

      expect(deserialized).toEqual(user)
      expect(serializer.canSerialize(user)).toBe(true)
    })

    it("should reject invalid data with Zod validation", () => {
      const serializer = createSerializerFromZod(userSchema, 1)

      const invalidUser = { id: 1, name: "John", email: "invalid-email" }
      
      expect(serializer.canSerialize(invalidUser)).toBe(false)
      expect(() => {
        serializer.encode(invalidUser as unknown as DeepReadonly<User>)
      }).toThrow()
    })
  })

  describe("createZodBoundary", () => {
    it("should create serialization boundary with Zod validation", () => {
      const boundary = createZodBoundary(userSchema)

      const user: User = {
        id: 1,
        name: "John Smith",
        email: "john.smith@example.com"
      }

      const serialized = boundary.serialize(user)
      const deserialized = boundary.deserialize(serialized)

      expect(deserialized).toEqual(user)
      expect(boundary.validate(user)).toBe(true)
    })

    it("should handle default values on deserialization error", () => {
      const defaultUser: User = {
        id: 0,
        name: "Default User",
        email: "default@example.com"
      }

      const boundary = createZodBoundary(userSchema, {
        defaultValue: defaultUser
      })

      const invalidJson = "{invalid: json"
      const result = boundary.deserialize(invalidJson)

      expect(result).toEqual(defaultUser)
    })

    it("should transform errors", () => {
      const boundary = createZodBoundary(userSchema, {
        transformError: (error) => new Error(`Custom: ${error}`)
      })

      expect(() => {
        boundary.deserialize("{}")
      }).toThrow("Custom")
    })
  })

  describe("Utility Functions", () => {
    describe("createMigration", () => {
      it("should create type-safe migration function", () => {
        const migrateV1toV2 = createMigration<
          { count: number },
          { count: number; label: string }
        >(
          (v1) => ({ count: v1.count, label: "migrated" }),
          (x): x is { count: number } => 
            typeof x === "object" && x !== null && "count" in x && typeof (x as { count: unknown }).count === "number",
          (x): x is { count: number; label: string } =>
            typeof x === "object" && x !== null && 
            "count" in x && typeof (x as { count: unknown }).count === "number" &&
            "label" in x && typeof (x as { label: unknown }).label === "string"
        )

        const result = migrateV1toV2({ count: 42 })
        expect(result).toEqual({ count: 42, label: "migrated" })

        expect(() => migrateV1toV2("invalid" as unknown as { count: number })).toThrow()
      })
    })

    describe("Checksum Utilities", () => {
      it("should create and validate checksums", () => {
        const data = { name: "test", value: 42 }
        const checksum = createChecksum(data)

        expect(typeof checksum).toBe("string")
        expect(checksum.length).toBeGreaterThan(0)
        expect(validateChecksum(data, checksum)).toBe(true)
        expect(validateChecksum({ name: "different", value: 42 }, checksum)).toBe(false)
      })

      it("should handle string data directly", () => {
        const data = "test string"
        const checksum = createChecksum(data)
        
        expect(validateChecksum(data, checksum)).toBe(true)
        expect(validateChecksum("different string", checksum)).toBe(false)
      })
    })

    describe("measureSerialization", () => {
      it("should measure serialization performance", () => {
        const serializer = createSerializerFromZod(counterSchema, 1)
        const data = { count: 42, label: "test" }

        const metrics = measureSerialization(serializer, data as unknown as DeepReadonly<Counter>, 10) // Reduced iterations for test speed

        expect(metrics.avgEncodeTime).toBeGreaterThan(0)
        expect(metrics.avgDecodeTime).toBeGreaterThan(0)
        expect(metrics.serializedSize).toBeGreaterThan(0)
        expect(metrics.compressionRatio).toBeGreaterThan(0)
      })
    })
  })

  describe("Error Handling", () => {
    describe("createSerializationError", () => {
      it("should create validation errors", () => {
        const error = createSerializationError("validation", "Invalid data", { value: "test" })
        expect(error.type).toBe("validation")
        expect(error.message).toBe("Invalid data")
        if (error.type === "validation") {
          expect(error.value).toBe("test")
        }
      })

      it("should create migration errors", () => {
        const error = createSerializationError("migration", "Migration failed", { version: 2 })
        expect(error.type).toBe("migration")
        if (error.type === "migration") {
          expect(error.version).toBe(2)
        }
      })

      it("should create version errors", () => {
        const error = createSerializationError("version", "Version mismatch", { 
          expected: 2, 
          actual: 3 
        })
        expect(error.type).toBe("version")
        if (error.type === "version") {
          expect(error.expected).toBe(2)
          expect(error.actual).toBe(3)
        }
      })
    })

    describe("SerializationErrorHandler", () => {
      let handler: SerializationErrorHandler

      beforeEach(() => {
        handler = new SerializationErrorHandler()
      })

      it("should handle and track errors", () => {
        const error = createSerializationError("validation", "Test error")
        handler.handleError(error)

        expect(handler.hasErrors()).toBe(true)
        expect(handler.getErrors()).toEqual([error])
      })

      it("should transform unknown errors", () => {
        const transformed = handler.transformError(new Error("Original error"))
        expect(transformed.type).toBe("validation")
        expect(transformed.message).toBe("Original error")

        const stringError = handler.transformError("string error")
        expect(stringError.message).toBe("string error")
      })

      it("should provide recovery values", () => {
        const validationError = createSerializationError("validation", "error")
        const migrationError = createSerializationError("migration", "error")
        const formatError = createSerializationError("format", "error")

        expect(handler.recover(validationError)).toBeNull()
        expect(handler.recover(migrationError)).toEqual({})
        expect(handler.recover(formatError)).toBe("{}")
      })

      it("should clear errors", () => {
        handler.handleError(createSerializationError("validation", "error"))
        expect(handler.hasErrors()).toBe(true)
        
        handler.clearErrors()
        expect(handler.hasErrors()).toBe(false)
      })
    })
  })

  describe("Edge Cases", () => {
    it("should handle circular references gracefully", () => {
      const circularData = { name: "circular" } as Record<string, unknown>
      circularData.self = circularData

      const serializer = createAdvancedSerializer<Record<string, unknown>>(1, {
        validate: (x): x is Record<string, unknown> => typeof x === "object" && x !== null
      })

      // Should not throw on circular references during validation
      expect(serializer.canSerialize(circularData)).toBe(true)

      // But encoding should handle circular references (JSON.stringify will throw)
      expect(() => serializer.encode(circularData)).toThrow()
    })

    it("should handle large data efficiently", () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random()
      }))

      const serializer = createAdvancedSerializer<typeof largeData>(1, {
        validate: (x): x is typeof largeData => Array.isArray(x) && x.length === 1000
      })

      const serialized = serializer.encode(largeData as any)
      const deserialized = serializer.decode(serialized)

      expect(deserialized).toEqual(largeData)
      expect(serialized.length).toBeLessThan(JSON.stringify(largeData).length * 2) // Reasonable size
    })
  })
})