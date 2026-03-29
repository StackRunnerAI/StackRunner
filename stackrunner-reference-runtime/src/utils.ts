import { randomUUID } from "node:crypto";

export function createExecutionId(seed: string): string {
  return `exec_${seed}_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "value";
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function formatTimestamp(date: Date): string {
  return date.toISOString();
}
