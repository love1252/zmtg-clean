import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import {
  platformAiModelConfigData,
  type PlatformAiModelConfigCapabilityId,
  type PlatformAiModelConfigDryRunStatus,
  type PlatformAiModelConfigKeyStatus,
  type PlatformAiModelConfigModel,
  type PlatformAiModelConfigProvider,
  type PlatformAiModelConfigScenarioDefault,
} from '@/modules/open-platform/mock/platformAiModelConfig';
import type {
  PlatformAiModelConfigDryRunResult,
  PlatformAiModelConfigModelState,
  PlatformAiModelConfigModelWithProvider,
  PlatformAiModelConfigPersistedInput,
  PlatformAiModelConfigPersistedProvider,
  PlatformAiModelConfigPersistedResponse,
  PlatformAiModelConfigProviderState,
  PlatformAiModelConfigSaveResult,
  PlatformAiModelConfigScenarioDefaultPatch,
  PlatformAiModelConfigSnapshotRecord,
  PlatformAiModelConfigSnapshotRepository,
} from './platformAiModelConfigPersistenceTypes';

export const platformAiModelConfigSnapshotId = 'platform-ai-model-config-default';

const allowedDryRunStatuses = new Set<PlatformAiModelConfigDryRunStatus>([
  'dry_run',
  'disabled',
  'not_available',
]);
const allowedCapabilities = new Set<PlatformAiModelConfigCapabilityId>([
  'reasoning',
  'text',
  'vision',
  'embedding',
]);
const allowedDryRunTargets = new Set<PlatformAiModelConfigDryRunResult['targetType']>([
  'app_config',
  'provider_key',
  'provider_sync',
  'model_test',
  'all_config',
]);
const keyMaskPattern = /^Key 已配置 \*{4}[A-Za-z0-9]{4}$/;
const logoRefPattern = /^[A-Za-z0-9/_\-.]{1,256}$/;
const logoDataUrlPattern = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]{1,260000}$/;
const blockedTextPatterns = [
  /apiKey/,
  /encryptedKey/,
  /encryptedApiKey/,
  /ciphertext/,
  /authTag/,
  /DATABASE_URL/,
  /tenant_ai_config/,
  /decryptApiKey/,
  /\bsk-[A-Za-z0-9]{32,}\b/,
];

const catalogProviders = platformAiModelConfigData.providers;
const catalogModels = catalogProviders.flatMap((provider) => provider.models.map((model) => ({
  ...model,
  providerId: provider.providerId,
})));
const modelById = new Map(catalogModels.map((model) => [model.modelId, model]));
const providerById = new Map(catalogProviders.map((provider) => [provider.providerId, provider]));
const scenarioById = new Map(platformAiModelConfigData.scenarioDefaults.map((scenario) => [scenario.scenarioId, scenario]));

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasBlockedText(value: string) {
  return blockedTextPatterns.some((pattern) => pattern.test(value));
}

function isSafeShortText(value: string, maxLength = 160) {
  return value.length > 0 && value.length <= maxLength && !hasBlockedText(value);
}

function isAllowedLogoRef(value: string) {
  return logoRefPattern.test(value) || logoDataUrlPattern.test(value);
}

function normalizeScenarioDefaults(value: unknown): PlatformAiModelConfigScenarioDefaultPatch[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  const normalized: PlatformAiModelConfigScenarioDefaultPatch[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!isPlainRecord(item)) return null;
    const scenarioId = item.scenarioId;
    const defaultModelId = item.defaultModelId;
    if (typeof scenarioId !== 'string' || typeof defaultModelId !== 'string') return null;
    if (seen.has(scenarioId)) return null;

    const scenario = scenarioById.get(scenarioId);
    const model = modelById.get(defaultModelId);
    if (!scenario || !model || !model.capabilityIds.includes(scenario.requiredCapability)) return null;

    seen.add(scenarioId);
    normalized.push({ scenarioId, defaultModelId });
  }

  return normalized;
}

function normalizeModelStates(value: unknown): PlatformAiModelConfigModelState[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  const normalized: PlatformAiModelConfigModelState[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!isPlainRecord(item)) return null;
    const modelId = item.modelId;
    const enabled = item.enabled;
    if (typeof modelId !== 'string' || typeof enabled !== 'boolean') return null;
    if (seen.has(modelId) || !isSafeShortText(modelId, 128)) return null;

    seen.add(modelId);
    normalized.push({ modelId, enabled });
  }

  return normalized;
}

