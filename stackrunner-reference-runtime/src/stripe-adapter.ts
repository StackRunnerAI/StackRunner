import type {
  Adapter,
  AdapterConfig,
  Artifact,
  Capability,
  CapabilityDescriptor,
  ExecutionResult,
  RollbackResult,
  StepContext,
  ValidationResult,
  VerificationResult
} from "stackrunner-spec";
import { exampleCapabilities } from "stackrunner-spec";
import { formatTimestamp } from "./utils.js";

interface StripeConfig {
  secretKey: string;
  apiBase: string;
  currency: string;
}

type FormValue = string | number | boolean | null | undefined | FormValue[] | { [key: string]: FormValue };

function makeArtifact(
  step: StepContext,
  type: string,
  uri: string,
  metadata: Record<string, unknown>
): Artifact {
  return {
    id: `artifact_${step.execution.id}_${step.step.id}_${type}`,
    step_id: step.step.id,
    type,
    uri,
    metadata
  };
}

function parseStripeConfig(): StripeConfig | undefined {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return undefined;
  }

  return {
    secretKey,
    apiBase: process.env.STRIPE_API_BASE || "https://api.stripe.com",
    currency: (process.env.STRIPE_DEFAULT_CURRENCY || "usd").toLowerCase()
  };
}

function appendFormValue(form: URLSearchParams, key: string, value: FormValue): void {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => appendFormValue(form, `${key}[${index}]`, item));
    return;
  }

  if (typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value)) {
      appendFormValue(form, `${key}[${childKey}]`, childValue);
    }
    return;
  }

  form.append(key, String(value));
}

function buildFormBody(payload: Record<string, FormValue>): URLSearchParams {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    appendFormValue(form, key, value);
  }
  return form;
}

function buildAuthHeader(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

async function readStripeResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireStringInput(step: StepContext, key: string): string {
  const value = step.resolved_input[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Step ${step.step.id} requires input ${key} to be a non-empty string`);
  }

  return value;
}

function requireIntegerInput(step: StepContext, key: string): number {
  const value = step.resolved_input[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Step ${step.step.id} requires input ${key} to be an integer`);
  }

  return value;
}

