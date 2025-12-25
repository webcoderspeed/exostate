/**
 * Advanced Serialization Types for Type-Safe State Management
 * Enhanced serialization utilities for Exostate v2.0
 */

import { DeepReadonly } from '../index';

// ============================================================================
// CORE SERIALIZATION TYPES
// ============================================================================

/**
 * Type-safe serializer interface with enhanced capabilities
 */
export interface AdvancedSerializer<T> {
  /**
   * Current serializer version
   */
  readonly version: number;
  
  /**
   * Encode state to string with type safety
   */
  encode(snapshot: DeepReadonly<T>): string;
  
  /**
   * Decode string to state with validation
   */
  decode(raw: string): T;
  
  /**
   * Validate if a value can be serialized
   */
  canSerialize(value: unknown): value is T;
  
  /**
   * Safe decoding with error handling
   */
  safeDecode(raw: string): { success: true; value: T } | { success: false; error: Error };
}

/**
 * Migration function for schema evolution
 */
export type Migration<From, To> = (input: From) => To;

/**
 * Enhanced serializer options with type safety
 */
export interface AdvancedSerializerOptions<T> {
  /**
   * Type guard for validation
   */
  validate: (x: unknown) => x is T;
  
  /**
   * Migration functions for version upgrades
   */
  migrations?: Record<number, Migration<unknown, unknown>>;
  
  /**
   * Custom serialization format (default: JSON)
   */
  format?: 'json' | 'binary' | 'custom';
  
  /**
   * Custom encoder function
   */
  encoder?: (data: unknown) => string;
  
  /**
   * Custom decoder function
   */
  decoder?: (raw: string) => unknown;
  
  /**
   * Error handling strategy
   */
  errorHandling?: 'throw' | 'return' | 'default';
  
  /**
   * Default value for error cases
   */
  defaultValue?: T;
}

/**
 * Serialization metadata for version tracking
 */
export interface SerializationMetadata {
  /**
   * Schema version
   */
  version: number;
  
  /**
   * Timestamp of serialization
   */
  timestamp: number;
  
  /**
   * Checksum for data integrity
   */
  checksum?: string;
  
  /**
   * Schema identifier
   */
  schemaId?: string;
  
  /**
   * Compression information
   */
  compression?: {
    algorithm: 'none' | 'gzip' | 'deflate';
    ratio: number;
  };
}

/**
 * Versioned payload with metadata
 */
export interface VersionedPayload<T> {
  /**
   * Serialization metadata
   */
  metadata: SerializationMetadata;
  
  /**
   * Actual data payload
   */
  data: T;
}

/**
 * Serialization result with metadata
 */
export interface SerializationResult {
  /**
   * Serialized string
   */
  serialized: string;
  
  /**
   * Serialization metadata
   */
  metadata: SerializationMetadata;
  
  /**
   * Original data size
   */
  originalSize: number;
  
  /**
   * Serialized size
   */
  serializedSize: number;
  
  /**
   * Compression ratio
   */
  compressionRatio: number;
}

// ============================================================================
// TYPE UTILITIES FOR SERIALIZATION
// ============================================================================

/**
 * Type that excludes non-serializable values
 */
export type Serializable<T> = 
  T extends string | number | boolean | null | undefined ? T :
  T extends Array<infer U> ? Array<Serializable<U>> :
  T extends object ? { [K in keyof T]: Serializable<T[K]> } :
  never;

/**
 * Type that includes only serializable properties
 */
export type OnlySerializable<T> = {
  [K in keyof T as T[K] extends ((...args: unknown[]) => unknown) | symbol ? never : K]: Serializable<T[K]>
};

/**
 * Type for serialization boundaries
 */
export type SerializationBoundary<T> = {
  serialize: (value: T) => string;
  deserialize: (raw: string) => T;
  validate: (value: unknown) => value is T;
};

/**
 * Options for serialization boundaries
 */
export interface SerializationBoundaryOptions<T> {
  /**
   * Custom validation function
   */
  validator?: (value: unknown) => value is T;
  
  /**
   * Error transformation
   */
  transformError?: (error: unknown) => Error;
  
  /**
   * Default value on error
   */
  defaultValue?: T;
  
  /**
   * Logging configuration
   */
  logging?: {
    enabled: boolean;
    level: 'error' | 'warn' | 'info' | 'debug';
  };
}

// ============================================================================
// SERIALIZATION STRATEGIES
// ============================================================================

/**
 * Serialization strategy interface
 */
export interface SerializationStrategy {
  /**
   * Strategy identifier
   */
  readonly name: string;
  
  /**
   * Serialize data
   */
  serialize(data: unknown): string;
  
  /**
   * Deserialize data
   */
  deserialize(raw: string): unknown;
  
  /**
   * Check if strategy supports compression
   */
  supportsCompression(): boolean;
  
  /**
   * Get strategy capabilities
   */
  getCapabilities(): {
    compression: boolean;
    streaming: boolean;
    binary: boolean;
    metadata: boolean;
  };
}

/**
 * JSON serialization strategy
 */
export interface JsonSerializationStrategy extends SerializationStrategy {
  readonly name: 'json';
  
  /**
   * JSON-specific options
   */
  options?: {
    prettyPrint?: boolean;
    replacer?: (key: string, value: unknown) => unknown;
    reviver?: (key: string, value: unknown) => unknown;
  };
}

/**
 * Binary serialization strategy
 */
export interface BinarySerializationStrategy extends SerializationStrategy {
  readonly name: 'binary';
  
  /**
   * Binary-specific options
   */
  options?: {
    encoding?: 'base64' | 'hex' | 'utf8';
    compression?: boolean;
  };
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Serialization error types
 */
export type SerializationError = 
  | { type: 'validation'; message: string; value: unknown }
  | { type: 'migration'; message: string; version: number }
  | { type: 'format'; message: string; raw: string }
  | { type: 'version'; message: string; expected: number; actual: number }
  | { type: 'integrity'; message: string; checksum: string };

/**
 * Serialization error handler
 */
export interface SerializationErrorHandler {
  /**
   * Handle serialization errors
   */
  handleError(error: SerializationError): void;
  
  /**
   * Transform errors for better reporting
   */
  transformError(error: unknown): SerializationError;
  
  /**
   * Recovery strategy
   */
  recover(error: SerializationError): unknown;
}