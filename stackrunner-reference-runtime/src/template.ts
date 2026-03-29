import { isRecord } from "./utils.js";

const tokenPattern = /\$\{([^}]+)\}/g;

function lookup(path: string, context: Record<string, unknown>): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[key];
    }

    return undefined;
  }, context);
}

function renderString(template: string, context: Record<string, unknown>): unknown {
  const exact = template.match(/^\$\{([^}]+)\}$/);
  if (exact?.[1]) {
    return lookup(exact[1], context);
  }

  return template.replace(tokenPattern, (_match, path: string) => {
    const resolved = lookup(path, context);
    return resolved === undefined ? "" : String(resolved);
  });
}

export function resolveTemplate<T>(value: T, context: Record<string, unknown>): T {
  if (typeof value === "string") {
    return renderString(value, context) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplate(item, context)) as T;
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveTemplate(item, context)])
    ) as T;
  }

  return value;
}
