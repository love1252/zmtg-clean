import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';
import type { FollowUpMessageDraft } from '@/modules/institution/domain/followup-message-drafts';
import {
  createMessageDeliveryFromApprovedDraft,
  type MessageDelivery,
} from '@/modules/institution/domain/followup-message-deliveries';
import {
  getWeComControlledReachOut,
  prepareWeComControlledReachOut,
  WeComControlledReachOutTransactionAbort,
} from '@/modules/institution/server/wecom-controlled-reachout-service';
import type { AccessContext } from '@/modules/security/domain/access-control';

const context: AccessContext = {
  userId: 'admin-a', role: 'tenant_admin', scope: 'tenant', tenantId: 'tenant-a', institutionId: 'inst-a', source: 'demo_session',
};

function draft(overrides: Partial<FollowUpMessageDraft> = {}): FollowUpMessageDraft {
  return {
    id: 'draft-a', tenantId: 'tenant-a', institutionId: 'inst-a', followUpTaskId: 'task-a',
    enrollmentId: null, stageId: null, customerId: 'customer-a', customerDisplayName: '低敏客户',
    templateId: null, channelType: 'manual', status: 'approved', draftContent: '低敏草稿',
    editedContent: null, safePreview: '低敏草稿', approvedBy: 'admin-a',
    approvedAt: '2026-07-11T08:00:00.000Z', rejectedBy: null, rejectedAt: null,
    markedSentBy: null, markedSentAt: null, safeReasonCode: 'draft_approved', metadataJson: {},
    createdAt: '2026-07-11T07:00:00.000Z', updatedAt: '2026-07-11T08:00:00.000Z', ...overrides,
  };
}

function delivery(overrides: Partial<MessageDelivery> = {}): MessageDelivery {
  const result = createMessageDeliveryFromApprovedDraft({
    draft: draft(),
    actorId: 'admin-a',
    occurredAt: '2026-07-11T08:00:00.000Z',
  });
  if (result.kind !== 'created') throw new Error('approved draft must create an internal mock delivery');
  return { ...result.delivery, ...overrides };
}

function mapping(status: 'confirmed' | 'rejected' | 'revoked' = 'confirmed', customerId = 'customer-a') {
  return {
    id: 'mapping-a', tenantId: 'tenant-a', institutionId: 'inst-a', proofContactId: 'live-contact-proof-01',
    proofEmployeeId: 'live-employee-proof-01', sourceMode: 'real_readonly_proof' as const, customerId, status,
    decidedBy: 'admin-a', decidedAt: '2026-07-11T08:00:00.000Z', createdAt: '2026-07-11T08:00:00.000Z',
    updatedAt: '2026-07-11T08:00:00.000Z',
  };
}

function customer(): CustomerRecordSummary {
  return {
    id: 'customer-a', tenantId: 'tenant-a', institutionId: 'inst-a', displayName: '低敏客户',
    lifecycle: 'consulting', priority: 'medium', ownerUserId: 'operator-a', projectInterest: '低敏项目',
    maskedPhone: '138****0000', maskedMedicalRecordNo: 'MR****001', lastTouchSummary: '待人工跟进',
    nextAction: '人工确认', tags: [], gender: 'unknown', birthDate: '', referralSource: '', notes: '',
  };
}

function consent(status: 'consented' | 'unknown' | 'opted_out' | 'consent_revoked' = 'consented') {
  if (status === 'unknown') return null;
  return {
    id: 'consent-a', tenantId: 'tenant-a', institutionId: 'inst-a', customerId: 'customer-a',
    channelType: 'wechat_work' as const, status,
    sourceType: status === 'opted_out'
      ? 'customer_opt_out_request' as const
      : status === 'consent_revoked'
        ? 'customer_consent_revocation' as const
        : 'customer_explicit_written' as const,
    evidenceRef: 'wcc-low-sensitive', recordedBy: 'admin-a', recordedAt: '2026-07-11T07:30:00.000Z', version: 1,
  };
}

function frequency(overrides: Record<string, unknown> = {}) {
  return {
    id: 'frequency-a', tenantId: 'tenant-a', institutionId: 'inst-a', customerId: 'customer-a',
    channelType: 'wechat_work' as const, windowStartedAt: '2026-07-11T09:00:00.000Z',
    windowEndsAt: '2026-07-12T09:00:00.000Z', preparedCount: 1, completedCount: 0,
    maxPreparedCount: 1 as const, maxCompletedCount: 1 as const, nextAllowedAt: '2026-07-12T09:00:00.000Z',
    lastPreparedRef: 'wrop_delivery_msg-delivery_draft-a', lastCompletedRef: null, version: 1, ...overrides,
  };
}

function dryRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'snapshot-a', tenantId: 'tenant-a', institutionId: 'inst-a', channelType: 'wechat_work' as const,
    officialRoute: 'official_wecom_self_built', proofInstitutionRef: 'proof-inst',
    callbackPlaceholderRef: 'callback-placeholder', configStatus: 'dry_run_ready' as const,
    preflightStatus: 'mock_ready' as const, proofEligibleMock: true, evaluatedBy: 'admin-a',
    evaluatedAt: '2026-07-11T08:30:00.000Z', allowRealSend: false as const,
    externalChannelEnabled: false as const, realSendAllowed: false as const, dryRunOnly: true as const,
    version: 1, ...overrides,
  };
}

function dependencies() {
  const repository = {
    getFollowUpMessageDraftByTenantAndInstitution: vi.fn(async () => draft() as FollowUpMessageDraft | null),
    listMessageDeliveriesForDraft: vi.fn(async () => [delivery()] as MessageDelivery[]),
    getCustomerByTenantAndInstitution: vi.fn(async () => customer() as CustomerRecordSummary | null),
    updateFollowUpMessageDraftControlledReachOut: vi.fn(async (input: { metadataJson: Record<string, unknown>; occurredAt: string }): Promise<
      | { kind: 'updated'; draft: FollowUpMessageDraft }
      | { kind: 'conflict'; resourceId: string; reason: 'conflict' }
    > => ({
      kind: 'updated' as const,
      draft: draft({ metadataJson: input.metadataJson, updatedAt: input.occurredAt }),
    })),
  };
  const mappingRepository = {
    findByScope: vi.fn(async () => mapping()),
    findByScopeForUpdate: vi.fn(async () => mapping()),
  };
  const safetyRepository = {
    findConsent: vi.fn(async () => consent()),
    findConsentForUpdate: vi.fn(async () => consent()),
    findFrequency: vi.fn(async () => null as ReturnType<typeof frequency> | null),
    createFrequencyIfAbsent: vi.fn(async (input: { operationRef: string }) => frequency({ lastPreparedRef: input.operationRef })),
    updateFrequencyWhenVersion: vi.fn(async (input: { operationRef: string }) => frequency({ lastPreparedRef: input.operationRef, version: 2 })),
    findDryRunSnapshot: vi.fn(async (): Promise<ReturnType<typeof dryRun> | null> => dryRun()),
    findDryRunSnapshotForUpdate: vi.fn(async (): Promise<ReturnType<typeof dryRun> | null> => dryRun()),
  };
  const auditRepository = { record: vi.fn(async () => undefined) };
  return {
    repository, mappingRepository, safetyRepository, auditRepository,
    occurredAt: '2026-07-11T09:00:00.000Z', createId: () => 'generated-low-sensitive-id',
  };
}

beforeEach(() => vi.clearAllMocks());

