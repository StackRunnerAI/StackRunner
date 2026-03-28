export interface JsonSchema {
  $schema?: string;
  $id?: string;
  $ref?: string;
  title?: string;
  description?: string;
  type?: "object" | "array" | "string" | "number" | "integer" | "boolean" | "null";
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema | JsonSchema[];
  enum?: Array<string | number | boolean | null>;
  const?: string | number | boolean | null;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  pattern?: string;
  format?: string;
  minimum?: number;
  minItems?: number;
  examples?: unknown[];
  default?: unknown;
  definitions?: Record<string, JsonSchema>;
}
