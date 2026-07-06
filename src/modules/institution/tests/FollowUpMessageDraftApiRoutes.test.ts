import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GET as draftsGet,
  POST as draftsPost,
} from '@/app/api/institution/followup-message-drafts/route';
import { PATCH as draftPatch } from '@/app/api/institution/followup-message-drafts/[draftId]/route';
import { POST as draftApprovePost } from '@/app/api/institution/followup-message-drafts/[draftId]/approve/route';
import { POST as draftRejectPost } from '@/app/api/institution/followup-message-drafts/[draftId]/reject/route';
import { POST as draftMarkSentPost } from '@/app/api/institution/followup-message-drafts/[draftId]/mark-sent/route';
import { GET as templatesGet } from '@/app/api/institution/followup-message-templates/route';
import type { FollowUpMessageDraftDto } from '@/modules/institution/domain/followup-message-drafts';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
  const auditRecord = vi.fn();
  const transactionDatabase = { database: 'transaction-db' };
  const database = {
    database: 'test-db',
    transaction: vi.fn(async (operation: (tx: typeof transactionDatabase) => unknown) =>
      operation(transactionDatabase),
    ),
  };

  return {
    approveMessageDraft: vi.fn(),
    auditRecord,
    createAuditEventRepository: vi.fn(() => ({ record: auditRecord })),
    createMessageDraftForFollowUpTask: vi.fn(),
    createTenantBusinessRepository: vi.fn(() => ({ repository: 'tenant-business' })),
    database,
    getDatabase: vi.fn(),
    getDemoAccessContextFromRequest: vi.fn(),
    listFollowUpMessageTemplates: vi.fn(),
    listMessageDraftsForFollowUpTask: vi.fn(),
    markMessageDraftAsSent: vi.fn(),
    rejectMessageDraft: vi.fn(),
    transactionDatabase,
    updateMessageDraftContent: vi.fn(),
  };
});

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return { ...actual, getDatabase: routeMocks.getDatabase };
});

vi.mock('@/modules/security/server/access-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/security/server/access-context')>();
  return {
    ...actual,
    getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
  };
});

vi.mock('@/modules/audit/server/audit-event-repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/audit/server/audit-event-repository')>();
  return { ...actual, createAuditEventRepository: routeMocks.createAuditEventRepository };
});

vi.mock('@/modules/institution/server/tenant-business-repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/institution/server/tenant-business-repository')>();
  return { ...actual, createTenantBusinessRepository: routeMocks.createTenantBusinessRepository };
});

vi.mock('@/modules/institution/server/followup-message-draft-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/institution/server/followup-message-draft-service')>();
  return {
    ...actual,
    approveMessageDraft: routeMocks.approveMessageDraft,
    createMessageDraftForFollowUpTask: routeMocks.createMessageDraftForFollowUpTask,
    listFollowUpMessageTemplates: routeMocks.listFollowUpMessageTemplates,
    listMessageDraftsForFollowUpTask: routeMocks.listMessageDraftsForFollowUpTask,
    markMessageDraftAsSent: routeMocks.markMessageDraftAsSent,
    rejectMessageDraft: routeMocks.rejectMessageDraft,
    updateMessageDraftContent: routeMocks.updateMessageDraftContent,
  };
});

const tenantContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  institutionId: 'inst-001',
  source: 'demo_session',
};

const draftRecord: FollowUpMessageDraftDto = {
  draftId: 'draft_001',
  followUpTaskId: 'task_001',
  customerId: 'cust_001',
  customerDisplayName: '陈女士',
  channelType: 'manual',
  status: 'draft',
  safePreview: '陈女士，D1 护理随访，请人工确认恢复情况。',
  draftContent: '陈女士，D1 护理随访，请人工确认恢复情况。',
  editedContent: null,
  approvedAt: null,
  markedSentAt: null,
  safeReasonCode: 'fallback_generated',
  createdAt: '2026-07-06T08:00:00.000Z',
  updatedAt: '2026-07-06T08:00:00.000Z',
};

function request(path: string, init?: RequestInit) {
  return new Request(`http://localhost${path}`, init);
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  routeMocks.approveMessageDraft.mockReset();
  routeMocks.auditRecord.mockReset();
  routeMocks.auditRecord.mockResolvedValue(undefined);
  routeMocks.createAuditEventRepository.mockClear();
  routeMocks.createMessageDraftForFollowUpTask.mockReset();
  routeMocks.createTenantBusinessRepository.mockClear();
  routeMocks.database.transaction.mockReset();
  routeMocks.database.transaction.mockImplementation(async (operation) =>
    operation(routeMocks.transactionDatabase),
  );
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
  routeMocks.listFollowUpMessageTemplates.mockReset();
  routeMocks.listMessageDraftsForFollowUpTask.mockReset();
  routeMocks.markMessageDraftAsSent.mockReset();
  routeMocks.rejectMessageDraft.mockReset();
  routeMocks.updateMessageDraftContent.mockReset();
});