function normalizeSyncedModels(value: unknown): PlatformAiModelConfigModel[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  const normalized: PlatformAiModelConfigModel[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!isPlainRecord(item)) return null;
    const modelId = item.modelId;
    const displayName = item.displayName;
    const description = item.description;
    const pricingLabel = item.pricingLabel;
    const contextWindowLabel = item.contextWindowLabel;
    const capabilityIds = item.capabilityIds;
    const enabled = item.enabled;
    const testStatus = item.testStatus;

    if (typeof modelId !== 'string' || !isSafeShortText(modelId, 128) || seen.has(modelId)) return null;
    if (typeof displayName !== 'string' || !isSafeShortText(displayName, 80)) return null;
    if (typeof description !== 'string' || !isSafeShortText(description, 160)) return null;
    if (typeof pricingLabel !== 'string' || !isSafeShortText(pricingLabel, 32)) return null;
    if (typeof contextWindowLabel !== 'string' || !isSafeShortText(contextWindowLabel, 32)) return null;
    if (!Array.isArray(capabilityIds) || capabilityIds.length === 0) return null;
    if (!capabilityIds.every((capability): capability is PlatformAiModelConfigCapabilityId => (
      typeof capability === 'string' && allowedCapabilities.has(capability as PlatformAiModelConfigCapabilityId)
    ))) return null;
    if (typeof enabled !== 'boolean') return null;
    if (!allowedDryRunStatuses.has(testStatus as PlatformAiModelConfigDryRunStatus)) return null;

    seen.add(modelId);
    normalized.push({
      modelId,
      displayName,
      description,
      pricingLabel,
      contextWindowLabel,
      capabilityIds,
      enabled,
      testStatus: testStatus as PlatformAiModelConfigDryRunStatus,
    });
  }

  return normalized;
}

function normalizeKeyStatus(value: unknown): PlatformAiModelConfigKeyStatus | null {
  if (!isPlainRecord(value)) return null;
  const kind = value.kind;
  const maskedLabel = value.maskedLabel;

  if (kind !== 'masked_configured' && kind !== 'not_configured' && kind !== 'disabled') return null;
  if (typeof maskedLabel !== 'string') return null;
  if (kind === 'masked_configured' && !keyMaskPattern.test(maskedLabel)) return null;
  if (hasBlockedText(maskedLabel)) return null;

  return { kind, maskedLabel };
}

function normalizeProviderStates(value: unknown): PlatformAiModelConfigProviderState[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  const normalized: PlatformAiModelConfigProviderState[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!isPlainRecord(item)) return null;
    const providerId = item.providerId;
    if (typeof providerId !== 'string' || seen.has(providerId) || !providerById.has(providerId)) return null;

    const logoRef = item.logoRef;
    const keyStatus = item.keyStatus;
    const syncStatus = item.syncStatus;
    const syncedModels = item.syncedModels;
    const normalizedSyncedModels = normalizeSyncedModels(syncedModels);

    if (logoRef !== undefined && logoRef !== null && (typeof logoRef !== 'string' || !isAllowedLogoRef(logoRef) || hasBlockedText(logoRef))) {
      return null;
    }
    if (keyStatus !== undefined && normalizeKeyStatus(keyStatus) === null) return null;
    if (syncStatus !== undefined && (!allowedDryRunStatuses.has(syncStatus as PlatformAiModelConfigDryRunStatus))) return null;
    if (normalizedSyncedModels === null) return null;

    seen.add(providerId);
    normalized.push({
      providerId,
      ...(typeof logoRef === 'string' ? { logoRef } : logoRef === null ? { logoRef: null } : {}),
      ...(keyStatus === undefined ? {} : { keyStatus: normalizeKeyStatus(keyStatus) as PlatformAiModelConfigKeyStatus }),
      ...(syncStatus === undefined ? {} : { syncStatus: syncStatus as PlatformAiModelConfigDryRunStatus }),
      ...(syncedModels === undefined ? {} : { syncedModels: normalizedSyncedModels }),
    });
  }

  return normalized;
}

function normalizeDryRunResults(value: unknown): PlatformAiModelConfigDryRunResult[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  const normalized: PlatformAiModelConfigDryRunResult[] = [];

  for (const item of value) {
    if (!isPlainRecord(item)) return null;
    const { targetType, targetId, status, message, occurredAt } = item;
    if (!allowedDryRunTargets.has(targetType as PlatformAiModelConfigDryRunResult['targetType'])) return null;
    if (typeof targetId !== 'string' || targetId.length === 0 || targetId.length > 128 || hasBlockedText(targetId)) return null;
    if (!allowedDryRunStatuses.has(status as PlatformAiModelConfigDryRunStatus)) return null;
    if (typeof message !== 'string' || message.length === 0 || message.length > 160 || hasBlockedText(message)) return null;
    if (occurredAt !== undefined && occurredAt !== null && typeof occurredAt !== 'string') return null;

    normalized.push({
      targetType: targetType as PlatformAiModelConfigDryRunResult['targetType'],
      targetId,
      status: status as PlatformAiModelConfigDryRunStatus,
      message,
      ...(typeof occurredAt === 'string' ? { occurredAt } : {}),
    });
  }

  return normalized;
}

