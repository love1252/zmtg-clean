'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck, Users } from 'lucide-react';
import { InstitutionPageState } from '@/modules/institution/components/InstitutionPageState';
import { InstitutionSectionHeader } from '@/modules/institution/components/InstitutionSectionHeader';
import type { WeComExternalContactReadonlyApiPayload } from '@/modules/institution/view-models/wecom-external-contact-readonly-view-model';

const authorizationLabels = {
  not_configured: '未配置',
  authorized: '已授权（mock）',
  revoked: '已撤销',
  expired: '已过期',
  disabled: '已禁用',
  external_disabled: '外部能力关闭',
  manual_review_required: '待人工复核',
} as const;

const syncLabels = {
  not_started: '未开始',
  mock_ready: 'mock 数据就绪',
  preflight_ready: '预检就绪',
  syncing_disabled: '同步已禁用',
  sync_failed: '同步失败',
  manual_review_required: '待人工复核',
} as const;

const mappingLabels = {
  unmatched: '未匹配',
  candidate: '候选匹配',
  matched: '已匹配',
  conflict: '匹配冲突',
  rejected: '已拒绝',
  manual_review_required: '待人工复核',
} as const;

const reviewLabels = {
  not_required: '无需复核',
  pending: '待复核',
  approved: '已通过',
  rejected: '已拒绝',
  needs_more_info: '需补充信息',
} as const;

const sourceLabels = {
  qr_code: '二维码',
  employee_share: '员工分享',
  group_chat: '群聊来源',
  other_mock: '其他 mock 来源',
} as const;

