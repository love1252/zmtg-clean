'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { InstitutionPageState } from '@/modules/institution/components/InstitutionPageState';
import { InstitutionSectionHeader } from '@/modules/institution/components/InstitutionSectionHeader';
import { cn } from '@/shared/utils/cn';

const hisConnectionStatusLabels = {
  draft: '草稿',
  active: '已启用',
  paused: '已暂停',
  revoked: '已撤销',
  deleted: '已归档',
  error: '异常',
} as const;

const hisConnectionHealthLabels = {
  unknown: '未检查',
  healthy: '正常',
  degraded: '降级',
  failed: '失败',
} as const;

type HisConnectionStatus = keyof typeof hisConnectionStatusLabels;
type HisConnectionHealthStatus = keyof typeof hisConnectionHealthLabels;

const statusToneClasses = {
  draft: 'border-slate-200 bg-slate-50 text-slate-600',
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  paused: 'border-amber-200 bg-amber-50 text-amber-700',
  revoked: 'border-rose-200 bg-rose-50 text-rose-700',
  deleted: 'border-slate-300 bg-slate-100 text-slate-600',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
} satisfies Record<HisConnectionStatus, string>;

const healthToneClasses = {
  unknown: 'border-slate-200 bg-slate-50 text-slate-600',
  healthy: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  degraded: 'border-amber-200 bg-amber-50 text-amber-700',
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
} satisfies Record<HisConnectionHealthStatus, string>;

type HisConnectionSafeRecord = {
  connectionId: string;
  connectionName: string;
  sourceSystem: string;
  vendorType: string;
  systemType: string;
  status: HisConnectionStatus;
  credentialConfigured: boolean;
  healthStatus: HisConnectionHealthStatus;
  lastCheckedAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
};

type PanelErrorKind = 'error' | 'forbidden' | 'unavailable';

type PanelErrorState = {
  kind: PanelErrorKind;
  title: string;
};

type ListState =
  | { status: 'loading' }
  | { status: 'success'; records: HisConnectionSafeRecord[] }
  | { status: 'error'; error: PanelErrorState };

type DetailState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; record: HisConnectionSafeRecord }
  | { status: 'error'; error: PanelErrorState };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeString(value: unknown, fallback = '未记录') {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function safeNullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function safeStableErrorCode(value: unknown) {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (!/^[A-Z0-9_.:-]{1,80}$/u.test(normalized)) return null;

  return normalized;
}

function isHisConnectionStatus(value: unknown): value is HisConnectionStatus {
  return typeof value === 'string' && value in hisConnectionStatusLabels;
}

function isHisConnectionHealthStatus(value: unknown): value is HisConnectionHealthStatus {
  return typeof value === 'string' && value in hisConnectionHealthLabels;
}

function parseHisConnectionRecord(value: unknown): HisConnectionSafeRecord | null {
  if (!isRecord(value) || typeof value.connectionId !== 'string' || !value.connectionId.trim()) {
    return null;
  }

  return {
    connectionId: value.connectionId.trim(),
    connectionName: safeString(value.connectionName, '未命名连接'),
    sourceSystem: safeString(value.sourceSystem),
    vendorType: safeString(value.vendorType),
    systemType: safeString(value.systemType),
    status: isHisConnectionStatus(value.status) ? value.status : 'draft',
    credentialConfigured: value.credentialConfigured === true,
    healthStatus: isHisConnectionHealthStatus(value.healthStatus) ? value.healthStatus : 'unknown',
    lastCheckedAt: safeNullableString(value.lastCheckedAt),
    lastErrorCode: safeStableErrorCode(value.lastErrorCode),
    createdAt: safeString(value.createdAt),
    updatedAt: safeString(value.updatedAt),
    revokedAt: safeNullableString(value.revokedAt),
  };
}

function parseHisConnectionListPayload(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.records)) return [];

  return payload.records
    .map(parseHisConnectionRecord)
    .filter((record): record is HisConnectionSafeRecord => record !== null);
}

function parseHisConnectionDetailPayload(payload: unknown) {
  if (!isRecord(payload)) return null;

  return parseHisConnectionRecord(payload.record);
}

function visibleListErrorFromStatus(status: number): PanelErrorState {
  if (status === 401) {
    return { kind: 'error', title: '登录状态已失效，请重新登录' };
  }

  if (status === 403) {
    return { kind: 'forbidden', title: '当前账号没有查看 HIS 连接配置的权限' };
  }

  if (status === 503) {
    return { kind: 'unavailable', title: 'HIS 连接配置暂时不可用' };
  }

  return { kind: 'error', title: 'HIS 连接配置请求失败' };
}

function visibleDetailErrorFromStatus(status: number): PanelErrorState {
  if (status === 404) {
    return { kind: 'error', title: '连接不存在或不可见' };
  }

  return visibleListErrorFromStatus(status);
}

