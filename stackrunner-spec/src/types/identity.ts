import type { ConditionClause, IsoDateTime, LooseString } from "./common.js";

export type IdentityType = "agent" | "user" | "service";

export interface PermissionGrant {
  resource: string;
  actions: string[];
  delegated_by?: string;
  reason?: string;
  expires_at?: IsoDateTime;
  conditions?: ConditionClause[];
}

export interface AgentIdentity {
  id: string;
  type: IdentityType;
  display_name?: string;
  scopes: string[];
  permissions: PermissionGrant[];
  delegated_by?: string;
  attributes?: Record<string, LooseString | number | boolean>;
}