type PanelState =
  | { status: 'loading' }
  | { status: 'loaded'; payload: WeComExternalContactReadonlyApiPayload }
  | { status: 'error'; kind: 'error' | 'forbidden'; title: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKeyOf<T extends object>(value: unknown, labels: T): value is keyof T {
  return typeof value === 'string' && value in labels;
}

function containsForbiddenText(value: string) {
  return /(?:^|\D)1[3-9]\d{9}(?:\D|$)|(?:^|\D)\d{17}[\dXx](?:\D|$)|access[_-]?token|secret|external_userid|\buserid\b|chat(?:Content|Archive)|conversationContent|webhookPayload|apiResponse/iu.test(
    value,
  );
}

function safeString(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized && !containsForbiddenText(normalized) ? normalized : fallback;
}

function safeNullableString(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized && !containsForbiddenText(normalized) ? normalized : null;
}

function parsePayload(value: unknown): WeComExternalContactReadonlyApiPayload | null {
  if (!isRecord(value) || containsForbiddenText(JSON.stringify(value))) return null;
  if (
    value.sourceKind !== 'controlled_mock_fixture' ||
    (value.dataMode !== 'mock' && value.dataMode !== 'demo') ||
    value.readonly !== true ||
    value.mockDemo !== true ||
    value.containsRealCustomerData !== false ||
    !isKeyOf(value.authorizationStatus, authorizationLabels) ||
    !isKeyOf(value.syncStatus, syncLabels) ||
    typeof value.failClosed !== 'boolean' ||
    !Array.isArray(value.contacts) ||
    !Array.isArray(value.mappingCandidates) ||
    !Array.isArray(value.manualReview)
  ) return null;

  const contacts = value.contacts.flatMap((item) => {
    if (
      !isRecord(item) ||
      !isKeyOf(item.mappingStatus, mappingLabels) ||
      !isKeyOf(item.syncStatus, syncLabels) ||
      !isKeyOf(item.manualReviewStatus, reviewLabels) ||
      !isKeyOf(item.sourceType, sourceLabels) ||
      !Array.isArray(item.owners) ||
      !Array.isArray(item.tags)
    ) return [];

    return [{
      contactReference: safeString(item.contactReference, 'mock-contact'),
      displayName: safeString(item.displayName, '[MOCK] 外部联系人'),
      owners: item.owners.flatMap((owner) => {
        if (!isRecord(owner)) return [];
        return [{
          displayName: safeString(owner.displayName, '[MOCK] 未分配员工'),
          ownershipStatus: owner.ownershipStatus === 'inactive' ? 'inactive' as const : 'active' as const,
          institutionSummary: safeString(owner.institutionSummary, 'mock_institution'),
        }];
      }),
      tags: item.tags.flatMap((tag) => {
        if (!isRecord(tag)) return [];
        return [{
          name: safeString(tag.name, '[MOCK] 低敏标签'),
          status: tag.status === 'inactive' ? 'inactive' as const : 'active' as const,
          sourceKind: tag.sourceKind === 'demo_enterprise'
            ? 'demo_enterprise' as const
            : 'mock_enterprise' as const,
        }];
      }),
      sourceType: item.sourceType,
      addedAtDate: safeString(item.addedAtDate, '未记录'),
      remarkSummary: safeString(item.remarkSummary, '无低敏摘要'),
      mappingStatus: item.mappingStatus,
      lastSyncedAt: safeNullableString(item.lastSyncedAt),
      syncStatus: item.syncStatus,
      manualReviewStatus: item.manualReviewStatus,
    }];
  });
  const contactReferences = new Set(contacts.map((contact) => contact.contactReference));
  const mappingCandidates = value.mappingCandidates.flatMap((item) => {
    if (
      !isRecord(item) ||
      !isKeyOf(item.mappingStatus, mappingLabels) ||
      !isKeyOf(item.manualReviewStatus, reviewLabels)
    ) return [];
    const contactReference = safeString(item.contactReference, '');
    if (!contactReferences.has(contactReference)) return [];

    return [{
      mappingReference: safeString(item.mappingReference, 'mock-mapping'),
      contactReference,
      systemCustomerReference: safeString(item.systemCustomerReference, 'mock-customer'),
      mappingStatus: item.mappingStatus,
      confidenceLevel: item.confidenceLevel === 'high'
        ? 'high' as const
        : item.confidenceLevel === 'medium'
          ? 'medium' as const
          : 'low' as const,
      matchReasonCode: item.matchReasonCode === 'demo_reference_match'
        ? 'demo_reference_match' as const
        : 'mock_digest_candidate' as const,
      manualReviewStatus: item.manualReviewStatus,
      updatedAt: safeString(item.updatedAt, '未记录'),
    }];
  });
  const manualReview = value.manualReview.flatMap((item) => {
    if (!isRecord(item) || !isKeyOf(item.reviewStatus, reviewLabels)) return [];
    const contactReference = safeString(item.contactReference, '');
    if (!contactReferences.has(contactReference)) return [];

    return [{
      reviewReference: safeString(item.reviewReference, 'mock-review'),
      contactReference,
      reviewStatus: item.reviewStatus,
      reasonCode: item.reasonCode === 'mapping_conflict'
        ? 'mapping_conflict' as const
        : item.reasonCode === 'mapping_approved'
          ? 'mapping_approved' as const
          : item.reasonCode === 'mapping_rejected'
            ? 'mapping_rejected' as const
            : item.reasonCode === 'mapping_more_info_required'
              ? 'mapping_more_info_required' as const
              : 'mapping_candidate_review' as const,
      reviewedAt: safeNullableString(item.reviewedAt),
      nextAction: item.nextAction === 'review_mapping'
        ? 'review_mapping' as const
        : item.nextAction === 'keep_rejected'
          ? 'keep_rejected' as const
          : item.nextAction === 'provide_more_info'
            ? 'provide_more_info' as const
            : 'none' as const,
    }];
  });

  return {
    sourceKind: 'controlled_mock_fixture',
    dataMode: value.dataMode,
    readonly: true,
    mockDemo: true,
    containsRealCustomerData: false,
    authorizationStatus: value.authorizationStatus,
    providerState: value.providerState === 'mock_only'
      ? 'mock_only'
      : value.providerState === 'external_disabled'
        ? 'external_disabled'
        : 'disabled',
    syncStatus: value.syncStatus,
    lastSyncedAt: safeNullableString(value.lastSyncedAt),
    failClosed: value.failClosed,
    reason: value.reason === 'mock_readonly_ready'
      ? 'mock_readonly_ready'
      : value.reason === 'provider_disabled'
        ? 'provider_disabled'
        : value.reason === 'external_provider_disabled'
          ? 'external_provider_disabled'
          : value.reason === 'forbidden_field_blocked'
            ? 'forbidden_field_blocked'
            : 'authorization_not_available',
    contacts: value.failClosed ? [] : contacts,
    mappingCandidates: value.failClosed ? [] : mappingCandidates,
    manualReview: value.failClosed ? [] : manualReview,
    auditSummary: {
      eventCount: 0,
      blockedEventCount: 0,
      events: [],
    },
    forbiddenFieldsBlocked: value.forbiddenFieldsBlocked === true,
    fieldPolicy: {
      whitelistApplied: true,
      forbiddenFieldsReturned: false,
      notice: 'raw_identifiers_credentials_and_conversation_content_blocked',
    },
  };
}

function errorFromStatus(status: number) {
  if (status === 401) return { kind: 'error' as const, title: '登录状态已失效，请重新登录' };
  if (status === 403) return { kind: 'forbidden' as const, title: '当前账号没有查看外部联系人只读视图的权限' };
  return { kind: 'error' as const, title: '企业微信外部联系人只读视图暂时不可用' };
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-white/80 bg-white/78 p-4 shadow-sm backdrop-blur-xl">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-950">{value}</div>
    </article>
  );
}

