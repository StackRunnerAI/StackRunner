import type { IsoDateTime, LooseString } from "./common.js";

export type ApprovalPolicy =
  | "production_deploy"
  | "paid_resource_creation"
  | "dns_change"
  | "destructive_delete"
  | "permission_escalation"
  | LooseString;

export type ApprovalStatus = "requested" | "approved" | "rejected" | "expired";

export interface Approval {
  required: boolean;
  policy: ApprovalPolicy;
  reason: string;
}

export interface ApprovalResult {
  status: ApprovalStatus;
  actor?: string;
  timestamp?: IsoDateTime;
  note?: string;
}