describe('follow-up message draft API routes', () => {
  it('GET templates 返回模板白名单且隐藏 provider/token/prompt 字段', async () => {
    routeMocks.listFollowUpMessageTemplates.mockResolvedValue({
      kind: 'success',
      templates: [
        {
          id: 'tpl_001',
          templateKey: 'hydro_manual',
          templateName: '水光人工话术',
          templateType: 'post_care',
          applicableTemplateKey: 'hydro_injection_care',
          applicableNodeKey: null,
          channelType: 'manual',
          status: 'active',
          requiresHumanApproval: true,
          forbidAutoSend: true,
          safePreview: '低敏预览',
          createdAt: '2026-07-06T08:00:00.000Z',
          updatedAt: '2026-07-06T08:00:00.000Z',
        },
      ],
    });

    const response = await templatesGet(request('/api/institution/followup-message-templates'));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload.records).toEqual(expect.arrayContaining([expect.objectContaining({ templateKey: 'hydro_manual' })]));
    expect(JSON.stringify(payload)).not.toContain('provider');
    expect(JSON.stringify(payload)).not.toContain('token');
    expect(JSON.stringify(payload)).not.toContain('prompt');
  });

  it('GET drafts 按 taskId 返回草稿白名单并记录低敏审计', async () => {
    routeMocks.listMessageDraftsForFollowUpTask.mockResolvedValue({
      kind: 'success',
      drafts: [draftRecord],
    });

    const response = await draftsGet(request('/api/institution/followup-message-drafts?taskId=task_001'));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toEqual({ records: [draftRecord] });
    expect(routeMocks.listMessageDraftsForFollowUpTask).toHaveBeenCalledWith(
      expect.objectContaining({ context: tenantContext, followUpTaskId: 'task_001' }),
    );
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'allowed', resource: 'follow_up', resourceId: 'task_001' }),
    );
    expect(JSON.stringify(payload)).not.toContain('tenantId');
    expect(JSON.stringify(payload)).not.toContain('institutionId');
    expect(JSON.stringify(payload)).not.toContain('provider');
  });

  it('POST drafts 只接收 followUpTaskId/templateId 白名单字段并返回 201', async () => {
    routeMocks.createMessageDraftForFollowUpTask.mockResolvedValue({ kind: 'created', draft: draftRecord });

    const response = await draftsPost(
      request('/api/institution/followup-message-drafts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          followUpTaskId: 'task_001',
          templateId: 'tpl_001',
        }),
      }),
    );
    const payload = await json(response);

    expect(response.status).toBe(201);
    expect(payload).toEqual({ record: draftRecord });
    expect(routeMocks.createMessageDraftForFollowUpTask).toHaveBeenCalledWith(
      expect.objectContaining({ followUpTaskId: 'task_001', templateId: 'tpl_001' }),
    );
    expect(routeMocks.createMessageDraftForFollowUpTask).toHaveBeenCalledTimes(1);
  });

  it('PATCH drafts 只接收 content 并对 unsafe content 返回 409', async () => {
    routeMocks.updateMessageDraftContent.mockResolvedValueOnce({
      kind: 'conflict',
      resourceId: 'draft_001',
      reason: 'unsafe_follow_up_message_content',
    });

    const response = await draftPatch(
      request('/api/institution/followup-message-drafts/draft_001', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: '客户手机号 13812345678' }),
      }),
      { params: Promise.resolve({ draftId: 'draft_001' }) },
    );
    const payload = await json(response);

    expect(response.status).toBe(409);
    expect(payload).toEqual({
      code: 'unsafe_follow_up_message_content',
      error: '草稿内容包含不允许的敏感信息',
    });
    expect(routeMocks.updateMessageDraftContent).toHaveBeenCalledWith(
      expect.objectContaining({ draftId: 'draft_001', content: '客户手机号 13812345678' }),
    );
  });

  it('approve/reject/mark-sent 只做内部状态流转，不真实发送', async () => {
    routeMocks.approveMessageDraft.mockResolvedValue({
      kind: 'updated',
      draft: { ...draftRecord, status: 'approved', approvedAt: '2026-07-06T10:00:00.000Z' },
    });
    routeMocks.rejectMessageDraft.mockResolvedValue({
      kind: 'updated',
      draft: { ...draftRecord, status: 'rejected' },
    });
    routeMocks.markMessageDraftAsSent.mockResolvedValue({
      kind: 'updated',
      draft: { ...draftRecord, status: 'marked_sent', markedSentAt: '2026-07-06T11:00:00.000Z' },
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const approveResponse = await draftApprovePost(
      request('/api/institution/followup-message-drafts/draft_001/approve', { method: 'POST' }),
      { params: Promise.resolve({ draftId: 'draft_001' }) },
    );
    const rejectResponse = await draftRejectPost(
      request('/api/institution/followup-message-drafts/draft_001/reject', { method: 'POST' }),
      { params: Promise.resolve({ draftId: 'draft_001' }) },
    );
    const markSentResponse = await draftMarkSentPost(
      request('/api/institution/followup-message-drafts/draft_001/mark-sent', { method: 'POST' }),
      { params: Promise.resolve({ draftId: 'draft_001' }) },
    );

    expect(approveResponse.status).toBe(200);
    expect(rejectResponse.status).toBe(200);
    expect(markSentResponse.status).toBe(200);
    expect(routeMocks.approveMessageDraft).toHaveBeenCalledWith(
      expect.objectContaining({ context: tenantContext, draftId: 'draft_001' }),
    );
    expect(routeMocks.rejectMessageDraft).toHaveBeenCalledWith(
      expect.objectContaining({ context: tenantContext, draftId: 'draft_001' }),
    );
    expect(routeMocks.markMessageDraftAsSent).toHaveBeenCalledWith(
      expect.objectContaining({ context: tenantContext, draftId: 'draft_001' }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
