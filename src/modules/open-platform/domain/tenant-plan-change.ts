import type { TenantPlanPublishedVersionRecord } from '@/modules/open-platform/domain/tenant-plan-binding';

export type TenantPlanChangePayload = {
  toPlanVersionId: string;
  reason: string;
};

export type TenantPlanChangeParseResult =
  | { ok: true; value: TenantPlanChangePayload }
  | { ok: false; errors: string[] };

export type TenantPlanChangeDiffItem = {
  key:
    | 'displayName'
    | 'displayPrice'
    | 'agentLimit'
    | 'seatLimit'
    | 'monthlyAiCallLimit'
    | 'knowledgeStorageGb'
    | 'connectorEntitlements'
    | 'serviceEntitlements'
    | 'versionCode';
  label: string;
  before: string;
  after: string;
  changed: boolean;
};

export type TenantPlanChangePreview = {
  tenantId: string;
  fromPlanVersionId: string | null;
  toPlanVersionId: string;
  changedItemCount: number;
  unchangedItemCount: number;
  items: TenantPlanChangeDiffItem[];
};

function isJsonObject(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

function readText(input: Record<string, unknown>, key: string) {
  const value = input[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readStringList(json: unknown, key: string) {
  if (!isJsonObject(json)) return [];
  const value = json[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function formatNumber(value: number | null) {
  return typeof value === 'number' ? new Intl.NumberFormat('zh-CN').format(value) : '不限';
}

function formatStorage(value: number | null) {
  return typeof value === 'number' ? `${new Intl.NumberFormat('zh-CN').format(value)} GB` : '不限';
}

function formatList(values: string[]) {
  return values.length > 0 ? values.join(' / ') : '无';
}

function diffItem(input: {
  key: TenantPlanChangeDiffItem['key'];
  label: string;
  before: string;
  after: string;
}): TenantPlanChangeDiffItem {
  return {
    ...input,
    changed: input.before !== input.after,
  };
}

export function parseTenantPlanChangePayload(input: unknown): TenantPlanChangeParseResult {
  const payload = isJsonObject(input) ? input : {};
  const toPlanVersionId = readText(payload, 'toPlanVersionId');
  const reason = readText(payload, 'reason');
  const errors: string[] = [];

  if (!toPlanVersionId) errors.push('TO_PLAN_VERSION_REQUIRED');
  if (!reason) errors.push('REASON_REQUIRED');

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      toPlanVersionId,
      reason,
    },
  };
}

export function buildTenantPlanChangePreview(input: {
  tenantId: string;
  fromPlanVersion: TenantPlanPublishedVersionRecord;
  toPlanVersion: TenantPlanPublishedVersionRecord;
}): TenantPlanChangePreview {
  const { fromPlanVersion, toPlanVersion } = input;
  const items: TenantPlanChangeDiffItem[] = [
    diffItem({
      key: 'displayName',
      label: '套餐版本',
      before: fromPlanVersion.displayName,
      after: toPlanVersion.displayName,
    }),
    diffItem({
      key: 'displayPrice',
      label: '展示价格',
      before: fromPlanVersion.displayPrice,
      after: toPlanVersion.displayPrice,
    }),
    diffItem({
      key: 'agentLimit',
      label: 'Agent 数量',
      before: formatNumber(fromPlanVersion.agentLimit),
      after: formatNumber(toPlanVersion.agentLimit),
    }),
    diffItem({
      key: 'seatLimit',
      label: '员工席位',
      before: formatNumber(fromPlanVersion.seatLimit),
      after: formatNumber(toPlanVersion.seatLimit),
    }),
    diffItem({
      key: 'monthlyAiCallLimit',
      label: 'AI 调用 / 月',
      before: formatNumber(fromPlanVersion.monthlyAiCallLimit),
      after: formatNumber(toPlanVersion.monthlyAiCallLimit),
    }),
    diffItem({
      key: 'knowledgeStorageGb',
      label: '知识库存储',
      before: formatStorage(fromPlanVersion.knowledgeStorageGb),
      after: formatStorage(toPlanVersion.knowledgeStorageGb),
    }),
    diffItem({
      key: 'connectorEntitlements',
      label: '连接器权益',
      before: formatList(readStringList(fromPlanVersion.connectorEntitlementsJson, 'connectors')),
      after: formatList(readStringList(toPlanVersion.connectorEntitlementsJson, 'connectors')),
    }),
    diffItem({
      key: 'serviceEntitlements',
      label: '服务权益',
      before: formatList(readStringList(fromPlanVersion.serviceEntitlementsJson, 'services')),
      after: formatList(readStringList(toPlanVersion.serviceEntitlementsJson, 'services')),
    }),
    diffItem({
      key: 'versionCode',
      label: '版本号',
      before: fromPlanVersion.versionCode,
      after: toPlanVersion.versionCode,
    }),
  ];
  const changedItemCount = items.filter((item) => item.changed).length;

  return {
    tenantId: input.tenantId,
    fromPlanVersionId: fromPlanVersion.versionId,
    toPlanVersionId: toPlanVersion.versionId,
    changedItemCount,
    unchangedItemCount: items.length - changedItemCount,
    items,
  };
}

export function buildInitialPlanAssignmentPreview(input: {
  tenantId: string;
  toPlanVersion: TenantPlanPublishedVersionRecord;
}): TenantPlanChangePreview {
  const { toPlanVersion } = input;
  const initialLabel = '未配置套餐';
  const items: TenantPlanChangeDiffItem[] = [
    diffItem({
      key: 'displayName',
      label: '套餐版本',
      before: initialLabel,
      after: toPlanVersion.displayName,
    }),
    diffItem({
      key: 'displayPrice',
      label: '展示价格',
      before: initialLabel,
      after: toPlanVersion.displayPrice,
    }),
    diffItem({
      key: 'agentLimit',
      label: 'Agent 数量',
      before: initialLabel,
      after: formatNumber(toPlanVersion.agentLimit),
    }),
    diffItem({
      key: 'seatLimit',
      label: '员工席位',
      before: initialLabel,
      after: formatNumber(toPlanVersion.seatLimit),
    }),
    diffItem({
      key: 'monthlyAiCallLimit',
      label: 'AI 调用 / 月',
      before: initialLabel,
      after: formatNumber(toPlanVersion.monthlyAiCallLimit),
    }),
    diffItem({
      key: 'knowledgeStorageGb',
      label: '知识库存储',
      before: initialLabel,
      after: formatStorage(toPlanVersion.knowledgeStorageGb),
    }),
    diffItem({
      key: 'connectorEntitlements',
      label: '连接器权益',
      before: initialLabel,
      after: formatList(readStringList(toPlanVersion.connectorEntitlementsJson, 'connectors')),
    }),
    diffItem({
      key: 'serviceEntitlements',
      label: '服务权益',
      before: initialLabel,
      after: formatList(readStringList(toPlanVersion.serviceEntitlementsJson, 'services')),
    }),
    diffItem({
      key: 'versionCode',
      label: '版本号',
      before: initialLabel,
      after: toPlanVersion.versionCode,
    }),
  ];

  return {
    tenantId: input.tenantId,
    fromPlanVersionId: null,
    toPlanVersionId: toPlanVersion.versionId,
    changedItemCount: items.length,
    unchangedItemCount: 0,
    items,
  };
}
