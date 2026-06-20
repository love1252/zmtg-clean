'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Brain,
  Check,
  ChevronRight,
  Cpu,
  Eye,
  FileText,
  Image as ImageIcon,
  Key,
  LockKeyhole,
  RefreshCw,
  Sparkles,
  Target,
  Upload,
  Waypoints,
} from 'lucide-react';
import {
  getSupportedVendorConfig,
  type SupportedVendor,
} from '@/modules/open-platform/domain/vendor-catalog';
import {
  platformAiModelConfigData,
  type PlatformAiModelConfigCapabilityId,
  type PlatformAiModelConfigDryRunStatus,
  type PlatformAiModelConfigKeyStatus,
  type PlatformAiModelConfigProvider,
} from '@/modules/open-platform/mock/platformAiModelConfig';
import type { PlatformAiModelConfigPersistedInput, PlatformAiModelConfigPersistedResponse } from '@/modules/open-platform/server/platformAiModelConfigPersistenceTypes';
import { cn } from '@/shared/utils/cn';

type CapabilityId = PlatformAiModelConfigCapabilityId;

const operationStatusLabel: Record<PlatformAiModelConfigDryRunStatus, string> = {
  dry_run: '可执行',
  disabled: 'disabled',
  not_available: 'not_available',
};

const capabilityMeta: Record<CapabilityId, { label: string; icon: typeof Brain; className: string }> = {
  reasoning: { label: '深度思考', icon: Brain, className: 'bg-purple-50 text-purple-700 border-purple-100' },
  text: { label: '文本生成', icon: FileText, className: 'bg-blue-50 text-blue-700 border-blue-100' },
  vision: { label: '视觉理解', icon: Eye, className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  embedding: { label: '向量模型', icon: Waypoints, className: 'bg-pink-50 text-pink-700 border-pink-100' },
};

const aiModelConfigView = platformAiModelConfigData;
const aiModelConfigPersistenceEndpoint = '/api/v1/open-platform/ai-model-config';
const aiModelConfigSyncEndpoint = `${aiModelConfigPersistenceEndpoint}/sync`;
const aiModelConfigTestEndpoint = `${aiModelConfigPersistenceEndpoint}/test`;
const providerConfigsEndpoint = '/api/v1/open-platform/provider-configs';

type VendorOperationPayload = {
  ok?: boolean;
  status?: 'success' | 'failed' | 'timeout' | 'not_configured' | 'rate_limited' | 'provider_unavailable';
  errorCode?: string | null;
};

const allowedLogoImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const maxLogoImageBytes = 150 * 1024;

function isDisplayableLogoRef(value: string | null | undefined) {
  if (!value) return false;
  return value.startsWith('data:image/png;base64,')
    || value.startsWith('data:image/jpeg;base64,')
    || value.startsWith('data:image/webp;base64,')
    || value.startsWith('/');
}

export function OpenPlatformAiModelConfigPanel() {
  const [configView, setConfigView] = useState(aiModelConfigView);
  const allConfigModels = configView.providers.flatMap((provider) => provider.models);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [expandedCapabilities, setExpandedCapabilities] = useState<Record<string, boolean>>({});
  const [scenarioModelById, setScenarioModelById] = useState<Record<string, string>>(() => Object.fromEntries(
    platformAiModelConfigData.scenarioDefaults.map((scenario) => [scenario.scenarioId, scenario.defaultModelId]),
  ));
  const [modelEnabledById, setModelEnabledById] = useState<Record<string, boolean>>(() => Object.fromEntries(
    platformAiModelConfigData.providers.flatMap((provider) => provider.models).map((model) => [model.modelId, model.enabled]),
  ));
  const [logoPreviewByProvider, setLogoPreviewByProvider] = useState<Record<string, string>>({});
  const [logoFileNameByProvider, setLogoFileNameByProvider] = useState<Record<string, string>>({});
  const [keyDraftByProvider, setKeyDraftByProvider] = useState<Record<string, string>>({});
  const [keyDraftSavedByProvider, setKeyDraftSavedByProvider] = useState<Record<string, boolean>>({});
  const [keyStatusByProvider, setKeyStatusByProvider] = useState<Record<string, PlatformAiModelConfigKeyStatus>>({});
  const [showKeyValueByProvider, setShowKeyValueByProvider] = useState<Record<string, boolean>>({});
  const [providerStatusById, setProviderStatusById] = useState<Record<string, string[]>>({});
  const [testStatusByModelId, setTestStatusByModelId] = useState<Record<string, string>>({});
  const [showScenarioPresets, setShowScenarioPresets] = useState(false);
  const [scenarioPresetStatus, setScenarioPresetStatus] = useState<string | null>(null);
  const [appConfigStatus, setAppConfigStatus] = useState<string | null>(null);
  const [allConfigStatus, setAllConfigStatus] = useState<string | null>(null);
  const capabilityHeaderRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const providerKeyTouchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function loadPersistedConfig() {
      try {
        const response = await fetch(aiModelConfigPersistenceEndpoint, { method: 'GET' });
        if (!response.ok) return;

        const payload = await response.json() as Partial<PlatformAiModelConfigPersistedResponse>;
        if (cancelled) return;

        const persistedScenarios = payload.scenarioDefaults;
        const persistedProviders = payload.providers;

        if (Array.isArray(persistedProviders) && Array.isArray(persistedScenarios)) {
          setConfigView((current) => ({
            ...current,
            ...(typeof payload.title === 'string' ? { title: payload.title } : {}),
            ...(typeof payload.subtitle === 'string' ? { subtitle: payload.subtitle } : {}),
            ...(typeof payload.readonlyNote === 'string' ? { readonlyNote: payload.readonlyNote } : {}),
            ...(payload.summary ? { summary: payload.summary } : {}),
            providers: persistedProviders,
            scenarioDefaults: persistedScenarios,
            ...(Array.isArray(payload.agentInheritance) ? { agentInheritance: payload.agentInheritance } : {}),
            ...(Array.isArray(payload.capabilityOrder) ? { capabilityOrder: payload.capabilityOrder } : {}),
            ...(payload.capabilityLabels ? { capabilityLabels: payload.capabilityLabels } : {}),
          }));
        }

        if (Array.isArray(persistedScenarios)) {
          setScenarioModelById((current) => ({
            ...current,
            ...Object.fromEntries(persistedScenarios.map((scenario) => [scenario.scenarioId, scenario.defaultModelId])),
          }));
        }

        if (Array.isArray(persistedProviders)) {
          setModelEnabledById((current) => ({
            ...current,
            ...Object.fromEntries(persistedProviders.flatMap((provider) => provider.models.map((model) => [model.modelId, model.enabled]))),
          }));
          setKeyStatusByProvider((current) => ({
            ...current,
            ...Object.fromEntries(persistedProviders
              .filter((provider) => !providerKeyTouchedRef.current.has(provider.providerId))
              .map((provider) => [provider.providerId, provider.keyStatus])),
          }));
          setLogoPreviewByProvider((current) => ({
            ...current,
            ...Object.fromEntries(persistedProviders
              .filter((provider) => provider.logoRef)
              .map((provider) => [provider.providerId, provider.logoRef as string])),
          }));
        }
      } catch {
        // The panel keeps the controlled mock baseline when persistence is unavailable.
      }
    }

    void loadPersistedConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  function getModelById(modelId: string) {
    return allConfigModels.find((model) => model.modelId === modelId);
  }

  function getCapabilityKey(providerId: string, capabilityId: CapabilityId) {
    return `${providerId}:${capabilityId}`;
  }

  function isModelEnabled(modelId: string) {
    return modelEnabledById[modelId] ?? false;
  }

  function getScenarioModelOptions(capabilityId: CapabilityId) {
    return allConfigModels.filter((model) => model.capabilityIds.includes(capabilityId) && isModelEnabled(model.modelId));
  }

  function getSelectedScenarioModelName(scenarioId: string) {
    return getModelById(scenarioModelById[scenarioId])?.displayName ?? '未选择';
  }

  function getProviderKeyStatus(provider: PlatformAiModelConfigProvider) {
    return keyStatusByProvider[provider.providerId] ?? provider.keyStatus;
  }

  function getMaskedTailFromProvider(provider: PlatformAiModelConfigProvider) {
    const maskedLabel = getProviderKeyStatus(provider).maskedLabel;
    return maskedLabel.match(/\*{4}[A-Za-z0-9]{4}$/)?.[0] ?? null;
  }

  function getMaskedTailFromRawKey(rawKey: string) {
    return rawKey.length >= 4 ? `****${rawKey.slice(-4)}` : '****';
  }

  function getKeyInputValue(provider: PlatformAiModelConfigProvider) {
    const providerId = provider.providerId;
    const keyDraft = keyDraftByProvider[providerId] ?? '';

    if (keyDraft) {
      if (showKeyValueByProvider[providerId]) return keyDraft;

      const draftStateLabel = keyDraftSavedByProvider[providerId] ? '已保存' : '新 Key';
      return `${draftStateLabel} ${getMaskedTailFromRawKey(keyDraft)}`;
    }

    const maskedTail = getMaskedTailFromProvider(provider);
    return maskedTail ? `已保存 ${maskedTail}` : '';
  }

  function getKeyInputPlaceholder() {
    return '输入新 Key';
  }

  function getProviderLogoRef(providerId: string) {
    return logoPreviewByProvider[providerId] ?? null;
  }

  function renderProviderLogo(provider: PlatformAiModelConfigProvider, className: string) {
    const logoRef = getProviderLogoRef(provider.providerId);
    if (isDisplayableLogoRef(logoRef)) {
      return (
        // eslint-disable-next-line @next/next/no-img-element -- User-uploaded data URL previews cannot go through next/image optimization.
        <img
          src={logoRef}
          alt={`${provider.providerName} Logo`}
          className={cn('object-contain bg-white', className)}
        />
      );
    }

    return (
      <div className={cn('grid place-items-center font-bold text-white', provider.logoClassName, className)}>
        {provider.logoText}
      </div>
    );
  }

  function getScenarioDefaultPatches(nextScenarioModelById = scenarioModelById) {
    return configView.scenarioDefaults.map((scenario) => ({
      scenarioId: scenario.scenarioId,
      defaultModelId: nextScenarioModelById[scenario.scenarioId] ?? scenario.defaultModelId,
    }));
  }

  function getModelStates() {
    return allConfigModels.map((model) => ({ modelId: model.modelId, enabled: isModelEnabled(model.modelId) }));
  }

  function getProviderStates(overrides: Array<{ providerId: string } & Partial<{
    logoRef: string | null;
    keyStatus: PlatformAiModelConfigKeyStatus;
    syncStatus: PlatformAiModelConfigDryRunStatus;
  }>> = []) {
    const overrideByProvider = new Map(overrides.map((override) => [override.providerId, override]));

    return configView.providers.map((provider) => {
      const override = overrideByProvider.get(provider.providerId);
      return {
        providerId: provider.providerId,
        logoRef: override && 'logoRef' in override ? override.logoRef ?? null : logoPreviewByProvider[provider.providerId] ?? null,
        keyStatus: override?.keyStatus ?? getProviderKeyStatus(provider),
        syncStatus: override?.syncStatus ?? provider.syncStatus,
      };
    });
  }

  async function persistConfig(input: PlatformAiModelConfigPersistedInput) {
    try {
      const response = await fetch(aiModelConfigPersistenceEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) return false;

      const payload = await response.json().catch(() => null) as { ok?: boolean } | null;
      return payload?.ok !== false;
    } catch {
      // The optimistic UI remains available even if the persistence boundary is unavailable.
      return false;
    }
  }

  async function saveAppConfig(message: string) {
    setAppConfigStatus('应用配置保存中...');
    const saved = await persistConfig({
      scenarioDefaults: getScenarioDefaultPatches(),
      dryRunResults: [{
        targetType: 'app_config',
        targetId: 'application-defaults',
        status: 'dry_run',
        message,
      }],
    });
    setAppConfigStatus(saved ? message : '应用配置保存失败：持久化服务不可用');
  }

  async function saveAllConfig(message: string) {
    setAllConfigStatus('全部配置保存中...');
    const saved = await persistConfig({
      scenarioDefaults: getScenarioDefaultPatches(),
      modelStates: getModelStates(),
      providerStates: getProviderStates(),
      dryRunResults: [{
        targetType: 'all_config',
        targetId: 'all-config',
        status: 'dry_run',
        message,
      }],
    });
    setAllConfigStatus(saved ? message : '全部配置保存失败：持久化服务不可用');
  }

  function getSaveStatusClassName(status: string) {
    if (status.includes('失败')) return 'text-red-700';
    if (status.includes('保存中')) return 'text-blue-700';
    return 'text-green-700';
  }

  function keepHeaderInPlace(header: HTMLElement | null, update: () => void) {
    if (typeof window === 'undefined' || !header) {
      update();
      return;
    }

    const beforeTop = header.getBoundingClientRect().top;
    update();

    const afterFrame = window.requestAnimationFrame ?? ((callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0));
    afterFrame(() => {
      const afterTop = header.getBoundingClientRect().top;
      const scrollDelta = afterTop - beforeTop;
      if (scrollDelta === 0) return;

      try {
        window.scrollBy({ top: scrollDelta });
      } catch {
        // jsdom exposes scrollBy but does not implement it.
      }
    });
  }

  function isCapabilityExpanded(providerId: string, capabilityId: CapabilityId) {
    return expandedCapabilities[getCapabilityKey(providerId, capabilityId)] ?? false;
  }

  function toggleCapability(providerId: string, capabilityId: CapabilityId) {
    const capabilityKey = getCapabilityKey(providerId, capabilityId);

    keepHeaderInPlace(capabilityHeaderRefs.current[capabilityKey] ?? null, () => {
      setExpandedCapabilities((current) => ({ ...current, [capabilityKey]: !current[capabilityKey] }));
    });
  }

  function updateScenarioModel(scenarioId: string, modelId: string) {
    setScenarioModelById((current) => ({ ...current, [scenarioId]: modelId }));
    setAppConfigStatus(null);
  }

  async function applyScenarioPreset(presetName: string) {
    const presetScenarioModels: Record<string, Record<string, string>> = {
      智能随访: {
        'ai-customer-service': 'doubao-seed-2-0-lite-260215',
        'ai-followup': 'doubao-seed-2-0-pro-260215',
        'ai-appointment': 'deepseek-v4-flash',
      },
      运营分析: {
        'workflow-decision': 'deepseek-v4-pro',
        'analytics-insight': 'glm-5.1',
        'knowledge-qa': 'qwen-plus-latest',
      },
    };
    const nextScenarioModelById = {
      ...scenarioModelById,
      ...(presetScenarioModels[presetName] ?? {}),
    };

    setScenarioModelById(nextScenarioModelById);
    setScenarioPresetStatus('场景预设保存中...');
    setAppConfigStatus(null);
    const message = `场景预设已保存：${presetName}`;
    const saved = await persistConfig({
      scenarioDefaults: getScenarioDefaultPatches(nextScenarioModelById),
      dryRunResults: [{
        targetType: 'app_config',
        targetId: `scenario-preset-${presetName}`,
        status: 'dry_run',
        message,
      }],
    });
    setScenarioPresetStatus(saved ? message : '场景预设保存失败：持久化服务不可用');
  }

  function toggleModelEnabled(modelId: string) {
    setModelEnabledById((current) => ({ ...current, [modelId]: !(current[modelId] ?? false) }));
    setAllConfigStatus(null);
  }

  function readLogoFile(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error('logo_read_failed'));
      });
      reader.addEventListener('error', () => reject(new Error('logo_read_failed')));
      reader.readAsDataURL(file);
    });
  }

  async function updateLogoPreview(providerId: string, file: File) {
    if (!allowedLogoImageTypes.has(file.type) || file.size > maxLogoImageBytes) {
      addProviderStatus(providerId, 'Logo 上传失败：仅支持 150KB 内的 PNG、JPG、WebP。');
      return;
    }

    try {
      const logoRef = await readLogoFile(file);
      setLogoPreviewByProvider((current) => ({ ...current, [providerId]: logoRef }));
      setLogoFileNameByProvider((current) => ({ ...current, [providerId]: file.name }));
      addProviderStatus(providerId, `Logo 本地预览已更新：${file.name}`);
      const saved = await persistConfig({
        providerStates: getProviderStates([{ providerId, logoRef }]),
      });
      if (saved) {
        addProviderStatus(providerId, `Logo 已保存：${file.name}`);
        return;
      }

      const providerName = configView.providers.find((provider) => provider.providerId === providerId)?.providerName ?? providerId;
      addProviderStatus(providerId, `Logo 保存失败：${providerName} 持久化服务不可用，刷新后不会保留。`);
    } catch {
      addProviderStatus(providerId, 'Logo 上传失败：无法读取图片。');
    }
  }

  async function resetProviderLogo(providerId: string, providerName: string) {
    setLogoPreviewByProvider((current) => {
      const next = { ...current };
      delete next[providerId];
      return next;
    });
    setLogoFileNameByProvider((current) => {
      const next = { ...current };
      delete next[providerId];
      return next;
    });
    addProviderStatus(providerId, `Logo 正在恢复默认：${providerName}`);
    const saved = await persistConfig({
      providerStates: getProviderStates([{ providerId, logoRef: null }]),
    });
    addProviderStatus(
      providerId,
      saved
        ? `Logo 已恢复默认：${providerName}`
        : `Logo 恢复默认失败：${providerName} 持久化服务不可用`,
    );
  }

  function updateKeyDraft(providerId: string, value: string) {
    setKeyDraftByProvider((current) => ({ ...current, [providerId]: value }));
    setKeyDraftSavedByProvider((current) => ({ ...current, [providerId]: false }));
    if (value) addProviderStatus(providerId, '新 Key 已输入，保存后会写入服务端凭证配置。');
  }

  function toggleKeyVisibility(provider: PlatformAiModelConfigProvider) {
    if (!keyDraftByProvider[provider.providerId]) {
      addProviderStatus(provider.providerId, '刷新后仅保留低敏 Key 状态，需重新输入才可查看原文。');
      return;
    }

    setShowKeyValueByProvider((current) => ({ ...current, [provider.providerId]: !current[provider.providerId] }));
  }

  function getProviderKeySaveFailureMessage(providerName: string, errorCode: unknown) {
    if (errorCode === 'ENCRYPTION_NOT_CONFIGURED') return `Key 保存失败：${providerName} 加密配置不可用，未保存。`;
    if (errorCode === 'VALIDATION_FAILED') return `Key 保存失败：${providerName} 配置不完整，未保存。`;
    if (errorCode === 'UNAUTHORIZED' || errorCode === 'FORBIDDEN') return `Key 保存失败：${providerName} 当前账号无权限，未保存。`;
    if (errorCode === 'PROVIDER_CONFIG_UNAVAILABLE') return `Key 保存失败：${providerName} 凭证存储不可用，未保存。`;
    return `Key 保存失败：${providerName} 服务不可用，未保存。`;
  }

  async function saveProviderKey(provider: PlatformAiModelConfigProvider) {
    const keyDraft = keyDraftByProvider[provider.providerId] ?? '';
    if (!keyDraft) {
      addProviderStatus(provider.providerId, `Key 保存失败：${provider.providerName} 请输入新 Key`);
      return;
    }

    const keyStatus = keyDraft.length >= 4
      ? { kind: 'masked_configured' as const, maskedLabel: `Key 已配置 ****${keyDraft.slice(-4)}` }
      : getProviderKeyStatus(provider);

    providerKeyTouchedRef.current.add(provider.providerId);

    try {
      const vendorConfig = getSupportedVendorConfig(provider.providerId as SupportedVendor);
      const response = await fetch(providerConfigsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: provider.providerId,
          baseUrl: vendorConfig.defaultBaseUrl,
          model: vendorConfig.defaultModel,
          apiKey: keyDraft,
        }),
      });
      const responsePayload = await response.json().catch(() => null) as {
        ok?: boolean;
        errorCode?: string;
        configured?: boolean;
        vendor?: string;
      } | null;

      if (!response.ok || responsePayload?.ok === false || responsePayload?.configured !== true || responsePayload?.vendor !== provider.providerId) {
        addProviderStatus(provider.providerId, getProviderKeySaveFailureMessage(provider.providerName, responsePayload?.errorCode));
        return;
      }

      setKeyStatusByProvider((current) => ({ ...current, [provider.providerId]: keyStatus }));
      setKeyDraftSavedByProvider((current) => ({ ...current, [provider.providerId]: true }));
      const saved = await persistConfig({
        providerStates: getProviderStates([{ providerId: provider.providerId, keyStatus }]),
        dryRunResults: [{
          targetType: 'provider_key',
          targetId: provider.providerId,
          status: 'dry_run',
          message: `Key 已保存：${provider.providerName}`,
        }],
      });
      addProviderStatus(
        provider.providerId,
        saved
          ? `Key 已保存：${provider.providerName}`
          : `Key 已保存：${provider.providerName}，低敏状态保存失败，刷新后可能不会保留。`,
      );
    } catch {
      addProviderStatus(provider.providerId, `Key 保存失败：${provider.providerName} 服务不可用`);
    }
  }

  function getSyncStatusMessage(providerName: string, payload: VendorOperationPayload) {
    if (payload.status === 'success') return `同步已完成：${providerName}`;
    if (payload.status === 'not_configured') return `同步失败：${providerName} 未配置 Key`;
    if (payload.status === 'timeout') return `同步超时：${providerName}`;
    if (payload.status === 'rate_limited') return `同步限流：${providerName}`;
    return `同步失败：${providerName} 厂商不可用`;
  }

  function getTestStatusMessage(modelName: string, payload: VendorOperationPayload) {
    if (payload.status === 'success') return `测试已完成：${modelName}`;
    if (payload.status === 'not_configured') return `测试失败：${modelName} 未配置 Key`;
    if (payload.status === 'timeout') return `测试超时：${modelName}`;
    if (payload.status === 'rate_limited') return `测试限流：${modelName}`;
    return `测试失败：${modelName} 厂商不可用`;
  }

  async function syncModels(providerId: string, providerName: string) {
    addProviderStatus(providerId, `同步请求已提交：${providerName}`);

    try {
      const response = await fetch(aiModelConfigSyncEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor: providerId }),
      });
      const payload = await response.json().catch(() => ({})) as VendorOperationPayload;
      addProviderStatus(providerId, response.ok ? getSyncStatusMessage(providerName, payload) : `同步失败：${providerName} 服务不可用`);
    } catch {
      addProviderStatus(providerId, `同步失败：${providerName} 服务不可用`);
    }
  }

  async function testModel(providerId: string, modelId: string, modelName: string) {
    setTestStatusByModelId((current) => ({ ...current, [modelId]: `测试请求已提交：${modelName}` }));

    try {
      const response = await fetch(aiModelConfigTestEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor: providerId, modelId }),
      });
      const payload = await response.json().catch(() => ({})) as VendorOperationPayload;
      setTestStatusByModelId((current) => ({
        ...current,
        [modelId]: response.ok ? getTestStatusMessage(modelName, payload) : `测试失败：${modelName} 服务不可用`,
      }));
    } catch {
      setTestStatusByModelId((current) => ({ ...current, [modelId]: `测试失败：${modelName} 服务不可用` }));
    }
  }

  function addProviderStatus(providerId: string, status: string) {
    setProviderStatusById((current) => {
      const statuses = current[providerId] ?? [];
      return {
        ...current,
        [providerId]: statuses.includes(status) ? statuses : [...statuses, status],
      };
    });
  }

  const enabledModelCount = allConfigModels.filter((model) => isModelEnabled(model.modelId)).length;

  return (
    <section className="space-y-6 text-slate-950" aria-labelledby="ai-model-config-heading">
      <div>
        <h1 id="ai-model-config-heading" className="text-2xl font-bold tracking-normal text-[#111827]">{configView.title}</h1>
        <p className="mt-1 text-sm text-[#6b7280]">{configView.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: '已启用模型', value: String(enabledModelCount), icon: Cpu, className: 'bg-blue-100 text-blue-600' },
          { label: '已配置厂商', value: String(configView.summary.configuredProviderCount), icon: Key, className: 'bg-emerald-100 text-emerald-600' },
          { label: '默认场景', value: String(configView.summary.defaultScenarioCount), icon: Target, className: 'bg-purple-100 text-purple-600' },
        ].map((card) => (
          <article key={card.label} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
              <div className={cn('grid h-12 w-12 place-items-center rounded-full', card.className)}>
                <card.icon className="h-6 w-6" />
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6" aria-labelledby="ai-default-config-heading">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 id="ai-default-config-heading" className="text-lg font-semibold tracking-normal text-gray-900">AI 应用默认配置</h2>
            <p className="mt-1 text-sm text-gray-500">先定义业务场景用什么模型，智能体默认继承场景配置，后续单个智能体或工作流节点可单独覆盖。</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowScenarioPresets((current) => !current)}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
            >
              场景预设
            </button>
            <button
              type="button"
              onClick={() => { void saveAppConfig('应用配置 dry-run 已保存'); }}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white"
            >
              <Check className="h-4 w-4" />
              保存应用配置
            </button>
          </div>
        </div>

        {showScenarioPresets ? (
          <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-900">场景预设</p>
                <p className="mt-1 text-xs text-blue-700">应用后自动保存到配置边界，刷新后按持久化配置恢复。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { void applyScenarioPreset('智能随访'); }} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-blue-700">
                  应用预设：智能随访
                </button>
                <button type="button" onClick={() => { void applyScenarioPreset('运营分析'); }} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-blue-700">
                  应用预设：运营分析
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {scenarioPresetStatus ? <p className="mb-3 text-xs font-semibold text-blue-700">{scenarioPresetStatus}</p> : null}
        {appConfigStatus ? <p className={cn('mb-3 text-xs font-semibold', getSaveStatusClassName(appConfigStatus))}>{appConfigStatus}</p> : null}

        <details className="group overflow-hidden rounded-xl border border-gray-200">
          <summary className="list-none bg-gray-50 px-4 py-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-gray-500 transition-transform group-open:rotate-90" />
                <span className="font-medium text-gray-900">展开业务场景与 Agent 继承配置</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-600">
                <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1">
                  {configView.scenarioDefaults.length}/{configView.summary.defaultScenarioCount} 个场景已配置
                </span>
                <span className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-purple-700">
                  {configView.agentInheritance.length} 个 Agent 继承
                </span>
              </div>
            </div>
          </summary>

          <div className="grid grid-cols-1 gap-5 p-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-semibold tracking-normal text-gray-900">业务场景默认模型</h3>
                <span className="text-xs text-gray-500">只显示已启用且能力匹配的模型</span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {configView.scenarioDefaults.map((scenario) => {
                  const capability = capabilityMeta[scenario.requiredCapability];
                  return (
                    <article key={scenario.scenarioId} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{scenario.scenarioName}</p>
                          <p className="mt-1 text-xs leading-relaxed text-gray-500">{scenario.description}</p>
                        </div>
                        <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold', capability.className)}>
                          {capability.label}
                        </span>
                      </div>
                      <label htmlFor={`${scenario.scenarioId}-model`} className="sr-only">{scenario.scenarioName} 默认模型</label>
                      <select
                        id={`${scenario.scenarioId}-model`}
                        value={scenarioModelById[scenario.scenarioId]}
                        onChange={(event) => updateScenarioModel(scenario.scenarioId, event.target.value)}
                        className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                      >
                        {getScenarioModelOptions(scenario.requiredCapability).map((model) => (
                          <option key={model.modelId} value={model.modelId}>{model.displayName}</option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs font-semibold text-blue-700">{scenario.scenarioName} 已选择 {getSelectedScenarioModelName(scenario.scenarioId)}</p>
                    </article>
                  );
                })}
              </div>
            </div>

            <aside className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-semibold tracking-normal text-gray-900">Agent 智能体继承关系</h3>
                <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600">默认继承</span>
              </div>
              <div className="space-y-3">
                {configView.agentInheritance.map((agent) => (
                  <article key={agent.agentId} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-start gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-purple-100 text-purple-600">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900">{agent.agentName}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{agent.agentDescription}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">{agent.inheritsScenarioName}</span>
                          <span className="truncate text-xs text-gray-600">{agent.inheritedModelName}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </aside>
          </div>
        </details>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6" aria-labelledby="ai-provider-config-heading">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 id="ai-provider-config-heading" className="text-lg font-semibold tracking-normal text-gray-900">模型厂商配置</h2>
            <p className="mt-1 text-sm text-gray-500">按厂商统一管理 API Key、模型同步、模型启用和连通测试；同步与测试通过服务端受控执行。</p>
          </div>
          <button
            type="button"
            onClick={() => { void saveAllConfig('全部配置已保存'); }}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white"
          >
            <Check className="h-4 w-4" />
            保存全部配置
          </button>
        </div>
        {allConfigStatus ? <p className={cn('mb-4 text-xs font-semibold', getSaveStatusClassName(allConfigStatus))}>{allConfigStatus}</p> : null}

        <div className="space-y-3">
          {configView.providers.map((provider) => {
            const isExpanded = expandedProvider === provider.providerId;
            const enabledCount = provider.models.filter((model) => isModelEnabled(model.modelId)).length;

            return (
              <div key={provider.providerId} className="overflow-hidden rounded-xl border border-gray-200">
                <button
                  type="button"
                  aria-label={`厂商 ${provider.providerName}`}
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedProvider((current) => (current === provider.providerId ? null : provider.providerId))}
                  className="w-full bg-gray-50 px-4 py-3 text-left"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                      <ChevronRight className={cn('h-4 w-4 text-gray-500 transition-transform', isExpanded ? 'rotate-90' : '')} />
                      {renderProviderLogo(provider, 'h-10 w-10 rounded-lg text-sm')}
                      <div>
                        <p className="font-semibold text-gray-900">{provider.providerName}</p>
                        <p className="text-xs text-gray-500">{enabledCount}/{provider.models.length} 个模型已启用</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-green-700">{getProviderKeyStatus(provider).maskedLabel}</span>
                      <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-gray-600">{provider.models.length} 个模型</span>
                    </div>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="space-y-4 p-4">
                    <div className="rounded-lg border border-gray-200 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                        <div className="flex items-center gap-3 lg:w-56">
                          {renderProviderLogo(provider, 'h-12 w-12 rounded-lg text-base')}
                          <div>
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700">
                              <Upload className="h-4 w-4" />
                              上传 Logo
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                aria-label={`上传 Logo ${provider.providerName}`}
                                className="sr-only"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (file) void updateLogoPreview(provider.providerId, file);
                                }}
                              />
                            </label>
                            <div className="mt-1 text-[11px] text-gray-400">
                              {logoFileNameByProvider[provider.providerId]
                                ? `本地预览：${logoFileNameByProvider[provider.providerId]}`
                                : getProviderLogoRef(provider.providerId)
                                  ? '已保存 Logo'
                                  : '默认 Logo'}
                            </div>
                            {getProviderLogoRef(provider.providerId) ? (
                              <button
                                type="button"
                                aria-label={`恢复默认 Logo ${provider.providerName}`}
                                onClick={() => { void resetProviderLogo(provider.providerId, provider.providerName); }}
                                className="mt-1 text-[11px] font-semibold text-blue-700"
                              >
                                恢复默认
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex-1">
                          <label htmlFor={`${provider.providerId}-key`} className="text-sm font-medium text-gray-700">{provider.providerName} API Key</label>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="relative flex-1">
                              <LockKeyhole className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                              <input
                                id={`${provider.providerId}-key`}
                                type="text"
                                value={getKeyInputValue(provider)}
                                onChange={(event) => updateKeyDraft(provider.providerId, event.target.value)}
                                onFocus={(event) => {
                                  if (!showKeyValueByProvider[provider.providerId] && event.currentTarget.value) {
                                    event.currentTarget.select();
                                  }
                                }}
                                placeholder={getKeyInputPlaceholder()}
                                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-500"
                              />
                            </div>
                          </div>
                          <p className="mt-1 text-xs font-semibold text-green-700">{getProviderKeyStatus(provider).maskedLabel}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => toggleKeyVisibility(provider)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600">
                            {showKeyValueByProvider[provider.providerId] ? '关闭显示' : '显示'}
                          </button>
                          <button type="button" onClick={() => { void saveProviderKey(provider); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">保存 Key</button>
                          <button
                            type="button"
                            aria-label={`同步模型 ${operationStatusLabel[provider.syncStatus]}`}
                            onClick={() => { void syncModels(provider.providerId, provider.providerName); }}
                            className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white"
                          >
                            <RefreshCw className="h-4 w-4" />
                            同步模型
                            <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[11px] leading-none">
                              {operationStatusLabel[provider.syncStatus]}
                            </span>
                          </button>
                        </div>
                      </div>
                      {providerStatusById[provider.providerId]?.length ? (
                        <div className="mt-3 space-y-1">
                          {providerStatusById[provider.providerId].map((status) => (
                            <p key={status} className="text-xs font-semibold text-green-700">{status}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      {configView.capabilityOrder.map((capabilityId) => {
                        const models = provider.models.filter((model) => model.capabilityIds.includes(capabilityId));
                        if (!models.length) return null;
                        const meta = capabilityMeta[capabilityId];
                        const Icon = meta.icon;
                        const enabledCountByCapability = models.filter((model) => isModelEnabled(model.modelId)).length;
                        const capabilityKey = getCapabilityKey(provider.providerId, capabilityId);
                        const capabilityExpanded = isCapabilityExpanded(provider.providerId, capabilityId);
                        const modelsRegionId = `${provider.providerId}-${capabilityId}-models`;

                        return (
                          <section key={capabilityId} className="overflow-hidden rounded-xl border border-gray-200" aria-labelledby={`${provider.providerId}-${capabilityId}-heading`}>
                            <button
                              type="button"
                              ref={(element) => {
                                capabilityHeaderRefs.current[capabilityKey] = element;
                              }}
                              aria-label={`能力分组 ${provider.providerName} ${meta.label}`}
                              aria-expanded={capabilityExpanded}
                              aria-controls={modelsRegionId}
                              onClick={() => toggleCapability(provider.providerId, capabilityId)}
                              className={cn('w-full px-4 py-3 text-left transition-colors', meta.className)}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <ChevronRight className={cn('h-4 w-4 transition-transform', capabilityExpanded ? 'rotate-90' : '')} />
                                  <Icon className="h-4 w-4" />
                                  <h3 id={`${provider.providerId}-${capabilityId}-heading`} className="font-semibold tracking-normal">{meta.label}</h3>
                                </div>
                                <span className="text-xs opacity-80">{enabledCountByCapability}/{models.length} 已启用</span>
                              </div>
                            </button>
                            {capabilityExpanded ? (
                              <div id={modelsRegionId} className="divide-y divide-gray-100 p-2">
                                {models.map((model) => (
                                  <div key={model.modelId} className={cn('flex flex-col gap-2 px-3 py-2.5 md:flex-row md:flex-wrap md:items-center md:justify-between', isModelEnabled(model.modelId) ? 'bg-green-50' : 'bg-white')}>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="text-sm font-semibold tracking-normal text-gray-900">{model.displayName}</h4>
                                        {isModelEnabled(model.modelId) ? <span className="rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">已启用</span> : null}
                                        <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-semibold text-gray-600">{model.contextWindowLabel}</span>
                                        {model.capabilityIds.filter((item) => item !== capabilityId).map((item) => (
                                          <span key={item} className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-500">
                                            {capabilityMeta[item].label}
                                          </span>
                                        ))}
                                      </div>
                                      <div className="mt-1 flex flex-col gap-1 lg:flex-row lg:items-center">
                                        <code className="break-all text-xs text-gray-400">{model.modelId}</code>
                                        <span className="hidden text-gray-300 lg:inline">/</span>
                                        <p className="truncate text-xs text-gray-500">{model.description}</p>
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                      <span className="text-xs text-gray-500">{model.pricingLabel}</span>
                                      <button
                                        type="button"
                                        onClick={() => { void testModel(provider.providerId, model.modelId, model.displayName); }}
                                        aria-label={`测试 ${model.displayName} ${operationStatusLabel[model.testStatus]}`}
                                        className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600"
                                      >
                                        测试 {operationStatusLabel[model.testStatus]}
                                      </button>
                                      <label className="inline-flex items-center">
                                        <span className="sr-only">启用 {model.displayName}</span>
                                        <input
                                          type="checkbox"
                                          checked={isModelEnabled(model.modelId)}
                                          onChange={() => toggleModelEnabled(model.modelId)}
                                          className="h-5 w-5 rounded border-gray-300 text-green-600"
                                        />
                                      </label>
                                    </div>
                                    {testStatusByModelId[model.modelId] ? (
                                      <p className="text-xs font-semibold text-green-700 md:basis-full md:text-right">{testStatusByModelId[model.modelId]}</p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </section>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500">
          <Sparkles className="h-4 w-4 text-blue-500" />
          <span>{configView.readonlyNote}</span>
          <ImageIcon className="h-4 w-4 text-gray-400" />
          <span>Logo、模型启用和场景默认关系均来自受控示例数据。</span>
        </div>
      </section>
    </section>
  );
}
