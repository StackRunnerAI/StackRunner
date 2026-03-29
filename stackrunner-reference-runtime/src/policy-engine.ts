import type {
  AgentIdentity,
  PolicyContext,
  PolicyDecision,
  PolicyEffect,
  PolicyPredicate,
  PolicyRule,
  PolicySet
} from "stackrunner-spec";
import { formatTimestamp } from "./utils.js";

export interface PolicyEvaluationResult {
  final: PolicyDecision;
  decisions: PolicyDecision[];
}

export const defaultPolicySet: PolicySet = {
  version: 1,
  name: "default-runtime-policy",
  default_effect: "allow",
  rules: [
    {
      id: "explicit-approval-policy",
      effect: "require_approval",
      reason: "Capability or runbook step declares an approval policy.",
      match: [{ field: "approval_policy", operator: "exists" }]
    },
    {
      id: "high-risk-requires-approval",
      effect: "require_approval",
      reason: "High-risk actions require approval.",
      match: [{ field: "risk_level", operator: "in", value: ["high", "critical"] }]
    },
    {
      id: "delegated-sensitive-scope-requires-approval",
      effect: "require_approval",
      reason: "Delegated permissions touching sensitive categories require approval.",
      match: [
        { field: "delegated", operator: "equals", value: true },
        { field: "category", operator: "in", value: ["billing", "dns", "database", "secrets"] }
      ]
    }
  ]
};

function lookup(path: string, context: Record<string, unknown>): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[key];
    }

    return undefined;
  }, context);
}

function matchesPredicate(predicate: PolicyPredicate, context: Record<string, unknown>): boolean {
  const value = lookup(predicate.field, context);

  switch (predicate.operator) {
    case "exists":
      return value !== undefined && value !== null && value !== "";
    case "equals":
      return value === predicate.value;
    case "includes":
      return Array.isArray(value)
        ? value.includes(predicate.value)
        : typeof value === "string" && typeof predicate.value === "string" && value.includes(predicate.value);
    case "in":
      return Array.isArray(predicate.value) && predicate.value.includes(value);
    case "gte":
      return typeof value === "number" && typeof predicate.value === "number" && value >= predicate.value;
    case "lte":
      return typeof value === "number" && typeof predicate.value === "number" && value <= predicate.value;
    default:
      return false;
  }
}

function matchesResource(pattern: string, context: PolicyContext): boolean {
  if (pattern === "*") {
    return true;
  }

  if (pattern.startsWith("capability:")) {
    const expected = pattern.slice("capability:".length);
    return wildcardMatches(expected, context.capability);
  }

  if (pattern.startsWith("category:")) {
    const expected = pattern.slice("category:".length);
    return wildcardMatches(expected, context.category);
  }

  if (pattern.startsWith("provider:")) {
    const expected = pattern.slice("provider:".length);
    return wildcardMatches(expected, context.provider);
  }

  return false;
}

function wildcardMatches(pattern: string, actual: string): boolean {
  if (pattern === "*") {
    return true;
  }

  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(actual);
}

function hasPermission(actor: AgentIdentity, action: string, context: PolicyContext): boolean {
  return actor.permissions.some((grant) => {
    if (!matchesResource(grant.resource, context)) {
      return false;
    }

    return grant.actions.includes("*") || grant.actions.includes(action);
  });
}

function decision(effect: PolicyEffect, reason: string, actor: AgentIdentity, matched: boolean, policyId?: string): PolicyDecision {
  return {
    effect,
    reason,
    actor_id: actor.id,
    evaluated_at: formatTimestamp(new Date()),
    matched,
    ...(policyId ? { policy_id: policyId } : {})
  };
}

export function evaluatePolicy(
  context: PolicyContext,
  policySet: PolicySet = defaultPolicySet
): PolicyEvaluationResult {
  const decisions: PolicyDecision[] = [];

  if (!hasPermission(context.actor, "execute", context)) {
    const denial = decision("deny", "Actor lacks permission for this capability.", context.actor, true, "permission-deny");
    decisions.push(denial);
    return { final: denial, decisions };
  }

  const evaluationContext: Record<string, unknown> = {
    ...context,
    actor: {
      id: context.actor.id,
      scopes: context.actor.scopes
    }
  };

  for (const rule of policySet.rules) {
    if (rule.match.every((predicate) => matchesPredicate(predicate, evaluationContext))) {
      decisions.push(decision(rule.effect, rule.reason, context.actor, true, rule.id));
    }
  }

  const final =
    decisions.find((item) => item.effect === "deny") ??
    decisions.find((item) => item.effect === "require_approval") ??
    decision(policySet.default_effect ?? "allow", "No policy rule blocked the action.", context.actor, false);

  if (decisions.length === 0) {
    decisions.push(final);
  }

  return { final, decisions };
}