function normalizeInput(input: PlatformAiModelConfigPersistedInput) {
  const scenarioDefaults = normalizeScenarioDefaults(input.scenarioDefaults);
  const modelStates = normalizeModelStates(input.modelStates);
  const providerStates = normalizeProviderStates(input.providerStates);
  const dryRunResults = normalizeDryRunResults(input.dryRunResults);

  if (!scenarioDefaults || !modelStates || !providerStates || !dryRunResults) return null;

  return {
    scenarioDefaults,
    modelStates,
    providerStates,
    dryRunResults,
    agentInheritance: platformAiModelConfigData.agentInheritance,
  };
}

function scenarioDefaultsFromRecord(record: PlatformAiModelConfigSnapshotRecord | null) {
  const persisted = new Map((record?.scenarioDefaults ?? []).map((item) => [item.scenarioId, item.defaultModelId]));

  return platformAiModelConfigData.scenarioDefaults.map((scenario): PlatformAiModelConfigScenarioDefault => {
    const defaultModelId = persisted.get(scenario.scenarioId) ?? scenario.defaultModelId;
    const model = modelById.get(defaultModelId);

    return {
      ...scenario,
      defaultModelId,
      defaultModelName: model?.displayName ?? scenario.defaultModelName,
    };
  });
}

function modelsForProvider(
  provider: PlatformAiModelConfigProvider,
  modelStateById: Map<string, boolean>,
  syncedModels: PlatformAiModelConfigModel[] = [],
) {
  const mergedById = new Map<string, PlatformAiModelConfigModel>();
  [...provider.models, ...syncedModels].forEach((model) => {
    mergedById.set(model.modelId, model);
  });

  return [...mergedById.values()].map((model) => ({
    ...model,
    enabled: modelStateById.get(model.modelId) ?? model.enabled,
  }));
}

function providersFromRecord(record: PlatformAiModelConfigSnapshotRecord | null): PlatformAiModelConfigPersistedProvider[] {
  const modelStateById = new Map((record?.modelStates ?? []).map((model) => [model.modelId, model.enabled]));
  const providerStateById = new Map((record?.providerStates ?? []).map((provider) => [provider.providerId, provider]));

  return platformAiModelConfigData.providers.map((provider) => {
    const providerState = providerStateById.get(provider.providerId);

    return {
      ...provider,
      logoRef: providerState?.logoRef ?? null,
      keyStatus: providerState?.keyStatus ?? provider.keyStatus,
      syncStatus: providerState?.syncStatus ?? provider.syncStatus,
      models: modelsForProvider(provider, modelStateById, providerState?.syncedModels),
    };
  });
}

function toScenarioPatches(scenarios: PlatformAiModelConfigScenarioDefault[]): PlatformAiModelConfigScenarioDefaultPatch[] {
  return scenarios.map((scenario) => ({
    scenarioId: scenario.scenarioId,
    defaultModelId: scenario.defaultModelId,
  }));
}

function toModelStates(models: PlatformAiModelConfigModelWithProvider[]): PlatformAiModelConfigModelState[] {
  return models.map((model) => ({ modelId: model.modelId, enabled: model.enabled }));
}

function toProviderStates(providers: PlatformAiModelConfigPersistedProvider[]): PlatformAiModelConfigProviderState[] {
  return providers.map((provider) => ({
    providerId: provider.providerId,
    logoRef: provider.logoRef,
    keyStatus: provider.keyStatus,
    syncStatus: provider.syncStatus,
    syncedModels: provider.models.filter((model) => !modelById.has(model.modelId)),
  }));
}