async function loadHisConnectionList() {
  const response = await fetch('/api/institution/his-connections', {
    cache: 'no-store',
  });

  if (!response.ok) {
    return {
      ok: false as const,
      error: visibleListErrorFromStatus(response.status),
    };
  }

  const payload: unknown = await response.json();
  return {
    ok: true as const,
    records: parseHisConnectionListPayload(payload),
  };
}

async function loadHisConnectionDetail(connectionId: string) {
  const response = await fetch(
    `/api/institution/his-connections/${encodeURIComponent(connectionId)}`,
    {
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    return {
      ok: false as const,
      error: visibleDetailErrorFromStatus(response.status),
    };
  }

  const payload: unknown = await response.json();
  const record = parseHisConnectionDetailPayload(payload);
  if (!record) {
    return {
      ok: false as const,
      error: { kind: 'error' as const, title: 'HIS 连接配置请求失败' },
    };
  }

  return {
    ok: true as const,
    record,
  };
}

function displayValue(value: string | null) {
  return value && value.length > 0 ? value : '未记录';
}

function credentialLabel(record: HisConnectionSafeRecord) {
  return record.credentialConfigured ? '凭证已配置' : '凭证未配置';
}

function StatusPill({
  children,
  className,
}: {
  children: string;
  className: string;
}) {
  return (
    <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', className)}>
      {children}
    </span>
  );
}

function SummaryLine({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="text-sm font-medium leading-6 text-slate-800">
      {label}：{displayValue(value)}
    </div>
  );
}

function HisConnectionCard({
  isSelected,
  onSelect,
  record,
}: {
  isSelected: boolean;
  onSelect: () => void;
  record: HisConnectionSafeRecord;
}) {
  return (
    <button
      type="button"
      aria-label={`查看 HIS 连接安全详情：${record.connectionName}`}
      aria-current={isSelected ? 'true' : undefined}
      onClick={onSelect}
      className={cn(
        'w-full rounded-2xl border bg-white/88 p-4 text-left shadow-sm transition',
        isSelected
          ? 'border-blue-300 ring-2 ring-blue-100'
          : 'border-slate-200/80 hover:border-blue-200 hover:bg-blue-50/30',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold tracking-normal text-slate-950">
            {record.connectionName}
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill className={statusToneClasses[record.status]}>
              {hisConnectionStatusLabels[record.status]}
            </StatusPill>
            <StatusPill className={healthToneClasses[record.healthStatus]}>
              {hisConnectionHealthLabels[record.healthStatus]}
            </StatusPill>
            <StatusPill
              className={
                record.credentialConfigured
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }
            >
              {credentialLabel(record)}
            </StatusPill>
          </div>
        </div>
        <Server className="h-5 w-5 shrink-0 text-blue-500" />
      </div>

      <div className="mt-4 grid gap-1">
        <SummaryLine label="来源系统" value={record.sourceSystem} />
        <SummaryLine label="厂商类型" value={record.vendorType} />
        <SummaryLine label="系统类型" value={record.systemType} />
        <SummaryLine label="最近检查" value={record.lastCheckedAt} />
        <SummaryLine label="最近错误码" value={record.lastErrorCode} />
        <SummaryLine label="创建时间" value={record.createdAt} />
        <SummaryLine label="更新时间" value={record.updatedAt} />
        <SummaryLine label="撤销时间" value={record.revokedAt} />
      </div>
    </button>
  );
}

function HisConnectionDetail({
  detailState,
  fallbackRecord,
}: {
  detailState: DetailState;
  fallbackRecord: HisConnectionSafeRecord | null;
}) {
  const record = detailState.status === 'success' ? detailState.record : fallbackRecord;

  return (
    <aside className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-600">只读安全摘要</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
            安全详情
          </h2>
        </div>
        <ShieldCheck className="h-5 w-5 text-emerald-500" />
      </div>

      {detailState.status === 'loading' ? (
        <div className="mt-5">
          <InstitutionPageState kind="loading" title="正在加载 HIS 连接详情..." />
        </div>
      ) : null}

      {detailState.status === 'error' ? (
        <div className="mt-5">
          <InstitutionPageState kind={detailState.error.kind} title={detailState.error.title} />
        </div>
      ) : null}

      {record ? (
        <div className="mt-5 space-y-5">
          <div>
            <h3 className="text-lg font-semibold tracking-normal text-slate-950">
              {record.connectionName}
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusPill className={statusToneClasses[record.status]}>
                {hisConnectionStatusLabels[record.status]}
              </StatusPill>
              <StatusPill className={healthToneClasses[record.healthStatus]}>
                {hisConnectionHealthLabels[record.healthStatus]}
              </StatusPill>
              <StatusPill
                className={
                  record.credentialConfigured
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }
              >
                {credentialLabel(record)}
              </StatusPill>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/86 p-4">
            <div className="grid gap-1">
              <SummaryLine label="来源系统" value={record.sourceSystem} />
              <SummaryLine label="厂商类型" value={record.vendorType} />
              <SummaryLine label="系统类型" value={record.systemType} />
              <SummaryLine label="最近检查" value={record.lastCheckedAt} />
              <SummaryLine label="最近错误码" value={record.lastErrorCode} />
              <SummaryLine label="创建时间" value={record.createdAt} />
              <SummaryLine label="更新时间" value={record.updatedAt} />
              <SummaryLine label="撤销时间" value={record.revokedAt} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
          配置凭证、测试连接、启停连接需后续单独实现。
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
          这些状态只是后端只读状态展示，不代表测试连接或真实 HIS 调用已实现。
        </div>
      </div>
    </aside>
  );
}

export function HisConnectionReadOnlyPanel() {
  const [listState, setListState] = useState<ListState>({ status: 'loading' });
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [detailState, setDetailState] = useState<DetailState>({ status: 'idle' });

  useEffect(() => {
    let isActive = true;

    async function loadList() {
      setListState({ status: 'loading' });
      setDetailState({ status: 'idle' });
      setSelectedConnectionId(null);

      try {
        const result = await loadHisConnectionList();
        if (!isActive) return;

        if (!result.ok) {
          setListState({ status: 'error', error: result.error });
          return;
        }

        setListState({ status: 'success', records: result.records });
        setSelectedConnectionId(result.records[0]?.connectionId ?? null);
      } catch {
        if (!isActive) return;
        setListState({
          status: 'error',
          error: { kind: 'error', title: 'HIS 连接配置请求失败' },
        });
      }
    }

    void loadList();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedConnectionId) {
      return;
    }

    const connectionId = selectedConnectionId;
    let isActive = true;

    async function loadDetail() {
      setDetailState({ status: 'loading' });

      try {
        const result = await loadHisConnectionDetail(connectionId);
        if (!isActive) return;

        if (!result.ok) {
          setDetailState({ status: 'error', error: result.error });
          return;
        }

        setDetailState({ status: 'success', record: result.record });
      } catch {
        if (!isActive) return;
        setDetailState({
          status: 'error',
          error: { kind: 'error', title: 'HIS 连接配置请求失败' },
        });
      }
    }

    void loadDetail();

    return () => {
      isActive = false;
    };
  }, [selectedConnectionId]);

  const records = useMemo(
    () => (listState.status === 'success' ? listState.records : []),
    [listState],
  );
  const selectedRecord = useMemo(
    () => records.find((record) => record.connectionId === selectedConnectionId) ?? null,
    [records, selectedConnectionId],
  );

  return (
    <div className="space-y-6">
      <InstitutionSectionHeader
        eyebrow="外部连接只读状态"
        title="HIS 连接配置"
        description="查看当前机构已登记连接的安全摘要，仅展示白名单字段，不提供写入、凭证或测试连接能力。"
        tone="emerald"
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            当前机构只读
          </span>
        }
      />

      {listState.status === 'loading' ? (
        <InstitutionPageState kind="loading" title="正在加载 HIS 连接配置..." />
      ) : null}

      {listState.status === 'error' ? (
        <InstitutionPageState kind={listState.error.kind} title={listState.error.title} />
      ) : null}

      {listState.status === 'success' && records.length === 0 ? (
        <InstitutionPageState
          kind="empty"
          title="暂无 HIS 连接配置"
          description="当前机构尚未登记连接配置。配置凭证、测试连接和启停连接需后续单独实现。"
        />
      ) : null}

      {records.length > 0 ? (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-600">连接配置</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
                  连接列表
                </h2>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
                <FileText className="h-4 w-4" />
                {records.length} 条
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {records.map((record) => (
                <HisConnectionCard
                  key={record.connectionId}
                  record={record}
                  isSelected={record.connectionId === selectedConnectionId}
                  onSelect={() => setSelectedConnectionId(record.connectionId)}
                />
              ))}
            </div>
          </div>

          <HisConnectionDetail detailState={detailState} fallbackRecord={selectedRecord} />
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        {[
          {
            icon: CheckCircle2,
            title: '只读 API',
            detail: '仅调用连接配置 list / detail GET 接口。',
          },
          {
            icon: AlertTriangle,
            title: '无写入能力',
            detail: '不创建、不编辑、不删除、不暂停、不恢复、不撤销。',
          },
          {
            icon: Clock3,
            title: '后续单独实现',
            detail: '凭证录入、测试连接和真实 HIS adapter 不在本页面范围。',
          },
        ].map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-white/80 bg-white/72 p-4 shadow-sm backdrop-blur-xl"
          >
            <item.icon className="h-5 w-5 text-slate-500" />
            <h3 className="mt-3 text-sm font-semibold tracking-normal text-slate-950">
              {item.title}
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">{item.detail}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