function requireStringArrayInput(step: StepContext, key: string): string[] {
  const value = step.resolved_input[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Step ${step.step.id} requires input ${key} to be an array of strings`);
  }

  return value;
}

async function stripeRequest(
  config: StripeConfig,
  method: "GET" | "POST" | "DELETE",
  endpoint: string,
  payload: Record<string, FormValue> | undefined,
  idempotencyKey: string
): Promise<{ data: Record<string, unknown>; response: Response }> {
  const url = new URL(endpoint, config.apiBase);
  const headers = new Headers({
    Authorization: buildAuthHeader(config.secretKey)
  });

  let body: string | undefined;
  if (payload && method !== "GET") {
    const form = buildFormBody(payload);
    body = form.toString();
    headers.set("Content-Type", "application/x-www-form-urlencoded");
    headers.set("Idempotency-Key", idempotencyKey);
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ?? null
  });
  const parsed = await readStripeResponse(response);

  if (!response.ok) {
    const message =
      isRecord(parsed) && isRecord(parsed.error) && typeof parsed.error.message === "string"
        ? parsed.error.message
        : `Stripe request failed with ${response.status}`;

    throw new Error(`${method} ${url.toString()} failed: ${message}`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`Unexpected Stripe response for ${method} ${url.toString()}`);
  }

  return { data: parsed, response };
}

function buildVerificationResult(
  step: StepContext,
  observed_state: Record<string, unknown>,
  proofUri: string,
  status: "passed" | "failed" = "passed"
): VerificationResult {
  return {
    status,
    observed_state,
    proof: [
      {
        type: "stripe_object",
        uri: proofUri,
        metadata: {
          provider: step.step.provider,
          capability: step.capability.capability
        }
      }
    ],
    confidence: status === "passed" ? 0.99 : 0.2,
    verifier: step.capability.verifier.type,
    checked_at: formatTimestamp(new Date())
  };
}

export class StripeAdapter implements Adapter {
  readonly name = "stripe";
  private readonly config: StripeConfig;
  private readonly capabilities = exampleCapabilities.filter((capability) => capability.provider === "stripe");

  constructor(config: StripeConfig) {
    this.config = config;
  }

  static fromEnv(): StripeAdapter | undefined {
    const config = parseStripeConfig();
    return config ? new StripeAdapter(config) : undefined;
  }

  supports(): CapabilityDescriptor[] {
    return this.capabilities.map((capability) => ({
      capability: capability.capability,
      version: capability.version,
      provider: capability.provider,
      category: capability.category
    }));
  }

  async validate(_config: AdapterConfig): Promise<ValidationResult> {
    return { valid: Boolean(this.config.secretKey) };
  }

  async execute(step: StepContext): Promise<ExecutionResult> {
    const idempotencyKey = `${step.execution.id}:${step.step.id}:${step.attempt}`;

    switch (step.capability.capability) {
      case "billing.create_product": {
        const name = requireStringInput(step, "name");
        const priceCents = requireIntegerInput(step, "price_cents");
        const { data, response } = await stripeRequest(
          this.config,
          "POST",
          "/v1/products",
          {
            name,
            default_price_data: {
              currency: this.config.currency,
              unit_amount: priceCents
            }
          },
          idempotencyKey
        );

        const productId = typeof data.id === "string" ? data.id : undefined;
        const priceId = typeof data.default_price === "string" ? data.default_price : undefined;
        if (!productId || !priceId) {
          throw new Error("Stripe product creation response did not include id/default_price");
        }

        return {
          status: "succeeded",
          outputs: {
            product_id: productId,
            price_id: priceId
          },
          artifacts: [
            makeArtifact(step, "provider_response", response.url, {
              stripe_object: "product",
              product_id: productId,
              price_id: priceId
            })
          ],
          provider_response: data
        };
      }
      case "billing.configure_webhook": {
        const endpointUrl = requireStringInput(step, "endpoint_url");
        const events = requireStringArrayInput(step, "events");
        const { data, response } = await stripeRequest(
          this.config,
          "POST",
          "/v1/webhook_endpoints",
          {
            url: endpointUrl,
            enabled_events: events
          },
          idempotencyKey
        );

        const webhookId = typeof data.id === "string" ? data.id : undefined;
        if (!webhookId) {
          throw new Error("Stripe webhook creation response did not include id");
        }

        return {
          status: "succeeded",
          outputs: {
            webhook_id: webhookId
          },
          artifacts: [
            makeArtifact(step, "provider_response", response.url, {
              stripe_object: "webhook_endpoint",
              webhook_id: webhookId,
              endpoint_url: endpointUrl,
              enabled_events: events
            })
          ],
          provider_response: data
        };
      }
      default:
        return {
          status: "failed",
          outputs: {},
          error: `Stripe adapter does not support ${step.capability.capability}`
        };
    }
  }

  async verify(step: StepContext, result: ExecutionResult): Promise<VerificationResult> {
    switch (step.capability.capability) {
      case "billing.create_product": {
        const productId = typeof result.outputs.product_id === "string" ? result.outputs.product_id : undefined;
        if (!productId) {
          throw new Error("Missing product_id for Stripe product verification");
        }

        const { data, response } = await stripeRequest(
          this.config,
          "GET",
          `/v1/products/${productId}`,
          undefined,
          `${step.execution.id}:${step.step.id}:verify`
        );

        return buildVerificationResult(
          step,
          {
            product_id: data.id,
            name: data.name,
            active: data.active,
            default_price: data.default_price ?? result.outputs.price_id
          },
          response.url
        );
      }
      case "billing.configure_webhook": {
        const webhookId = typeof result.outputs.webhook_id === "string" ? result.outputs.webhook_id : undefined;
        if (!webhookId) {
          throw new Error("Missing webhook_id for Stripe webhook verification");
        }

        const { data, response } = await stripeRequest(
          this.config,
          "GET",
          `/v1/webhook_endpoints/${webhookId}`,
          undefined,
          `${step.execution.id}:${step.step.id}:verify`
        );

        return buildVerificationResult(
          step,
          {
            webhook_id: data.id,
            status: data.status,
            url: data.url,
            enabled_events: data.enabled_events
          },
          response.url
        );
      }
      default:
        return buildVerificationResult(step, result.outputs, "memory://unsupported", "failed");
    }
  }

  async rollback(step: StepContext, result: ExecutionResult): Promise<RollbackResult> {
    if (step.capability.capability !== "billing.configure_webhook") {
      return { status: "not_supported" };
    }

    const webhookId = typeof result.outputs.webhook_id === "string" ? result.outputs.webhook_id : undefined;
    if (!webhookId) {
      return { status: "failed", error: "Missing webhook_id for rollback" };
    }

    try {
      const { response } = await stripeRequest(
        this.config,
        "DELETE",
        `/v1/webhook_endpoints/${webhookId}`,
        undefined,
        `${step.execution.id}:${step.step.id}:rollback`
      );

      return {
        status: "rolled_back",
        artifacts: [
          makeArtifact(step, "diff_report", response.url, {
            action: "delete_webhook_endpoint",
            webhook_id: webhookId
          })
        ]
      };
    } catch (error: unknown) {
      return {
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
