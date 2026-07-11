import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/institution/followup-message-drafts/[draftId]/wecom-controlled-reachout/route';
import type { FollowUpMessageDraft } from '@/modules/institution/domain/followup-message-drafts';
import {
  createMessageDeliveryFromApprovedDraft,
  type MessageDelivery,
} from '@/modules/institution/domain/followup-message-deliveries';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
  const repository = {
    getFollowUpMessageDraftByTenantAndInstitution: vi.fn(),
    listMessageDeliveriesForDraft: vi.fn(),
    getCustomerByTenantAndInstitution: vi.fn(),
    updateFollowUpMessageDraftControlledReachOut: vi.fn(),
    getCustomerByTenant: vi.fn(),
    recordFollowUpCustomerTimelineEvent: vi.fn(),
  };
  const mappingRepository = {
    findByScope: vi.fn(),
    findByScopeForUpdate: vi.fn(),
  };
  const safetyRepository = {
    findConsent: vi.fn(),
    findConsentForUpdate: vi.fn(),
    findFrequency: vi.fn(),
    createFrequencyIfAbsent: vi.fn(),
    updateFrequencyWhenVersion: vi.fn(),
    findDryRunSnapshot: vi.fn(),
    findDryRunSnapshotForUpdate: vi.fn(),
  };
  const auditRepository = { record: vi.fn() };
  const transactionDatabase = { name: 'transaction-db' };
  const database = {
    transaction: vi.fn(async (operation: (database: typeof transactionDatabase) => unknown) => operation(transactionDatabase)),
  };
  return {
    repository,
    mappingRepository,
    safetyRepository,
    auditRepository,
    database,
    transactionDatabase,
    getDatabase: vi.fn(() => database),
    getDemoAccessContextFromRequest: vi.fn(),
    createTenantBusinessRepository: vi.fn(() => repository),
    createWeComCustomerMappingRepository: vi.fn(() => mappingRepository),
    createTrustedReachOutSafetyRepository: vi.fn(() => safetyRepository),
    createAuditEventRepository: vi.fn(() => auditRepository),
  };
});

vi.mock('@/server/db/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/db/client')>()),
  getDatabase: routeMocks.getDatabase,
}));
vi.mock('@/modules/security/server/access-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/security/server/access-context')>()),
  getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
}));
vi.mock('@/modules/institution/server/tenant-business-repository', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/institution/server/tenant-business-repository')>()),
  createTenantBusinessRepository: routeMocks.createTenantBusinessRepository,
}));
vi.mock('@/modules/institution/server/wecom-customer-mapping-repository', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/institution/server/wecom-customer-mapping-repository')>()),
  createWeComCustomerMappingRepository: routeMocks.createWeComCustomerMappingRepository,
}));
vi.mock('@/modules/institution/server/trusted-reachout-safety-repository', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/institution/server/trusted-reachout-safety-repository')>()),
  createTrustedReachOutSafetyRepository: routeMocks.createTrustedReachOutSafetyRepository,
}));
vi.mock('@/modules/audit/server/audit-event-repository', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/audit/server/audit-event-repository')>()),
  createAuditEventRepository: routeMocks.createAuditEventRepository,
}));

const adminContext: AccessContext = {
  userId: 'admin-a', role: 'tenant_admin', scope: 'tenant', tenantId: 'tenant-a', institutionId: 'inst-a', source: 'demo_session',
};
const operatorContext: AccessContext = { ...adminContext, userId: 'operator-a', role: 'tenant_operator' };

function metadata() {
  return {};
}

function trustedConsent(status: 'consented' | 'opted_out' | 'consent_revoked' = 'consented') {
  return {
    id: 'consent-a', tenantId: 'tenant-a', institutionId: 'inst-a', customerId: 'customer-a',
    channelType: 'wechat_work', status,
    sourceType: status === 'opted_out' ? 'customer_opt_out_request' : status === 'consent_revoked'
      ? 'customer_consent_revocation' : 'customer_explicit_written',
    evidenceRef: 'wcc-low-sensitive', recordedBy: 'admin-a', recordedAt: '2026-07-11T07:00:00.000Z', version: 1,
  };
}

