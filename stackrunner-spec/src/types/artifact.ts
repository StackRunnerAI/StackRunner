export type ArtifactType =
  | "provider_response"
  | "deployment_url"
  | "env_file"
  | "migration_log"
  | "verification_proof"
  | "diff_report"
  | (string & {});

export interface Artifact {
  id: string;
  step_id: string;
  type: ArtifactType;
  uri: string;
  metadata: Record<string, unknown>;
}
