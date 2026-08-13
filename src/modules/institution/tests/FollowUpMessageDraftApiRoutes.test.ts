import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mintAttemptedInstitutionDenialAttributionForOrchestrationV1,
  mintVerifiedInstitutionAuditAttributionForOrchestrationV1,
} from '@/modules/audit/domain/audit-events';
import {
  allowedFollowUpMessageAudit,
  deniedFollowUpMessageAudit,
} from '@/modules/institution/server/followup-message-draft-api';

vi.mock('@/app/api/institution/_shared/institution-route-guard', () => ({
  withInstitutionSectionRouteGuardV1: ({
    handler,
  }: {
    handler: (...args: unknown[]) => Response | Promise<Response>;
  }) => handler,
}));

import {
  GET as draftsGet,
  POST as draftsPost,
} from '@/app/api/institution/followup-message-drafts/route';
import { PATCH as draftPatch } from '@/app/api/institution/followup-message-drafts/[draftId]/route';
import { POST as draftApprovePost } from '@/app/api/institution/followup-message-drafts/[draftId]/approve/route';
import { POST as draftRejectPost } from '@/app/api/institution/followup-message-drafts/[draftId]/reject/route';
import { POST as draftMarkSentPost } from '@/app/api/institution/followup-message-drafts/[draftId]/mark-sent/route';
import { GET as templatesGet } from '@/app/api/institution/followup-message-templates/route';

const routeMocks = vi.hoisted(() => {
  const auditRecord = vi.fn();
  return {
    approveMessageDraft: vi.fn(),
    auditRecord,
    createAuditEventRepository: vi.fn(() => ({ record: auditRecord })),
    createMessageDraftForFollowUpTask: vi.fn(),
    createTenantBusinessRepository: vi.fn(() => ({ repository: 'tenant-business' })),
    getDatabase: vi.fn(() => ({ database: 'test-db' })),
    getDemoAccessContextFromRequest: vi.fn(),
    listFollowUpMessageTemplates: vi.fn(),
    listMessageDraftsForFollowUpTask: vi.fn(),
    markMessageDraftAsSent: vi.fn(),
    rejectMessageDraft: vi.fn(),
    updateMessageDraftContent: vi.fn(),
  };
});

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return { ...actual, getDatabase: routeMocks.getDatabase };
});

vi.mock('@/modules/security/server/access-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/security/server/access-context')>();
  return { ...actual, getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest };
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

const capabilityDisabledPayload = {
  code: 'capability_disabled',
  error: '随访消息草稿能力当前未启用',
} as const;

const templateCapabilityDisabledPayload = {
  code: 'capability_disabled',
  error: '随访消息模板能力当前未启用',
} as const;

const followUpAuditContext = Object.freeze({
  userId: 'demo-user-admin',
  role: 'tenant_admin' as const,
  scope: 'tenant' as const,
  tenantId: 'demo-tenant-001',
  institutionId: 'demo-inst-001',
  source: 'server_session' as const,
});

const disabledRoutePaths = [
  'src/app/api/institution/followup-message-templates/route.ts',
  'src/app/api/institution/followup-message-drafts/route.ts',
  'src/app/api/institution/followup-message-drafts/[draftId]/route.ts',
  'src/app/api/institution/followup-message-drafts/[draftId]/approve/route.ts',
  'src/app/api/institution/followup-message-drafts/[draftId]/reject/route.ts',
  'src/app/api/institution/followup-message-drafts/[draftId]/mark-sent/route.ts',
] as const;

const forbiddenResponseKeys = [
  'record',
  'records',
  'templateId',
  'templateKey',
  'templateName',
  'templateType',
  'applicableTemplateKey',
  'applicableNodeKey',
  'safePreview',
  'channelType',
  'delivery',
  'draftId',
  'customerId',
  'status',
  'audit',
  'mockDemo',
  'outcome',
  'result',
] as const;

function request(path: string, init?: RequestInit) {
  return new Request(`http://localhost${path}`, init);
}

function params(draftId = 'draft_001') {
  return { params: Promise.resolve({ draftId }) };
}

function hostileRequest() {
  let trapCount = 0;
  const request = new Proxy(Object.create(null), {
    get() {
      trapCount += 1;
      throw new Error('request must not be read');
    },
    getOwnPropertyDescriptor() {
      trapCount += 1;
      throw new Error('request must not be inspected');
    },
    has() {
      trapCount += 1;
      throw new Error('request must not be inspected');
    },
    ownKeys() {
      trapCount += 1;
      throw new Error('request must not be enumerated');
    },
  }) as Request;
  return { request, trapCount: () => trapCount };
}