function trustedFrequency(overrides: Record<string, unknown> = {}) {
  return {
    id: 'frequency-a', tenantId: 'tenant-a', institutionId: 'inst-a', customerId: 'customer-a',
    channelType: 'wechat_work', windowStartedAt: '2026-07-11T08:00:00.000Z',
    windowEndsAt: '2026-07-12T08:00:00.000Z', preparedCount: 1, completedCount: 0,
    maxPreparedCount: 1, maxCompletedCount: 1, nextAllowedAt: '2026-07-12T08:00:00.000Z',
    lastPreparedRef: 'wrop_delivery_msg-delivery_draft-a', lastCompletedRef: null, version: 1, ...overrides,
  };
}

function trustedDryRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'snapshot-a', tenantId: 'tenant-a', institutionId: 'inst-a', channelType: 'wechat_work',
    officialRoute: 'official_wecom_self_built', proofInstitutionRef: 'proof-inst', callbackPlaceholderRef: 'callback-placeholder',
    configStatus: 'dry_run_ready', preflightStatus: 'mock_ready', proofEligibleMock: true, evaluatedBy: 'admin-a',
    evaluatedAt: '2026-07-11T08:30:00.000Z', allowRealSend: false, externalChannelEnabled: false,
    realSendAllowed: false, dryRunOnly: true, version: 1, ...overrides,
  };
}

function controlledMetadata() {
  return {
    controlledReachOutId: 'wecom-controlled-reachout-draft-a', messageDraftId: 'draft-a',
    messageDeliveryId: 'msg-delivery:draft-a', customerId: 'customer-a', proofContactId: 'live-contact-proof-01',
    status: 'ready_no_send', consentStatus: 'consented', frequencyDecision: 'reserved', dryRunStatus: 'dry_run_ready',
    preparedBy: 'admin-a', preparedAt: '2026-07-11T09:00:00.000Z', realSendEnabled: false,
    noRealSend: true, noRealNetwork: true,
  };
}