function ExternalContactReadonlyContent({
  payload,
}: {
  payload: WeComExternalContactReadonlyApiPayload;
}) {
  const mappingByContact = new Map(
    payload.mappingCandidates.map((mapping) => [mapping.contactReference, mapping]),
  );
  const reviewByContact = new Map(
    payload.manualReview.map((review) => [review.contactReference, review]),
  );

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard label="授权状态" value={authorizationLabels[payload.authorizationStatus]} />
        <StatusCard label="同步状态" value={syncLabels[payload.syncStatus]} />
        <StatusCard label="最近同步时间" value={payload.lastSyncedAt ?? '未执行'} />
        <StatusCard label="数据来源" value="受控 mock / demo fixture" />
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <div className="font-semibold">
              外部 provider 保持关闭；当前仅展示受控 mock / demo 低敏数据。
            </div>
            <div className="mt-1">
              字段白名单已应用，原始身份标识、联系方式、凭证与沟通内容均被阻断。
            </div>
          </div>
        </div>
      </section>

      {payload.failClosed ? (
        <InstitutionPageState
          kind="forbidden"
          title="外部联系人数据已按 fail-closed 阻断"
          description={`授权：${authorizationLabels[payload.authorizationStatus]}；同步：${syncLabels[payload.syncStatus]}。当前不展示联系人、匹配或人工复核数据。`}
        />
      ) : null}

      {!payload.failClosed && payload.contacts.length === 0 ? (
        <InstitutionPageState
          kind="empty"
          title="暂无 mock / demo 外部联系人"
          description="当前机构没有可展示的受控低敏样例。"
        />
      ) : null}

      {!payload.failClosed && payload.contacts.length > 0 ? (
        <section className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-600">低敏只读列表</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950">外部联系人</h3>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
              <Users className="h-4 w-4" />
              {payload.contacts.length} 条 mock 数据
            </span>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {payload.contacts.map((contact) => {
              const mapping = mappingByContact.get(contact.contactReference);
              const review = reviewByContact.get(contact.contactReference);

              return (
                <article
                  key={contact.contactReference}
                  className="rounded-2xl border border-slate-200/80 bg-white/88 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold text-slate-950">{contact.displayName}</h4>
                      <p className="mt-1 text-sm text-slate-500">{contact.remarkSummary}</p>
                    </div>
                    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
                      {sourceLabels[contact.sourceType]}
                    </span>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-400">添加日期</dt>
                      <dd className="mt-1 font-semibold text-slate-700">{contact.addedAtDate}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">归属员工摘要</dt>
                      <dd className="mt-1 font-semibold text-slate-700">
                        {contact.owners.map((owner) => owner.displayName).join('、') || '未分配'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">客户匹配状态</dt>
                      <dd className="mt-1 font-semibold text-slate-700">
                        {mappingLabels[mapping?.mappingStatus ?? contact.mappingStatus]}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">人工复核状态</dt>
                      <dd className="mt-1 font-semibold text-slate-700">
                        {reviewLabels[review?.reviewStatus ?? contact.manualReviewStatus]}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {contact.tags.map((tag) => (
                      <span
                        key={`${contact.contactReference}-${tag.name}`}
                        className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        {[
          ['只读 mock / demo', '仅消费当前机构受控 fixture，不连接外部系统。'],
          ['字段白名单', '仅展示低敏名称、归属摘要、标签、来源、日期与状态。'],
          ['外部动作关闭', '页面没有写入动作，也不提供沟通内容入口。'],
        ].map(([title, description]) => (
          <article
            key={title}
            className="rounded-2xl border border-white/80 bg-white/72 p-4 shadow-sm backdrop-blur-xl"
          >
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h3 className="mt-3 text-sm font-semibold text-slate-950">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
          </article>
        ))}
      </section>
    </>
  );
}

export function WeComExternalContactReadonlyPanel() {
  const [state, setState] = useState<PanelState>({ status: 'loading' });

  useEffect(() => {
    let isActive = true;

    async function load() {
      try {
        const response = await fetch('/api/institution/wecom/external-contacts', {
          cache: 'no-store',
        });
        if (!response.ok) {
          if (isActive) setState({ status: 'error', ...errorFromStatus(response.status) });
          return;
        }

        const payload = parsePayload(await response.json());
        if (isActive) {
          setState(payload
            ? { status: 'loaded', payload }
            : { status: 'error', kind: 'error', title: '只读响应未通过字段白名单校验' });
        }
      } catch {
        if (isActive) {
          setState({
            status: 'error',
            kind: 'error',
            title: '企业微信外部联系人只读视图暂时不可用',
          });
        }
      }
    }

    void load();
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <InstitutionSectionHeader
        eyebrow="企业微信客户运营 / mock only"
        title="外部联系人只读视图"
        description="仅展示当前机构受控 mock / demo 外部联系人、授权、同步、匹配与人工复核状态。"
        tone="emerald"
        action={(
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            MOCK / DEMO · 只读
          </span>
        )}
      />

      {state.status === 'loading' ? (
        <InstitutionPageState kind="loading" title="正在加载外部联系人 mock / demo 只读视图..." />
      ) : null}
      {state.status === 'error' ? (
        <InstitutionPageState kind={state.kind} title={state.title} />
      ) : null}
      {state.status === 'loaded' ? (
        <ExternalContactReadonlyContent payload={state.payload} />
      ) : null}
    </div>
  );
}