describe('weComControlledReachOut service', () => {
  it('GET 使用严格 scope 读取可信 consent/frequency/dry-run 摘要', async () => {
    const deps = dependencies();
    const result = await getWeComControlledReachOut({ context, draftId: 'draft-a', ...deps });

    expect(result).toMatchObject({
      kind: 'success',
      preflight: {
        canPrepare: true, blockReason: null, consent: { status: 'consented' },
        frequency: { status: 'available' }, dryRun: { status: 'dry_run_ready' },
      },
    });
    expect(deps.safetyRepository.findConsent).toHaveBeenCalledWith({
      tenantId: 'tenant-a', institutionId: 'inst-a', customerId: 'customer-a',
    });
    expect(deps.safetyRepository.findDryRunSnapshot).toHaveBeenCalledWith({ tenantId: 'tenant-a', institutionId: 'inst-a' });
  });

  it.each([
    ['draft_not_found', (deps: ReturnType<typeof dependencies>) => deps.repository.getFollowUpMessageDraftByTenantAndInstitution.mockResolvedValue(null)],
    ['draft_not_approved', (deps: ReturnType<typeof dependencies>) => deps.repository.getFollowUpMessageDraftByTenantAndInstitution.mockResolvedValue(draft({ status: 'draft' }))],
    ['delivery_missing', (deps: ReturnType<typeof dependencies>) => deps.repository.listMessageDeliveriesForDraft.mockResolvedValue([])],
    ['delivery_not_unique', (deps: ReturnType<typeof dependencies>) => deps.repository.listMessageDeliveriesForDraft.mockResolvedValue([delivery(), delivery({ id: 'delivery-other' })])],
    ['delivery_customer_mismatch', (deps: ReturnType<typeof dependencies>) => deps.repository.listMessageDeliveriesForDraft.mockResolvedValue([delivery({ customerId: 'customer-b' })])],
    ['delivery_customer_mismatch', (deps: ReturnType<typeof dependencies>) => deps.repository.listMessageDeliveriesForDraft.mockResolvedValue([delivery({ followUpTaskId: 'task-b' })])],
    ['delivery_not_internal_mock', (deps: ReturnType<typeof dependencies>) => deps.repository.listMessageDeliveriesForDraft.mockResolvedValue([delivery({ id: 'delivery-forged' })])],
    ['mapping_not_confirmed', (deps: ReturnType<typeof dependencies>) => deps.mappingRepository.findByScopeForUpdate.mockResolvedValue(mapping('rejected'))],
    ['mapping_customer_mismatch', (deps: ReturnType<typeof dependencies>) => deps.mappingRepository.findByScopeForUpdate.mockResolvedValue(mapping('confirmed', 'customer-b'))],
    ['customer_not_found', (deps: ReturnType<typeof dependencies>) => deps.repository.getCustomerByTenantAndInstitution.mockResolvedValue(null)],
  ] as const)('POST 阻断 %s 且不 reserve、不写 metadata', async (expected, arrange) => {
    const deps = dependencies();
    arrange(deps);
    const result = await prepareWeComControlledReachOut({ context, draftId: 'draft-a', ...deps });

    expect(result).toEqual({ kind: 'failed', reason: expected });
    expect(deps.safetyRepository.createFrequencyIfAbsent).not.toHaveBeenCalled();
    expect(deps.repository.updateFollowUpMessageDraftControlledReachOut).not.toHaveBeenCalled();
  });

  it.each([
    ['unknown', 'consent_missing'],
    ['consent_revoked', 'consent_revoked'],
    ['opted_out', 'opt_out'],
  ] as const)('可信 consent %s 阻断为 %s，opted_out 优先', async (status, reason) => {
    const deps = dependencies();
    deps.safetyRepository.findConsent.mockResolvedValue(consent(status));
    deps.safetyRepository.findConsentForUpdate.mockResolvedValue(consent(status));

    const result = await prepareWeComControlledReachOut({ context, draftId: 'draft-a', ...deps });

    expect(result).toEqual({ kind: 'failed', reason });
    expect(deps.safetyRepository.createFrequencyIfAbsent).not.toHaveBeenCalled();
  });

  it('approved draft 的正式 mock_sent delivery 通过 trusted gates 后达到 ready_no_send', async () => {
    const deps = dependencies();
    const originalDelivery = delivery();
    const deliveryBeforePost = structuredClone(originalDelivery);
    deps.repository.listMessageDeliveriesForDraft.mockResolvedValue([originalDelivery]);

    const result = await prepareWeComControlledReachOut({ context, draftId: 'draft-a', ...deps });

    expect(result).toMatchObject({
      kind: 'ready', idempotent: false,
      preflight: { controlledReachOut: { status: 'ready_no_send', consentStatus: 'consented', frequencyDecision: 'reserved' } },
    });
    expect(deps.safetyRepository.createFrequencyIfAbsent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-a', institutionId: 'inst-a', customerId: 'customer-a',
      operationRef: 'wrop_delivery_msg-delivery_draft-a',
    }));
    expect(deps.safetyRepository.findDryRunSnapshotForUpdate).toHaveBeenCalledWith({
      tenantId: 'tenant-a', institutionId: 'inst-a',
    });
    const mappingLockOrder = deps.mappingRepository.findByScopeForUpdate.mock.invocationCallOrder[0]!;
    const consentLockOrder = deps.safetyRepository.findConsentForUpdate.mock.invocationCallOrder[0]!;
    const frequencyOrder = deps.safetyRepository.createFrequencyIfAbsent.mock.invocationCallOrder[0]!;
    const snapshotLockOrder = deps.safetyRepository.findDryRunSnapshotForUpdate.mock.invocationCallOrder[0]!;
    const draftCasOrder = deps.repository.updateFollowUpMessageDraftControlledReachOut.mock.invocationCallOrder[0]!;
    expect(mappingLockOrder).toBeLessThan(consentLockOrder);
    expect(consentLockOrder).toBeLessThan(frequencyOrder);
    expect(frequencyOrder).toBeLessThan(snapshotLockOrder);
    expect(snapshotLockOrder).toBeLessThan(draftCasOrder);
    expect(deps.auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'wecom_reachout_frequency_reserved',
    }));
    expect(originalDelivery).toEqual(deliveryBeforePost);
    expect(originalDelivery).toMatchObject({
      channelType: 'mock',
      deliveryMode: 'mock',
      status: 'mock_sent',
      sentAt: '2026-07-11T08:00:00.000Z',
    });
  });

  it.each([
    ['wechat_work', { channelType: 'wechat_work' }],
    ['sms', { channelType: 'sms' }],
    ['external_disabled', { deliveryMode: 'external_disabled', status: 'external_disabled' }],
    ['real_sent', { status: 'real_sent' }],
    ['send_succeeded', { status: 'send_succeeded' }],
  ] as const)('%s 或真实渠道语义 delivery 失败关闭', async (_label, override) => {
    const deps = dependencies();
    deps.repository.listMessageDeliveriesForDraft.mockResolvedValue([
      delivery(override as unknown as Partial<MessageDelivery>),
    ]);

    const result = await prepareWeComControlledReachOut({ context, draftId: 'draft-a', ...deps });

    expect(result).toEqual({ kind: 'failed', reason: 'delivery_not_internal_mock' });
    expect(deps.safetyRepository.findConsentForUpdate).not.toHaveBeenCalled();
    expect(deps.repository.updateFollowUpMessageDraftControlledReachOut).not.toHaveBeenCalled();
  });

  it('pending delivery 仅作为兼容只读状态，不能证明 ready_no_send 成功路径', async () => {
    const deps = dependencies();
    deps.repository.listMessageDeliveriesForDraft.mockResolvedValue([
      delivery({ status: 'pending', sentAt: null }),
    ]);

    const readResult = await getWeComControlledReachOut({ context, draftId: 'draft-a', ...deps });
    const prepareResult = await prepareWeComControlledReachOut({ context, draftId: 'draft-a', ...deps });

    expect(readResult).toMatchObject({
      kind: 'success',
      preflight: { canPrepare: false, blockReason: 'delivery_not_internal_mock' },
    });
    expect(prepareResult).toEqual({ kind: 'failed', reason: 'delivery_not_internal_mock' });
    expect(deps.safetyRepository.createFrequencyIfAbsent).not.toHaveBeenCalled();
  });

  it('同 operation frequency 幂等，已有相同 ready_no_send 不重复写 metadata', async () => {
    const deps = dependencies();
    const existing = {
      controlledReachOutId: 'wecom-controlled-reachout-draft-a', messageDraftId: 'draft-a',
      messageDeliveryId: 'msg-delivery:draft-a', customerId: 'customer-a', proofContactId: 'live-contact-proof-01',
      status: 'ready_no_send', consentStatus: 'consented', frequencyDecision: 'reserved', dryRunStatus: 'dry_run_ready',
      preparedBy: 'admin-a', preparedAt: '2026-07-11T09:00:00.000Z', realSendEnabled: false,
      noRealSend: true, noRealNetwork: true,
    } as const;
    deps.repository.getFollowUpMessageDraftByTenantAndInstitution.mockResolvedValue(draft({
      metadataJson: { weComControlledReachOut: existing },
    }));
    deps.safetyRepository.findFrequency.mockResolvedValue(frequency());

    const result = await prepareWeComControlledReachOut({ context, draftId: 'draft-a', ...deps });

    expect(result).toMatchObject({ kind: 'ready', idempotent: true });
    expect(deps.safetyRepository.createFrequencyIfAbsent).not.toHaveBeenCalled();
    expect(deps.auditRepository.record).not.toHaveBeenCalled();
    expect(deps.repository.updateFollowUpMessageDraftControlledReachOut).not.toHaveBeenCalled();
  });

  it('已存在但无法解析的 controlled metadata 失败关闭且不 reserve', async () => {
    const deps = dependencies();
    deps.repository.getFollowUpMessageDraftByTenantAndInstitution.mockResolvedValue(draft({
      metadataJson: { weComControlledReachOut: { status: 'ready_no_send', realSendEnabled: true } },
    }));

    const result = await prepareWeComControlledReachOut({ context, draftId: 'draft-a', ...deps });

    expect(result).toEqual({ kind: 'failed', reason: 'conflict' });
    expect(deps.safetyRepository.findConsentForUpdate).not.toHaveBeenCalled();
    expect(deps.safetyRepository.createFrequencyIfAbsent).not.toHaveBeenCalled();
  });

  it('reserve 行锁看到并发 consent_revoked 时使用锁内事实阻断', async () => {
    const deps = dependencies();
    deps.safetyRepository.findConsent
      .mockResolvedValueOnce(consent('consented'))
      .mockResolvedValueOnce(consent('consent_revoked'));
    deps.safetyRepository.findConsentForUpdate.mockResolvedValue(consent('consent_revoked'));

    const result = await prepareWeComControlledReachOut({ context, draftId: 'draft-a', ...deps });

    expect(result).toEqual({ kind: 'failed', reason: 'consent_revoked' });
    expect(deps.safetyRepository.createFrequencyIfAbsent).not.toHaveBeenCalled();
  });

  it('不同 operation 在同窗口内 frequency cap 阻断', async () => {
    const deps = dependencies();
    deps.safetyRepository.findFrequency.mockResolvedValue(frequency({ lastPreparedRef: 'wrop_delivery_other' }));

    const result = await prepareWeComControlledReachOut({ context, draftId: 'draft-a', ...deps });

    expect(result).toEqual({ kind: 'failed', reason: 'frequency_cap_reached' });
    expect(deps.repository.updateFollowUpMessageDraftControlledReachOut).not.toHaveBeenCalled();
  });

  it('dry-run missing / blocked / wrong route / wrong preflight 在 reserve 后触发事务回滚信号', async () => {
    for (const snapshot of [
      null,
      dryRun({ configStatus: 'blocked' }),
      dryRun({ officialRoute: 'official_wecom_third_party' }),
      dryRun({ officialRoute: 'official_wecom_service_provider' }),
      dryRun({ preflightStatus: 'blocked_safety_switch' }),
    ]) {
      const deps = dependencies();
      deps.safetyRepository.findDryRunSnapshotForUpdate.mockResolvedValue(snapshot as ReturnType<typeof dryRun> | null);

      await expect(prepareWeComControlledReachOut({ context, draftId: 'draft-a', ...deps }))
        .rejects.toMatchObject({ reason: 'dry_run_not_ready' });
      expect(deps.repository.updateFollowUpMessageDraftControlledReachOut).not.toHaveBeenCalled();
    }
  });

  it('CAS conflict 在 frequency reserved 后触发事务回滚信号', async () => {
    const deps = dependencies();
    deps.repository.updateFollowUpMessageDraftControlledReachOut.mockResolvedValue({
      kind: 'conflict', resourceId: 'draft-a', reason: 'conflict',
    });

    await expect(prepareWeComControlledReachOut({ context, draftId: 'draft-a', ...deps }))
      .rejects.toBeInstanceOf(WeComControlledReachOutTransactionAbort);
  });

  it('frequency 幂等时 CAS 后置映射冲突仍触发事务回滚', async () => {
    const deps = dependencies();
    deps.safetyRepository.findFrequency.mockResolvedValue(frequency());
    deps.repository.updateFollowUpMessageDraftControlledReachOut.mockResolvedValue({
      kind: 'conflict', resourceId: 'draft-a', reason: 'conflict',
    });

    await expect(prepareWeComControlledReachOut({ context, draftId: 'draft-a', ...deps }))
      .rejects.toMatchObject({ reason: 'conflict' });
    expect(deps.safetyRepository.createFrequencyIfAbsent).not.toHaveBeenCalled();
  });

  it('frequency audit 失败向上抛出，不能继续写 ready_no_send', async () => {
    const deps = dependencies();
    deps.auditRepository.record.mockRejectedValue(new Error('audit unavailable'));

    await expect(prepareWeComControlledReachOut({ context, draftId: 'draft-a', ...deps }))
      .rejects.toThrow('audit unavailable');
    expect(deps.repository.updateFollowUpMessageDraftControlledReachOut).not.toHaveBeenCalled();
  });
});
