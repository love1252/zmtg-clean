import type { AccessContext } from '@/modules/security/domain/access-control';
import type { AttributedTenantAuditEventV1 } from '@/modules/audit/domain/audit-events';
import type {
  PlatformAiModelConfigAgentInheritance,
  PlatformAiModelConfigDryRunStatus,
  PlatformAiModelConfigKeyStatus,
  PlatformAiModelConfigModel,
  PlatformAiModelConfigProvider,
  PlatformAiModelConfigScenarioDefault,
} from '@/modules/open-platform/mock/platformAiModelConfig';

export type PlatformAiModelConfigScenarioDefaultPatch = {
  scenarioId: string;
  defaultModelId: string;
};

export type PlatformAiModelConfigModelState = {
  modelId: string;
  enabled: boolean;
};

export type PlatformAiModelConfigProviderState = {
  providerId: string;
  logoRef?: string | null;
  keyStatus?: PlatformAiModelConfigKeyStatus;
  syncStatus?: PlatformAiModelConfigDryRunStatus;
  syncedModels?: PlatformAiModelConfigModel[];
};

export type PlatformAiModelConfigDryRunResult = {
  targetType: 'app_config' | 'provider_key' | 'provider_sync' | 'model_test' | 'all_config';
  targetId: string;
  status: PlatformAiModelConfigDryRunStatus;
  message: string;
  occurredAt?: string | null;
};

export type PlatformAiModelConfigPersistedInput = {
  scenarioDefaults?: PlatformAiModelConfigScenarioDefaultPatch[];
  agentInheritance?: PlatformAiModelConfigAgentInheritance[];
  modelStates?: PlatformAiModelConfigModelState[];
  providerStates?: PlatformAiModelConfigProviderState[];
  dryRunResults?: PlatformAiModelConfigDryRunResult[];
};

export type PlatformAiModelConfigPersistedProvider = PlatformAiModelConfigProvider & {
  logoRef: string | null;
};

export type PlatformAiModelConfigPersistedResponse = {
  readonly: false;
  userActionsEnabled: true;
  dataSource: 'persisted_boundary';
  operationMode: 'persisted_dry_run';
  persistenceMode: 'database';
  externalCallMode: 'blocked';
  dataExposureMode: 'masked_only';
  configVersion: string;
  title: string;
  subtitle: string;
  readonlyNote: string;
  summary: {
    enabledModelCount: number;
    configuredProviderCount: number;
    defaultScenarioCount: number;
  };
  capabilityOrder: Array<'reasoning' | 'text' | 'vision' | 'embedding'>;
  capabilityLabels: Record<'reasoning' | 'text' | 'vision' | 'embedding', string>;
  providers: PlatformAiModelConfigPersistedProvider[];
  scenarioDefaults: PlatformAiModelConfigScenarioDefault[];
  agentInheritance: PlatformAiModelConfigAgentInheritance[];
  dryRunResults: PlatformAiModelConfigDryRunResult[];
  updatedAt: string | null;
};

export type PlatformAiModelConfigSnapshotRecord = {
  id: string;
  scenarioDefaults: PlatformAiModelConfigScenarioDefaultPatch[];
  agentInheritance: PlatformAiModelConfigAgentInheritance[];
  modelStates: PlatformAiModelConfigModelState[];
  providerStates: PlatformAiModelConfigProviderState[];
  dryRunResults: PlatformAiModelConfigDryRunResult[];
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PlatformAiModelConfigSnapshotUpsertInput = Omit<
  PlatformAiModelConfigSnapshotRecord,
  'createdAt'
>;

export type PlatformAiModelConfigSnapshotRepository = {
  findSnapshot(): Promise<PlatformAiModelConfigSnapshotRecord | null>;
  upsertSnapshot(input: PlatformAiModelConfigSnapshotUpsertInput): Promise<PlatformAiModelConfigSnapshotRecord>;
};

export type PlatformAiModelConfigAuditRepository = {
  recordAttributed(event: AttributedTenantAuditEventV1): Promise<void>;
};

export type PlatformAiModelConfigSaveResult =
  | { status: 'saved'; payload: PlatformAiModelConfigPersistedResponse }
  | { status: 'validation_failed'; payload: { ok: false; errorCode: 'VALIDATION_FAILED' } }
  | { status: 'permission_denied'; payload: { ok: false; errorCode: 'FORBIDDEN' } };

export type PlatformAiModelConfigPersistenceAccessInput = {
  accessContext: AccessContext;
};

export type PlatformAiModelConfigModelWithProvider = PlatformAiModelConfigModel & {
  providerId: string;
};
