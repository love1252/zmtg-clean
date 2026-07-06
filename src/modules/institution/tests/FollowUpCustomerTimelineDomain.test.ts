import { describe, expect, it, vi } from 'vitest';
import {
  containsUnsafeFollowUpTimelineText,
  mapFollowUpCustomerTimelineEventToDto,
  sanitizeFollowUpTimelineText,
  type FollowUpCustomerTimelineEvent,
} from '@/modules/institution/domain/followup-customer-timeline';
import { recordFollowUpTimelineEvent } from '@/modules/institution/server/followup-customer-timeline-service';
import type { AccessContext } from '@/modules/security/domain/access-control';

const tenantContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  institutionId: 'demo-institution-001',
  source: 'demo_session',
};

describe('随访客户 timeline 领域模型', () => {
  it('只映射客户详情需要的低敏白名单字段', () => {
    const event = {
      id: 'ftl_001',
      tenantId: 'demo-tenant-001',
      institutionId: 'inst_001',
      customerId: 'cust_001',
      sourceType: 'message_draft',
      sourceId: 'draft_001:message_draft_marked_sent',
      eventType: 'message_draft_marked_sent',
      eventTitle: '消息草稿标记已人工发送',
      safeSummary: '标记已发送仅代表人工记录，不代表系统自动发送。',
      riskLevel: null,
      occurredAt: '2026-07-06T10:00:00.000Z',
      safeActorRole: 'tenant_admin',
      safeReasonCode: 'message_draft_marked_sent',
      metadataJson: {
        provider: 'blocked-provider',
        token: 'blocked-token',
        cost: 100,
      },
      createdAt: '2026-07-06T10:00:00.000Z',
      updatedAt: '2026-07-06T10:00:00.000Z',
    } satisfies FollowUpCustomerTimelineEvent;

    const dto = mapFollowUpCustomerTimelineEventToDto(event);
    const serialized = JSON.stringify(dto);

    expect(dto).toEqual({
      eventId: 'ftl_001',
      customerId: 'cust_001',
      eventType: 'message_draft_marked_sent',
      eventTitle: '消息草稿标记已人工发送',
      safeSummary: '标记已发送仅代表人工记录，不代表系统自动发送。',
      riskLevel: null,
      occurredAt: '2026-07-06T10:00:00.000Z',
      sourceType: 'message_draft',
      sourceId: 'draft_001:message_draft_marked_sent',
      safeReasonCode: 'message_draft_marked_sent',
    });
    expect(serialized).not.toContain('tenantId');
    expect(serialized).not.toContain('institutionId');
    expect(serialized).not.toContain('safeActorRole');
    expect(serialized).not.toContain('metadataJson');
    expect(serialized).not.toContain('blocked-provider');
    expect(serialized).not.toContain('blocked-token');
  });

  it('拦截不允许写入随访 timeline 的敏感内容', () => {
    expect(containsUnsafeFollowUpTimelineText('客户反馈恢复良好')).toBe(false);
    expect(containsUnsafeFollowUpTimelineText('手机号原文 13800000000')).toBe(true);
    expect(containsUnsafeFollowUpTimelineText('身份证 110101199001010011')).toBe(true);
    expect(containsUnsafeFollowUpTimelineText('HIS payload')).toBe(true);
    expect(containsUnsafeFollowUpTimelineText('provider model token cost')).toBe(true);
    expect(sanitizeFollowUpTimelineText('手机号原文 13800000000', '低敏随访执行记录。')).toBe(
      '低敏随访执行记录。',
    );
  });

  it('写入 timeline 前移除 metadata 中的 provider / token / model / cost 等敏感键', async () => {
    const recordFollowUpCustomerTimelineEvent = vi.fn(async (input) => ({
      kind: 'created' as const,
      event: {
        id: input.id,
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        customerId: input.customerId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        eventType: input.eventType,
        eventTitle: input.eventTitle,
        safeSummary: input.safeSummary,
        riskLevel: input.riskLevel,
        occurredAt: input.occurredAt,
        safeActorRole: input.safeActorRole,
        safeReasonCode: input.safeReasonCode,
        metadataJson: input.metadataJson,
        createdAt: input.occurredAt,
        updatedAt: input.occurredAt,
      },
    }));
    const repository = {
      getCustomerByTenant: vi.fn(async () => ({ id: 'cust_001' })),
      recordFollowUpCustomerTimelineEvent,
    };

    await recordFollowUpTimelineEvent({
      context: tenantContext,
      tenantBusinessRepository: repository,
      customerId: 'cust_001',
      sourceType: 'manual_note',
      sourceId: 'manual:cust_001:2026-07-07T00:00:00.000Z',
      eventType: 'manual_feedback_recorded',
      eventTitle: '人工反馈 / 备注',
      safeSummary: '客户反馈恢复良好，继续人工随访。',
      riskLevel: 'normal',
      occurredAt: '2026-07-07T00:00:00.000Z',
      safeReasonCode: 'manual_feedback_recorded',
      metadataJson: {
        relatedTaskId: 'fu_001',
        provider: 'blocked-provider',
        model: 'blocked-model',
        token: 'blocked-token',
        cost: 12,
        vendor: 'blocked-vendor',
        prompt: 'blocked prompt',
      },
    });

    const metadataJson = recordFollowUpCustomerTimelineEvent.mock.calls[0]?.[0].metadataJson;
    expect(metadataJson).toEqual({ relatedTaskId: 'fu_001' });
    expect(JSON.stringify(metadataJson)).not.toMatch(/provider|model|token|cost|vendor|prompt/i);
  });
});
