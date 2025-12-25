/**
 * Advanced Serialization Utilities for Type-Safe State Management
 * Enhanced serialization functions for Exostate v2.0
 */

// Declare console for environments where it might not be available
declare const console: {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

import { z } from 'zod';
import { 
  AdvancedSerializer, 
  AdvancedSerializerOptions, 
  SerializationMetadata,
  VersionedPayload,
  SerializationError,
  SerializationBoundary,
  SerializationBoundaryOptions
} from '../types/advanced/serialization.types';
import { DeepReadonly } from '../types';


// ============================================================================
// CORE SERIALIZATION UTILITIES
// ============================================================================

/**
 * Create an advanced serializer with enhanced capabilities
 */
export function createAdvancedSerializer<T>(
  version: number,
  options: AdvancedSerializerOptions<T>
): AdvancedSerializer<T> {
  const {
    validate,
    migrations = {},
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    format: _format = 'json',
    encoder = JSON.stringify,
    decoder = JSON.parse,
    errorHandling = 'throw',
    defaultValue
  } = options;

  const canSerialize = (value: unknown): value is T => {
    try {
      return validate(value);
    } catch {
      return false;
    }
  };

  const safeDecode = (raw: string) => {
    try {
      const value = decode(raw);
      return { success: true as const, value };
    } catch (error) {
      return { 
        success: false as const, 
        error: error instanceof Error ? error : new Error(String(error)) 
      };
    }
  };

  const encode = (snapshot: DeepReadonly<T>): string => {
    // Cast to T for validation as we know it's readonly version of T
    if (!canSerialize(snapshot as unknown as T)) {
      throw new Error('Cannot serialize value: validation failed');
    }

    const metadata: SerializationMetadata = {
      version,
      timestamp: Date.now(),
      schemaId: `v${version}`
    };

    const payload: VersionedPayload<T> = {
      metadata,
      data: snapshot as unknown as T
    };

    return encoder(payload);
  };

  const decode = (raw: string): T => {
    const parsedUnknown: unknown = decoder(raw);
    
    if (!isVersionedPayload(parsedUnknown)) {
      throw new Error('Invalid payload format');
    }

    const { metadata, data: dataUnknown } = parsedUnknown;
    
    if (metadata.version > version) {
      throw new Error(`Future version: ${metadata.version} > ${version}`);
    }

    let currentVersion = metadata.version;
    let currentData: unknown = dataUnknown;

    // Apply migrations if needed
    while (currentVersion < version) {
      const migration = migrations[currentVersion];
      if (!migration) {
        throw new Error(`Missing migration from version ${currentVersion}`);
      }
      currentData = migration(currentData);
      currentVersion += 1;
    }

    if (!validate(currentData)) {
      if (errorHandling === 'default' && defaultValue !== undefined) {
        return defaultValue;
      }
      if (errorHandling === 'return') {
        throw new Error('Validation failed');
      }
      throw new Error('Validation failed');
    }

    return currentData;
  };

  return {
    version,
    encode,
    decode,
    canSerialize,
    safeDecode
  };
}

/**
 * Check if a value is a versioned payload
 */
function isVersionedPayload(x: unknown): x is VersionedPayload<unknown> {
  if (typeof x !== 'object' || x === null) return false;
  
  const payload = x as Record<string, unknown>;
  return (
    'metadata' in payload &&
    'data' in payload &&
    isSerializationMetadata(payload.metadata)
  );
}

/**
 * Check if a value is serialization metadata
 */
function isSerializationMetadata(x: unknown): x is SerializationMetadata {
  if (typeof x !== 'object' || x === null) return false;
  
  const metadata = x as Record<string, unknown>;
  return (
    'version' in metadata &&
    typeof metadata.version === 'number' &&
    'timestamp' in metadata &&
    typeof metadata.timestamp === 'number'
  );
}

// ============================================================================
// ZOD INTEGRATION UTILITIES
// ============================================================================

/**
 * Create a serializer from a Zod schema
 */
export function createSerializerFromZod<T>(
  schema: z.ZodType<T>,
  version: number = 1,
  options: Omit<AdvancedSerializerOptions<T>, 'validate'> = {}
): AdvancedSerializer<T> {
  const validate = (x: unknown): x is T => {
    try {
      schema.parse(x);
      return true;
    } catch {
      return false;
    }
  };

  return createAdvancedSerializer(version, {
    ...options,
    validate
  });
}

/**
 * Create a serialization boundary with Zod validation
 */
export function createZodBoundary<T>(
  schema: z.ZodType<T>,
  options: SerializationBoundaryOptions<T> = {}
): SerializationBoundary<T> {
  const {
    transformError = (error: unknown) => 
      error instanceof Error ? error : new Error(String(error)),
    defaultValue,
    logging = { enabled: false, level: 'error' }
  } = options;

  const serialize = (value: T): string => {
    try {
      schema.parse(value);
      return JSON.stringify(value);
    } catch (error) {
      const err = transformError(error);
      if (logging.enabled) {
        console[logging.level]('Serialization error:', err);
      }
      throw err;
    }
  };

  const deserialize = (raw: string): T => {
    try {
      const parsed: unknown = JSON.parse(raw);
      return schema.parse(parsed);
    } catch (error) {
      const err = transformError(error);
      if (defaultValue !== undefined) {
        if (logging.enabled) {
          console[logging.level]('Deserialization error, using default:', err);
        }
        return defaultValue;
      }
      if (logging.enabled) {
        console[logging.level]('Deserialization error:', err);
      }
      throw err;
    }
  };

  const validate = (value: unknown): value is T => {
    try {
      schema.parse(value);
      return true;
    } catch {
      return false;
    }
  };

  return {
    serialize,
    deserialize,
    validate
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a migration function with type safety
 */
export function createMigration<From, To>(
  migrate: (input: From) => To,
  validateFrom?: (x: unknown) => x is From,
  validateTo?: (x: unknown) => x is To
): (input: unknown) => unknown {
  return (input: unknown): unknown => {
    if (validateFrom && !validateFrom(input)) {
      throw new Error('Invalid input for migration');
    }
    
    const result = migrate(input as From);
    
    if (validateTo && !validateTo(result)) {
      throw new Error('Migration produced invalid output');
    }
    
    return result;
  };
}

/**
 * Create a checksum for data integrity
 */
export function createChecksum(data: unknown): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  let hash = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return hash.toString(16);
}

/**
 * Validate checksum for data integrity
 */
export function validateChecksum(data: unknown, expectedChecksum: string): boolean {
  const actualChecksum = createChecksum(data);
  return actualChecksum === expectedChecksum;
}

/**
 * Measure serialization performance
 */
export function measureSerialization<T>(
  serializer: AdvancedSerializer<T>,
  data: T,
  iterations: number = 1000
): {
  avgEncodeTime: number;
  avgDecodeTime: number;
  serializedSize: number;
  compressionRatio: number;
} {
  let totalEncodeTime = 0;
  let totalDecodeTime = 0;
  let serialized: string;
  
  // Warm-up
  // Cast data to DeepReadonly<T> because encode expects it
  serialized = serializer.encode(data as unknown as DeepReadonly<T>);
  serializer.decode(serialized);
  
  const perf = globalThis.performance;

  // Measure encoding
  for (let i = 0; i < iterations; i++) {
    const start = perf.now();
    serializer.encode(data as unknown as DeepReadonly<T>);
    totalEncodeTime += perf.now() - start;
  }
  
  // Measure decoding
  for (let i = 0; i < iterations; i++) {
    const start = perf.now();
    serializer.decode(serialized);
    totalDecodeTime += perf.now() - start;
  }
  
  const originalSize = new TextEncoder().encode(JSON.stringify(data)).length;
  const compressedSize = new TextEncoder().encode(serialized).length;
  
  return {
    avgEncodeTime: totalEncodeTime / iterations,
    avgDecodeTime: totalDecodeTime / iterations,
    serializedSize: compressedSize,
    compressionRatio: compressedSize / originalSize
  };
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Create a standardized serialization error
 */
export function createSerializationError(
  type: SerializationError['type'],
  message: string,
  details?: Record<string, unknown>
): SerializationError {
  
  if (type === 'validation') {
    return { type, message, value: details?.value };
  }
  if (type === 'migration') {
    return { type, message, version: details?.version as number };
  }
  if (type === 'format') {
    return { type, message, raw: details?.raw as string };
  }
  if (type === 'version') {
    return { 
      type, 
      message, 
      expected: details?.expected as number, 
      actual: details?.actual as number 
    };
  }
  if (type === 'integrity') {
    return { type, message, checksum: details?.checksum as string };
  }
  
  return { type: 'validation', message: 'Unknown error', value: undefined };
}

/**
 * Error handler for serialization operations
 */
export class SerializationErrorHandler {
  private errors: SerializationError[] = [];

  handleError(error: SerializationError): void {
    this.errors.push(error);
    console.error(`Serialization Error [${error.type}]: ${error.message}`);
  }

  transformError(error: unknown): SerializationError {
    if (error instanceof Error) {
      return {
        type: 'validation',
        message: error.message,
        value: undefined
      };
    }
    return {
      type: 'validation',
      message: String(error),
      value: undefined
    };
  }

  recover(error: SerializationError): unknown {
    switch (error.type) {
      case 'validation':
        return null;
      case 'migration':
        return {};
      case 'format':
        return '{}';
      case 'version':
        return { v: 1, data: {} };
      case 'integrity':
        return null;
      default:
        return null;
    }
  }

  getErrors(): SerializationError[] {
    return [...this.errors];
  }

  clearErrors(): void {
    this.errors = [];
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }
}