function draft(overrides: Partial<FollowUpMessageDraft> = {}): FollowUpMessageDraft {
  return {
    id: 'draft-a', tenantId: 'tenant-a', institutionId: 'inst-a', followUpTaskId: 'task-a', enrollmentId: null,
    stageId: null, customerId: 'customer-a', customerDisplayName: '低敏客户', templateId: null, channelType: 'manual',
    status: 'approved', draftContent: '低敏草稿', editedContent: null, safePreview: '低敏草稿', approvedBy: 'admin-a',
    approvedAt: '2026-07-11T08:00:00.000Z', rejectedBy: null, rejectedAt: null, markedSentBy: null,
    markedSentAt: null, safeReasonCode: 'draft_approved', metadataJson: metadata(), createdAt: '2026-07-11T07:00:00.000Z',
    updatedAt: '2026-07-11T08:00:00.000Z', ...overrides,
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

function mapping(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mapping-a', tenantId: 'tenant-a', institutionId: 'inst-a', proofContactId: 'live-contact-proof-01',
    proofEmployeeId: 'live-employee-proof-01', sourceMode: 'real_readonly_proof', customerId: 'customer-a', status: 'confirmed',
    decidedBy: 'admin-a', decidedAt: '2026-07-11T08:00:00.000Z', createdAt: '2026-07-11T08:00:00.000Z',
    updatedAt: '2026-07-11T08:00:00.000Z', ...overrides,
  };
}

function getRequest() {
  return new Request('http://localhost/api/institution/followup-message-drafts/draft-a/wecom-controlled-reachout');
}
function postRequest(body: unknown, headers?: HeadersInit) {
  return new Request('http://localhost/api/institution/followup-message-drafts/draft-a/wecom-controlled-reachout', {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
}
const params = { params: Promise.resolve({ draftId: 'draft-a' }) };
const validBody = { action: 'prepare_no_send', confirmation: 'CONFIRM_SINGLE_CUSTOMER_WECOM_NO_SEND' };

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(adminContext);
  routeMocks.repository.getFollowUpMessageDraftByTenantAndInstitution.mockResolvedValue(draft());
  routeMocks.repository.listMessageDeliveriesForDraft.mockResolvedValue([delivery()]);
  routeMocks.repository.getCustomerByTenantAndInstitution.mockResolvedValue({ id: 'customer-a' });
  routeMocks.repository.getCustomerByTenant.mockResolvedValue({ id: 'customer-a' });
  routeMocks.repository.updateFollowUpMessageDraftControlledReachOut.mockImplementation(async (input) => ({
    kind: 'updated', draft: draft({ metadataJson: input.metadataJson, updatedAt: input.occurredAt }),
  }));
  routeMocks.repository.recordFollowUpCustomerTimelineEvent.mockImplementation(async (input) => ({
    kind: 'created', event: { ...input, createdAt: input.occurredAt, updatedAt: input.occurredAt },
  }));
  routeMocks.mappingRepository.findByScope.mockResolvedValue(mapping());
  routeMocks.mappingRepository.findByScopeForUpdate.mockResolvedValue(mapping());
  routeMocks.safetyRepository.findConsent.mockResolvedValue(trustedConsent());
  routeMocks.safetyRepository.findConsentForUpdate.mockResolvedValue(trustedConsent());
  routeMocks.safetyRepository.findFrequency.mockResolvedValue(null);
  routeMocks.safetyRepository.createFrequencyIfAbsent.mockImplementation(async (input) => trustedFrequency({ lastPreparedRef: input.operationRef }));
  routeMocks.safetyRepository.updateFrequencyWhenVersion.mockImplementation(async (input) => trustedFrequency({ lastPreparedRef: input.operationRef, version: 2 }));
  routeMocks.safetyRepository.findDryRunSnapshot.mockResolvedValue(trustedDryRun());
  routeMocks.safetyRepository.findDryRunSnapshotForUpdate.mockResolvedValue(trustedDryRun());
  routeMocks.auditRepository.record.mockResolvedValue(undefined);
  routeMocks.database.transaction.mockImplementation(async (operation) => operation(routeMocks.transactionDatabase));
});

describe('WeCom controlled reach-out API', () => {
  it('GET/POST 未登录返回 401', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
    const post = postRequest(validBody);
    const textSpy = vi.spyOn(post, 'text');
    expect((await GET(getRequest(), params)).status).toBe(401);
    expect((await POST(post, params)).status).toBe(401);
    expect(textSpy).not.toHaveBeenCalled();
    expect(routeMocks.database.transaction).not.toHaveBeenCalled();
  });

  it('tenant_operator 可 GET 只读，POST 返回 403 且不读 body', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(operatorContext);
    const getResponse = await GET(getRequest(), params);
    const post = postRequest(validBody);
    const textSpy = vi.spyOn(post, 'text');
    const postResponse = await POST(post, params);

    expect(getResponse.status).toBe(200);
    expect((await getResponse.json()).preflight.readOnly).toBe(true);
    expect(postResponse.status).toBe(403);
    expect(textSpy).not.toHaveBeenCalled();
    expect(routeMocks.database.transaction).not.toHaveBeenCalled();
  });

  it('跨机构或不存在 draft 统一 404，audit 不记录请求 draftId', async () => {
    routeMocks.repository.getFollowUpMessageDraftByTenantAndInstitution.mockResolvedValue(null);
    const response = await POST(postRequest(validBody), params);
    expect(response.status).toBe(404);
    expect(routeMocks.auditRepository.record).toHaveBeenCalledWith(expect.not.objectContaining({ resourceId: 'draft-a' }));
  });

  it('body 按 UTF-8 最大 512 bytes，拒绝额外字段和非精确确认', async () => {
    const oversized = await POST(postRequest(validBody, { 'content-length': '513' }), params);
    const utf8OversizedRequest = new Request(
      'http://localhost/api/institution/followup-message-drafts/draft-a/wecom-controlled-reachout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: `${' '.repeat(513)}${JSON.stringify(validBody)}`,
      },
    );
    expect(utf8OversizedRequest.headers.get('content-length')).toBeNull();
    const utf8Oversized = await POST(utf8OversizedRequest, params);
    const extra = await POST(postRequest({ ...validBody, tenantId: 'tenant-b' }), params);
    const invalidConfirmation = await POST(postRequest({ ...validBody, confirmation: 'CONFIRM' }), params);

    expect(oversized.status).toBe(413);
    expect(utf8Oversized.status).toBe(413);
    expect(extra.status).toBe(400);
    expect(invalidConfirmation.status).toBe(400);
  });

  it.each([
    ['draft_not_approved', () => routeMocks.repository.getFollowUpMessageDraftByTenantAndInstitution.mockResolvedValue(draft({ status: 'draft' }))],
    ['delivery_missing', () => routeMocks.repository.listMessageDeliveriesForDraft.mockResolvedValue([])],
    ['mapping_not_confirmed', () => routeMocks.mappingRepository.findByScopeForUpdate.mockResolvedValue(mapping({ status: 'rejected' }))],
    ['mapping_customer_mismatch', () => routeMocks.mappingRepository.findByScopeForUpdate.mockResolvedValue(mapping({ customerId: 'customer-b' }))],
    ['customer_not_found', () => routeMocks.repository.getCustomerByTenantAndInstitution.mockResolvedValue(null)],
    ['consent_missing', () => routeMocks.safetyRepository.findConsent.mockResolvedValue(null)],
    ['consent_revoked', () => routeMocks.safetyRepository.findConsent.mockResolvedValue(trustedConsent('consent_revoked'))],
    ['opt_out', () => routeMocks.safetyRepository.findConsent.mockResolvedValue(trustedConsent('opted_out'))],
    ['frequency_cap_reached', () => routeMocks.safetyRepository.findFrequency.mockResolvedValue(trustedFrequency({ lastPreparedRef: 'wrop_delivery_other' }))],
    ['dry_run_not_ready', () => routeMocks.safetyRepository.findDryRunSnapshotForUpdate.mockResolvedValue(trustedDryRun({ configStatus: 'blocked' }))],
  ] as const)('POST %s 阻断并写固定 denied audit', async (reason, arrange) => {
    arrange();
    const response = await POST(postRequest(validBody), params);
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: reason });
    expect(routeMocks.repository.updateFollowUpMessageDraftControlledReachOut).not.toHaveBeenCalled();
    expect(routeMocks.auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({ result: 'denied' }));
  });

  it.each([
    ['wechat_work', { channelType: 'wechat_work' }],
    ['sms', { channelType: 'sms' }],
    ['external delivery', { channelType: 'sms', deliveryMode: 'external_disabled', status: 'external_disabled' }],
  ] as const)('POST 阻断 %s，不 reserve 也不写 metadata', async (_label, override) => {
    routeMocks.repository.listMessageDeliveriesForDraft.mockResolvedValue([
      delivery(override as unknown as Partial<MessageDelivery>),
    ]);

    const response = await POST(postRequest(validBody), params);

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'delivery_not_internal_mock' });
    expect(routeMocks.safetyRepository.createFrequencyIfAbsent).not.toHaveBeenCalled();
    expect(routeMocks.repository.updateFollowUpMessageDraftControlledReachOut).not.toHaveBeenCalled();
    expect(routeMocks.auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      result: 'denied',
      reason: 'wecom_controlled_reachout_delivery_not_internal_mock',
    }));
  });

  it('dry-run 在 reserve 后变为 blocked 时回滚 frequency 并写固定 denied audit', async () => {
    let frequencyWrites = 0;
    routeMocks.safetyRepository.createFrequencyIfAbsent.mockImplementation(async (input) => {
      frequencyWrites += 1;
      return trustedFrequency({ lastPreparedRef: input.operationRef });
    });
    routeMocks.safetyRepository.findDryRunSnapshotForUpdate.mockResolvedValue(
      trustedDryRun({ configStatus: 'blocked' }),
    );
    routeMocks.database.transaction.mockImplementation(async (operation) => {
      try {
        return await operation(routeMocks.transactionDatabase);
      } catch (error) {
        frequencyWrites = 0;
        throw error;
      }
    });

    const response = await POST(postRequest(validBody), params);

    expect(response.status).toBe(422);
    expect(frequencyWrites).toBe(0);
    expect(routeMocks.repository.updateFollowUpMessageDraftControlledReachOut).not.toHaveBeenCalled();
    expect(routeMocks.auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      result: 'denied', reason: 'wecom_controlled_reachout_dry_run_not_ready',
    }));
  });

  it('formal mock_sent delivery 准备 ready_no_send 后四个 delivery 字段完全不变', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const originalDraft = draft();
    const originalDelivery = delivery();
    const deliveryBeforePost = structuredClone(originalDelivery);
    routeMocks.repository.getFollowUpMessageDraftByTenantAndInstitution.mockResolvedValue(originalDraft);
    routeMocks.repository.listMessageDeliveriesForDraft.mockResolvedValue([originalDelivery]);
    const response = await POST(postRequest(validBody), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ idempotent: false, preflight: { controlledReachOut: { status: 'ready_no_send' } } });
    expect(routeMocks.database.transaction).toHaveBeenCalledOnce();
    expect(routeMocks.createTenantBusinessRepository).toHaveBeenCalledWith(routeMocks.transactionDatabase);
    expect(routeMocks.createWeComCustomerMappingRepository).toHaveBeenCalledWith(routeMocks.transactionDatabase);
    expect(routeMocks.createTrustedReachOutSafetyRepository).toHaveBeenCalledWith(routeMocks.transactionDatabase);
    expect(routeMocks.createAuditEventRepository).toHaveBeenCalledWith(routeMocks.transactionDatabase);
    expect(routeMocks.auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'follow_up', resourceId: 'draft-a', result: 'transitioned', reason: 'wecom_controlled_reachout_ready_no_send',
    }));
    expect(routeMocks.repository.recordFollowUpCustomerTimelineEvent).not.toHaveBeenCalled();
    expect(routeMocks.repository.updateFollowUpMessageDraftControlledReachOut).toHaveBeenCalledWith(expect.objectContaining({
      metadataJson: expect.objectContaining({ weComControlledReachOut: expect.objectContaining({ status: 'ready_no_send' }) }),
    }));
    const metadataJson = routeMocks.repository.updateFollowUpMessageDraftControlledReachOut.mock.calls[0]?.[0].metadataJson;
    expect(Object.keys(metadataJson)).toEqual(['weComControlledReachOut']);
    expect(originalDraft).toMatchObject({ status: 'approved', markedSentBy: null, markedSentAt: null });
    expect(originalDelivery).toEqual(deliveryBeforePost);
    expect(originalDelivery).toMatchObject({
      status: 'mock_sent',
      sentAt: '2026-07-11T08:00:00.000Z',
      channelType: 'mock',
      deliveryMode: 'mock',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('同 draft + delivery + customer 重复 POST 幂等，不重复 frequency 与 success audit', async () => {
    routeMocks.repository.getFollowUpMessageDraftByTenantAndInstitution.mockResolvedValue(draft({
      metadataJson: { weComControlledReachOut: controlledMetadata() },
    }));
    routeMocks.safetyRepository.findFrequency.mockResolvedValue(trustedFrequency());

    const response = await POST(postRequest(validBody), params);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ idempotent: true });
    expect(routeMocks.safetyRepository.createFrequencyIfAbsent).not.toHaveBeenCalled();
    expect(routeMocks.repository.updateFollowUpMessageDraftControlledReachOut).not.toHaveBeenCalled();
    expect(routeMocks.auditRepository.record).not.toHaveBeenCalledWith(expect.objectContaining({
      reason: 'wecom_controlled_reachout_ready_no_send',
    }));
  });

  it('stale conflict 返回 409 并写 denied audit，不覆盖', async () => {
    let frequencyWrites = 0;
    routeMocks.safetyRepository.createFrequencyIfAbsent.mockImplementation(async (input) => {
      frequencyWrites += 1;
      return trustedFrequency({ lastPreparedRef: input.operationRef });
    });
    routeMocks.database.transaction.mockImplementation(async (operation) => {
      try {
        return await operation(routeMocks.transactionDatabase);
      } catch (error) {
        frequencyWrites = 0;
        throw error;
      }
    });
    routeMocks.repository.updateFollowUpMessageDraftControlledReachOut.mockResolvedValue({ kind: 'conflict', resourceId: 'draft-a', reason: 'conflict' });
    const response = await POST(postRequest(validBody), params);
    expect(response.status).toBe(409);
    expect(frequencyWrites).toBe(0);
    expect(routeMocks.auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      result: 'denied', reason: 'wecom_controlled_reachout_conflict',
    }));
  });

  it('success audit 失败回滚 frequency 与 ready_no_send metadata，API 不返回成功', async () => {
    let frequencyWrites = 0;
    let metadataWrites = 0;
    routeMocks.safetyRepository.createFrequencyIfAbsent.mockImplementation(async (input) => {
      frequencyWrites += 1;
      return trustedFrequency({ lastPreparedRef: input.operationRef });
    });
    routeMocks.repository.updateFollowUpMessageDraftControlledReachOut.mockImplementation(async (input) => {
      metadataWrites += 1;
      return { kind: 'updated', draft: draft({ metadataJson: input.metadataJson, updatedAt: input.occurredAt }) };
    });
    routeMocks.auditRepository.record.mockImplementation(async (event) => {
      if (event.reason === 'wecom_controlled_reachout_ready_no_send') {
        throw new Error('audit unavailable');
      }
    });
    routeMocks.database.transaction.mockImplementation(async (operation) => {
      try {
        return await operation(routeMocks.transactionDatabase);
      } catch (error) {
        frequencyWrites = 0;
        metadataWrites = 0;
        throw error;
      }
    });
    const response = await POST(postRequest(validBody), params);
    expect(response.status).toBe(503);
    expect(routeMocks.repository.updateFollowUpMessageDraftControlledReachOut).toHaveBeenCalledOnce();
    expect(routeMocks.auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'wecom_controlled_reachout_ready_no_send',
    }));
    expect(frequencyWrites).toBe(0);
    expect(metadataWrites).toBe(0);
  });

  it('返回与持久化内容无禁止字段', async () => {
    const response = await POST(postRequest(validBody), params);
    const serialized = JSON.stringify(await response.json()) + JSON.stringify(routeMocks.repository.updateFollowUpMessageDraftControlledReachOut.mock.calls);
    expect(serialized).not.toMatch(/external_userid|UserID|corpId|agentId|Secret|token|rawResponse|https?:|phone|freeTextPayload/i);
  });

  it('服务端源码不读取旧 metadata 安全事实、不调用 fetch 或发送入口', () => {
    const testsDirectory = dirname(fileURLToPath(import.meta.url));
    const sources = [
      resolve(testsDirectory, '../domain/wecom-controlled-reachout.ts'),
      resolve(testsDirectory, '../server/wecom-controlled-reachout-service.ts'),
      resolve(testsDirectory, '../server/wecom-controlled-reachout-transaction.ts'),
      resolve(testsDirectory, '../../../app/api/institution/followup-message-drafts/[draftId]/wecom-controlled-reachout/route.ts'),
    ].map((path) => readFileSync(path, 'utf8')).join('\n');

    expect(sources).not.toMatch(/contactSafetyPolicy|weComOfficialDryRunConfig/);
    expect(sources).not.toMatch(/\bfetch\s*\(|globalThis\.fetch|\.env\.local|process\.env/);
    expect(sources).not.toMatch(/mark_sent|markFollowUpMessageDraftAsSent|send_succeeded|real_sent/);
  });
});