function hostileParams() {
  let trapCount = 0;
  const context = new Proxy({ params: Promise.resolve({ draftId: 'draft-hostile' }) }, {
    get() {
      trapCount += 1;
      throw new Error('params must not be read');
    },
    getOwnPropertyDescriptor() {
      trapCount += 1;
      throw new Error('params must not be inspected');
    },
    has() {
      trapCount += 1;
      throw new Error('params must not be inspected');
    },
    ownKeys() {
      trapCount += 1;
      throw new Error('params must not be enumerated');
    },
  }) as { params: Promise<{ draftId: string }> };
  return { context, trapCount: () => trapCount };
}

async function expectCapabilityDisabled(response: Response, secret = '') {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const payload = await response.json();
  expect(payload).toEqual(capabilityDisabledPayload);
  for (const key of forbiddenResponseKeys) {
    expect(payload).not.toHaveProperty(key);
  }
  if (secret) expect(JSON.stringify(payload)).not.toContain(secret);
}

async function expectTemplateCapabilityDisabled(response: Response, secret = '') {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const payload = await response.json();
  expect(payload).toEqual(templateCapabilityDisabledPayload);
  for (const key of forbiddenResponseKeys) {
    expect(payload).not.toHaveProperty(key);
  }
  if (secret) expect(JSON.stringify(payload)).not.toContain(secret);
}

function expectDisabledRouteDownstreamsIdle() {
  for (const dependency of [
    routeMocks.approveMessageDraft,
    routeMocks.auditRecord,
    routeMocks.createAuditEventRepository,
    routeMocks.createMessageDraftForFollowUpTask,
    routeMocks.createTenantBusinessRepository,
    routeMocks.getDatabase,
    routeMocks.getDemoAccessContextFromRequest,
    routeMocks.listFollowUpMessageTemplates,
    routeMocks.listMessageDraftsForFollowUpTask,
    routeMocks.markMessageDraftAsSent,
    routeMocks.rejectMessageDraft,
    routeMocks.updateMessageDraftContent,
  ]) {
    expect(dependency).not.toHaveBeenCalled();
  }
}

beforeEach(() => {
  for (const dependency of Object.values(routeMocks)) {
    if (typeof dependency === 'function') dependency.mockReset();
  }
  routeMocks.auditRecord.mockResolvedValue(undefined);
  routeMocks.createAuditEventRepository.mockReturnValue({ record: routeMocks.auditRecord });
  routeMocks.createTenantBusinessRepository.mockReturnValue({ repository: 'tenant-business' });
  routeMocks.getDatabase.mockReturnValue({ database: 'test-db' });
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue({
    userId: 'demo-user-admin',
    role: 'tenant_admin',
    scope: 'tenant',
    tenantId: 'demo-tenant-001',
    institutionId: 'inst-001',
    source: 'demo_session',
  });
});

describe('随访消息草稿 attributed Audit helper', () => {
  it('allowed 使用 formal/business corroborated verified handle', () => {
    const attribution = mintVerifiedInstitutionAuditAttributionForOrchestrationV1({
      formalPair: {
        tenantId: 'demo-tenant-001',
        institutionId: 'demo-inst-001',
        observedAt: '2026-08-13T08:00:00.000Z',
      },
      businessPair: {
        tenantId: 'demo-tenant-001',
        institutionId: 'demo-inst-001',
      },
    });
    if (!attribution) throw new Error('expected verified test attribution');

    expect(
      allowedFollowUpMessageAudit({
        context: followUpAuditContext,
        action: 'create',
        reason: 'allowed_by_policy',
        occurredAt: '2026-08-13T08:00:00.000Z',
        attribution,
      }),
    ).toMatchObject({
      result: 'allowed',
      institutionAttribution: 'verified',
      tenantId: 'demo-tenant-001',
      institutionId: 'demo-inst-001',
    });
  });

  it('pre-scope denial 只接受 signed-session attempted pair', () => {
    const attemptedPair = Object.freeze({
      tenantId: 'demo-tenant-001',
      institutionId: 'demo-inst-001',
    });
    const attribution = mintAttemptedInstitutionDenialAttributionForOrchestrationV1({
      signedSessionPair: attemptedPair,
    });
    if (!attribution) throw new Error('expected attempted-denial test attribution');

    expect(
      deniedFollowUpMessageAudit({
        context: followUpAuditContext,
        action: 'approve',
        reason: 'role_denied',
        occurredAt: '2026-08-13T08:00:00.000Z',
        attribution: { kind: 'attempted_denial', attribution, attemptedPair },
      }),
    ).toMatchObject({
      result: 'denied',
      institutionAttribution: 'verified',
      tenantId: 'demo-tenant-001',
      institutionId: 'demo-inst-001',
    });
    expect(() =>
      deniedFollowUpMessageAudit({
        context: followUpAuditContext,
        action: 'approve',
        reason: 'role_denied',
        occurredAt: '2026-08-13T08:00:00.000Z',
        attribution: {
          kind: 'attempted_denial',
          attribution,
          attemptedPair: { ...attemptedPair, institutionId: 'other-institution' },
        },
      }),
    ).toThrow('invalid_followup_message_denial_audit_attribution');
  });
});