function mergeRecord(
  currentView: PlatformAiModelConfigPersistedResponse,
  normalized: NonNullable<ReturnType<typeof normalizeInput>>,
  input: PlatformAiModelConfigPersistedInput,
  accessUserId: string,
  now: Date,
) {
  const scenarioPatchById = new Map(normalized.scenarioDefaults.map((item) => [item.scenarioId, item.defaultModelId]));
  const modelPatchById = new Map(normalized.modelStates.map((item) => [item.modelId, item.enabled]));
  const providerPatchById = new Map(normalized.providerStates.map((item) => [item.providerId, item]));

  const nextScenarios = currentView.scenarioDefaults.map((scenario) => {
    const defaultModelId = scenarioPatchById.get(scenario.scenarioId) ?? scenario.defaultModelId;
    const model = modelById.get(defaultModelId);
    return {
      ...scenario,
      defaultModelId,
      defaultModelName: model?.displayName ?? scenario.defaultModelName,
    };
  });

  const nextProviders = currentView.providers.map((provider) => {
    const patch = providerPatchById.get(provider.providerId);
    return {
      ...provider,
      logoRef: patch && 'logoRef' in patch ? patch.logoRef ?? null : provider.logoRef,
      keyStatus: patch?.keyStatus ?? provider.keyStatus,
      syncStatus: patch?.syncStatus ?? provider.syncStatus,
      models: (patch?.syncedModels
        ? modelsForProvider(provider, modelPatchById, patch.syncedModels)
        : provider.models
      ).map((model) => ({
        ...model,
        enabled: modelPatchById.get(model.modelId) ?? model.enabled,
      })),
    };
  });
  const allModels = nextProviders.flatMap((provider) => provider.models.map((model) => ({
    ...model,
    providerId: provider.providerId,
  })));

  return {
    id: platformAiModelConfigSnapshotId,
    scenarioDefaults: toScenarioPatches(nextScenarios),
    agentInheritance: input.agentInheritance ?? currentView.agentInheritance,
    modelStates: toModelStates(allModels),
    providerStates: toProviderStates(nextProviders),
    dryRunResults: normalized.dryRunResults.length > 0 ? normalized.dryRunResults : currentView.dryRunResults,
    updatedBy: accessUserId,
    updatedAt: now,
  };
}

function responseFromRecord(record: PlatformAiModelConfigSnapshotRecord | null): PlatformAiModelConfigPersistedResponse {
  const providers = providersFromRecord(record);
  const scenarioDefaults = scenarioDefaultsFromRecord(record);
  const enabledModelCount = providers.flatMap((provider) => provider.models).filter((model) => model.enabled).length;
  const configuredProviderCount = providers.filter((provider) => provider.keyStatus.kind === 'masked_configured').length;

  return {
    readonly: false,
    userActionsEnabled: true,
    dataSource: 'persisted_boundary',
    operationMode: 'persisted_dry_run',
    persistenceMode: 'database',
    externalCallMode: 'blocked',
    dataExposureMode: 'masked_only',
    configVersion: platformAiModelConfigData.configVersion,
    title: platformAiModelConfigData.title,
    subtitle: platformAiModelConfigData.subtitle,
    readonlyNote: '当前已接入平台持久化边界：保存配置、模型启用、Logo 引用和 dry-run 结果；不解密 Key、不同步厂商模型、不测试真实模型。',
    summary: {
      enabledModelCount,
      configuredProviderCount,
      defaultScenarioCount: scenarioDefaults.length,
    },
    capabilityOrder: platformAiModelConfigData.capabilityOrder,
    capabilityLabels: platformAiModelConfigData.capabilityLabels,
    providers,
    scenarioDefaults,
    agentInheritance: record?.agentInheritance ?? platformAiModelConfigData.agentInheritance,
    dryRunResults: record?.dryRunResults ?? [],
    updatedAt: record?.updatedAt.toISOString() ?? null,
  };
}

export async function getPlatformAiModelConfigPersistedView(input: {
  repository: Pick<PlatformAiModelConfigSnapshotRepository, 'findSnapshot'>;
}) {
  return responseFromRecord(await input.repository.findSnapshot());
}

export async function savePlatformAiModelConfigPersistedView(input: {
  repository: PlatformAiModelConfigSnapshotRepository;
  accessContext: AccessContext;
  input: PlatformAiModelConfigPersistedInput;
  now?: Date;
}): Promise<PlatformAiModelConfigSaveResult> {
  const accessDecision = canAccessResource({
    context: input.accessContext,
    resource: 'ai_model_config',
    action: 'update',
  });
  if (!accessDecision.allowed) {
    return { status: 'permission_denied', payload: { ok: false, errorCode: 'FORBIDDEN' } };
  }

  const normalized = normalizeInput(input.input);
  if (!normalized) {
    return { status: 'validation_failed', payload: { ok: false, errorCode: 'VALIDATION_FAILED' } };
  }

  const currentRecord = await input.repository.findSnapshot();
  const currentView = responseFromRecord(currentRecord);
  const nextRecord = mergeRecord(
    currentView,
    normalized,
    input.input,
    input.accessContext.userId,
    input.now ?? new Date(),
  );
  const saved = await input.repository.upsertSnapshot(nextRecord);

  return { status: 'saved', payload: responseFromRecord(saved) };
}
