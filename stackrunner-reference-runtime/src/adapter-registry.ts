import type { Adapter } from "stackrunner-spec";
import { createMockAdapters } from "./mock-adapter.js";
import { RealHttpAdapter } from "./real-http-adapter.js";
import { StripeAdapter } from "./stripe-adapter.js";

export type ExecutionMode = "mock" | "hybrid" | "real";

export function createAdapters(mode: ExecutionMode): Map<string, Adapter> {
  const mockAdapters = createMockAdapters();
  const realAdapters = new Map<string, Adapter>([["http", new RealHttpAdapter()]]);
  const stripeAdapter = StripeAdapter.fromEnv();
  if (stripeAdapter) {
    realAdapters.set("stripe", stripeAdapter);
  }

  switch (mode) {
    case "real":
      return realAdapters;
    case "hybrid":
      return new Map([...mockAdapters, ...realAdapters]);
    case "mock":
    default:
      return mockAdapters;
  }
}