describe('follow-up message draft API routes', () => {
  it('GET templates 对普通、查询和非法输入同步固定关闭且不回显输入', async () => {
    const secret = 'template-input-must-not-echo';
    const responses = await Promise.all([
      templatesGet(request('/api/institution/followup-message-templates')),
      templatesGet(
        request(
          `/api/institution/followup-message-templates?tenantId=other-tenant&templateKey=${secret}`,
        ),
      ),
      templatesGet(request('/api/institution/followup-message-templates?include=&channel=unknown')),
    ]);

    for (const response of responses) {
      await expectTemplateCapabilityDisabled(response, secret);
    }
    expectDisabledRouteDownstreamsIdle();
  });

  it('所有草稿 handler 对普通与非法输入固定 fail-closed，且不回显输入', async () => {
    const secret = 'draft-input-must-not-echo';
    const ordinary = [
      () => draftsGet(request(`/api/institution/followup-message-drafts?taskId=${secret}`, {
        headers: { cookie: 'demo_session=forged' },
      })),
      () => draftsPost(request('/api/institution/followup-message-drafts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ followUpTaskId: secret, templateId: 'template-forged' }),
      })),
      () => draftPatch(request(`/api/institution/followup-message-drafts/${secret}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: secret }),
      }), params(secret)),
      () => draftApprovePost(request(`/api/institution/followup-message-drafts/${secret}/approve`, { method: 'POST' }), params(secret)),
      () => draftRejectPost(request(`/api/institution/followup-message-drafts/${secret}/reject`, { method: 'POST' }), params(secret)),
      () => draftMarkSentPost(request(`/api/institution/followup-message-drafts/${secret}/mark-sent`, { method: 'POST' }), params(secret)),
    ];
    const invalid = [
      () => draftsGet(request('/api/institution/followup-message-drafts?taskId=')),
      () => draftsPost(request('/api/institution/followup-message-drafts', { method: 'POST', body: '{invalid' })),
      () => draftPatch(request('/api/institution/followup-message-drafts/', { method: 'PATCH', body: '{invalid' }), params('')),
      () => draftApprovePost(request('/api/institution/followup-message-drafts//approve', { method: 'POST' }), params('')),
      () => draftRejectPost(request('/api/institution/followup-message-drafts//reject', { method: 'POST' }), params('')),
      () => draftMarkSentPost(request('/api/institution/followup-message-drafts//mark-sent', { method: 'POST' }), params('')),
    ];

    for (const invoke of [...ordinary, ...invalid]) {
      await expectCapabilityDisabled(await invoke(), secret);
    }
    expectDisabledRouteDownstreamsIdle();
  });

  it('所有关闭模板和草稿 handler 对 hostile Request/params 既不读 body 也不触发下游', async () => {
    const templateRequest = hostileRequest();
    const getRequest = hostileRequest();
    const postRequest = hostileRequest();
    const patchRequest = hostileRequest();
    const approveRequest = hostileRequest();
    const rejectRequest = hostileRequest();
    const markSentRequest = hostileRequest();
    const patchParams = hostileParams();
    const approveParams = hostileParams();
    const rejectParams = hostileParams();
    const markSentParams = hostileParams();

    await expectTemplateCapabilityDisabled(await templatesGet(templateRequest.request));

    for (const invoke of [
      () => draftsGet(getRequest.request),
      () => draftsPost(postRequest.request),
      () => draftPatch(patchRequest.request, patchParams.context),
      () => draftApprovePost(approveRequest.request, approveParams.context),
      () => draftRejectPost(rejectRequest.request, rejectParams.context),
      () => draftMarkSentPost(markSentRequest.request, markSentParams.context),
    ]) {
      await expectCapabilityDisabled(await invoke());
    }

    for (const hostile of [
      templateRequest, getRequest, postRequest, patchRequest, approveRequest, rejectRequest, markSentRequest,
      patchParams, approveParams, rejectParams, markSentParams,
    ]) {
      expect(hostile.trapCount()).toBe(0);
    }
    expectDisabledRouteDownstreamsIdle();
  });

  it('所有关闭模板和草稿 route 只保留 NextResponse，且不装配 request、params、session、DB、审计或交付下游', () => {
    for (const routePath of disabledRoutePaths) {
      const source = readFileSync(resolve(process.cwd(), routePath), 'utf8');
      expect(source).toContain("import { NextResponse } from 'next/server';");
      for (const forbiddenSource of [
        'access-context',
        'audit-event-repository',
        'followup-message-draft-api',
        'followup-message-draft-service',
        'tenant-business-repository',
        'getDatabase',
        'canAccessResource',
        'fetch(',
        'request.',
        'request[',
        '_request.',
        '_request[',
        'params.',
        'params[',
        '_context.',
        '_context[',
      ]) {
        expect(source).not.toContain(forbiddenSource);
      }
    }
  });
});
