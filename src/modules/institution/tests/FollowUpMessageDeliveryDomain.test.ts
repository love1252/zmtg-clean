import { describe, expect, it } from 'vitest';
import {
  containsUnsafeMessageDeliveryText,
  createMessageDeliveryFromApprovedDraft,
  mapMessageDeliveryToDto,
  messageDeliveryContactSafetyAuditReason,
  messageDeliveryStatusAuditReason,
  messageDeliveryToTimelineMetadata,
  messageDeliveryWeComMockReachOutAuditReason,
  readMessageDeliveryFromMetadata,
  type MessageDelivery,
} from '@/modules/institution/domain/followup-message-deliveries';
import {
  createDefaultWeComAuthorizationRecord,
  createWeComAuthorizationRecord,
} from '@/modules/institution/domain/wecom-authorization';
import type { FollowUpMessageDraft } from '@/modules/institution/domain/followup-message-drafts';
import { createWeComCustomerContactMockRecord } from '@/modules/institution/domain/wecom-customer-contact';

const occurredAt = '2026-07-06T10:00:00.000Z';

function draft(overrides: Partial<FollowUpMessageDraft> = {}): FollowUpMessageDraft {
  return {
    id: 'draft-1',
    tenantId: 'tenant-a',
    institutionId: 'inst-a',
    followUpTaskId: 'task-1',
    enrollmentId: 'enrollment-1',
    stageId: 'stage-1',
    customerId: 'customer-1',
    customerDisplayName: '陈女士',
    templateId: null,
    channelType: 'manual',
    status: 'approved',
    draftContent: '陈女士，D1 水光补水观察，请人工确认护理情况。',
    editedContent: null,
    safePreview: '陈女士，D1 水光补水观察，请人工确认护理情况。',
    approvedBy: 'approver-1',
    approvedAt: occurredAt,
    rejectedBy: null,
    rejectedAt: null,
    markedSentBy: null,
    markedSentAt: null,
    safeReasonCode: 'draft_approved',
    metadataJson: { requiresHumanApproval: true, forbidAutoSend: true },
    createdAt: '2026-07-06T08:00:00.000Z',
    updatedAt: occurredAt,
    ...overrides,
  };
}

function weComContact(overrides: Parameters<typeof createWeComCustomerContactMockRecord>[0]['seed'] = {}) {
  return createWeComCustomerContactMockRecord({
    tenantId: 'tenant-a',
    institutionId: 'inst-a',
    authorizationRecordId: 'wecom-auth:mock:tenant-a:inst-a',
    index: 0,
    occurredAt,
    defaultSyncStatus: 'mock_synced',
    seed: {
      customerId: 'customer-1',
      customerDisplayName: '低敏客户A',
      linkedToSystemCustomer: true,
      availableForFollowUp: true,
      mappedSystemEmployeeRef: 'operator-1',
      tags: ['术后关怀', '低敏标签'],
      remarkSummary: '企业微信客户联系 mock 低敏摘要。',
      source: '术后随访低敏线索',
      ...overrides,
    },
  });
}

function delivery(overrides: Partial<MessageDelivery> = {}): MessageDelivery {
  const result = createMessageDeliveryFromApprovedDraft({
    draft: draft(),
    actorId: 'operator-1',
    occurredAt,
  });
  if (result.kind !== 'created') throw new Error('expected created delivery');
  return { ...result.delivery, ...overrides };
}

describe('follow-up message delivery domain', () => {
  it('只允许 approved draft 创建 MessageDelivery，并覆盖核心字段语义', () => {
    const result = createMessageDeliveryFromApprovedDraft({
      draft: draft(),
      actorId: 'operator-1',
      occurredAt,
    });

    expect(result).toEqual(expect.objectContaining({ kind: 'created' }));
    if (result.kind !== 'created') return;

    expect(result.delivery).toEqual(expect.objectContaining({
      id: 'msg-delivery:draft-1',
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      customerId: 'customer-1',
      followUpTaskId: 'task-1',
      messageDraftId: 'draft-1',
      channelType: 'mock',
      deliveryMode: 'mock',
      recipientRef: 'customer:customer-1',
      contentSnapshot: '陈女士,D1 水光补水观察,请人工确认护理情况。',
      status: 'mock_sent',
      failureReason: null,
      contactSafetyDecision: expect.objectContaining({
        allowed: true,
        code: 'allowed',
        auditReason: 'contact_safety_allowed',
      }),
      createdBy: 'operator-1',
      confirmedBy: 'approver-1',
      createdAt: occurredAt,
      sentAt: occurredAt,
      updatedAt: occurredAt,
    }));

    expect(createMessageDeliveryFromApprovedDraft({
      draft: draft({ status: 'draft', approvedBy: null, approvedAt: null }),
      actorId: 'operator-1',
      occurredAt,
    })).toEqual({ kind: 'invalid_status', status: 'draft' });
  });

  it('触达安全治理结果驱动 consent、opt-out、frequency cap 和灰度阻断', () => {
    const basePolicy = {
      consent: 'allowed' as const,
      optOut: false,
      frequencyCap: 'allowed' as const,
      channelEnabled: true,
      tenantAllowlist: ['tenant-a'] as string[],
      institutionAllowlist: ['inst-a'] as string[],
      channelTypeAllowlist: ['mock' as const],
      sandboxMockOnly: true,
      externalChannelEnabled: false,
      noRealSend: true as const,
    };
    const cases = [
      { policy: { ...basePolicy, consent: 'missing' as const }, reason: 'consent_missing', status: 'skipped', code: 'blocked_consent_missing' },
      { policy: { ...basePolicy, optOut: true }, reason: 'opt_out', status: 'skipped', code: 'blocked_opt_out' },
      { policy: { ...basePolicy, frequencyCap: 'reached' as const }, reason: 'frequency_cap_reached', status: 'skipped', code: 'blocked_frequency_cap' },
      { policy: { ...basePolicy, channelEnabled: false }, reason: 'channel_disabled', status: 'external_disabled', code: 'blocked_channel_disabled' },
      { policy: { ...basePolicy, tenantAllowlist: ['tenant-b'] }, reason: 'tenant_not_allowlisted', status: 'external_disabled', code: 'blocked_tenant_not_allowlisted' },
      { policy: { ...basePolicy, institutionAllowlist: ['inst-b'] }, reason: 'institution_not_allowlisted', status: 'external_disabled', code: 'blocked_institution_not_allowlisted' },
    ] as const;

    for (const item of cases) {
      const result = createMessageDeliveryFromApprovedDraft({
        draft: draft(),
        actorId: 'operator-1',
        occurredAt,
        options: { contactSafetyPolicy: item.policy },
      });

      expect(result.kind === 'created' && result.delivery).toEqual(expect.objectContaining({
        status: item.status,
        failureReason: item.reason,
        contactSafetyDecision: expect.objectContaining({ code: item.code, allowed: false }),
      }));
    }
  });

  it('触达安全阻断优先级高于外部传入的发送状态覆盖', () => {
    const result = createMessageDeliveryFromApprovedDraft({
      draft: draft(),
      actorId: 'operator-1',
      occurredAt,
      options: {
        status: 'mock_sent',
        contactSafetyPolicy: {
          consent: 'missing',
          optOut: false,
          frequencyCap: 'allowed',
          channelEnabled: true,
          tenantAllowlist: ['tenant-a'],
          institutionAllowlist: ['inst-a'],
          channelTypeAllowlist: ['mock'],
          sandboxMockOnly: true,
          externalChannelEnabled: false,
          noRealSend: true,
        },
      },
    });

    expect(result.kind === 'created' && result.delivery).toEqual(expect.objectContaining({
      status: 'skipped',
      failureReason: 'consent_missing',
      contactSafetyDecision: expect.objectContaining({
        allowed: false,
        code: 'blocked_consent_missing',
      }),
    }));
  });

  it('企业微信授权状态作为 wechat_work 触达前置判断，均不允许真实发送', () => {
    const cases = [
      {
        authorization: null,
        failureReason: 'wecom_authorization_missing',
        auditReason: 'wecom_mock_authorization_unavailable',
        label: '企业微信授权未配置',
      },
      {
        authorization: createWeComAuthorizationRecord({ tenantId: 'tenant-a', institutionId: 'inst-a', status: 'revoked', occurredAt }),
        failureReason: 'wecom_authorization_revoked',
        auditReason: 'wecom_mock_authorization_unavailable',
        label: '已撤销',
      },
      {
        authorization: createWeComAuthorizationRecord({ tenantId: 'tenant-a', institutionId: 'inst-a', status: 'expired', occurredAt }),
        failureReason: 'wecom_authorization_expired',
        auditReason: 'wecom_mock_authorization_unavailable',
        label: '已过期',
      },
      {
        authorization: createWeComAuthorizationRecord({ tenantId: 'tenant-a', institutionId: 'inst-a', status: 'disabled', occurredAt }),
        failureReason: 'wecom_authorization_disabled',
        auditReason: 'wecom_mock_authorization_unavailable',
        label: '已禁用',
      },
      {
        authorization: createWeComAuthorizationRecord({ tenantId: 'tenant-a', institutionId: 'inst-a', status: 'mock_authorized', weComReachOutAuthorized: false, occurredAt }),
        failureReason: 'wecom_reach_out_unauthorized',
        auditReason: 'wecom_mock_authorization_unavailable',
        label: '企业微信触达未授权',
      },
      {
        authorization: createWeComAuthorizationRecord({ tenantId: 'tenant-a', institutionId: 'inst-a', status: 'external_channel_disabled', occurredAt }),
        failureReason: 'wecom_external_channel_disabled',
        auditReason: 'wecom_channel_default_closed',
        label: '外部通道未启用',
      },
      {
        authorization: createWeComAuthorizationRecord({ tenantId: 'tenant-a', institutionId: 'inst-a', status: 'mock_authorized', occurredAt }),
        failureReason: 'wecom_customer_contact_not_synced',
        auditReason: 'wecom_mock_customer_contact_unavailable',
        label: '模拟已授权仍需客户联系 mock 关系',
      },
    ] as const;

    for (const item of cases) {
      const result = createMessageDeliveryFromApprovedDraft({
        draft: draft(),
        actorId: 'operator-1',
        occurredAt,
        options: {
          channelType: 'wechat_work',
          weComAuthorization: item.authorization,
        },
      });

      expect(result.kind === 'created' && result.delivery).toEqual(expect.objectContaining({
        channelType: 'wechat_work',
        deliveryMode: item.failureReason === 'wecom_external_channel_disabled' ? 'external_disabled' : 'mock',
        status: item.failureReason === 'wecom_external_channel_disabled' ? 'external_disabled' : 'skipped',
        failureReason: item.failureReason,
        contactSafetyDecision: expect.objectContaining({
          allowed: false,
          auditReason: item.auditReason,
          safeReasonLabel: expect.any(String),
        }),
      }));
    }
  });

  it('默认未配置企业微信授权阻断 MessageDelivery，保持低敏 external_disabled', () => {
    const result = createMessageDeliveryFromApprovedDraft({
      draft: draft(),
      actorId: 'operator-1',
      occurredAt,
      options: {
        channelType: 'wechat_work',
        weComAuthorization: createDefaultWeComAuthorizationRecord({ tenantId: 'tenant-a', institutionId: 'inst-a', occurredAt }),
      },
    });

    expect(result.kind === 'created' && mapMessageDeliveryToDto(result.delivery)).toEqual(expect.objectContaining({
      channelType: 'wechat_work',
      deliveryMode: 'mock',
      status: 'skipped',
      failureReason: 'wecom_authorization_missing',
      contactSafety: expect.objectContaining({
        allowed: false,
        auditReason: 'wecom_mock_authorization_unavailable',
      }),
    }));
    expect(JSON.stringify(result)).not.toMatch(/corpId|secret|access_token|refresh_token|encodingAESKey|callback|13800000000|110101199001011234|完整聊天|HIS payload/i);
  });

  it('会话内容存档授权状态不影响当前 MessageDelivery 发送链路', () => {
    const withArchive = createMessageDeliveryFromApprovedDraft({
      draft: draft(),
      actorId: 'operator-1',
      occurredAt,
      options: {
        channelType: 'wechat_work',
        weComAuthorization: createWeComAuthorizationRecord({
          tenantId: 'tenant-a',
          institutionId: 'inst-a',
          status: 'mock_authorized',
          sessionArchiveAuthorized: true,
          occurredAt,
        }),
      },
    });
    const withoutArchive = createMessageDeliveryFromApprovedDraft({
      draft: draft(),
      actorId: 'operator-1',
      occurredAt,
      options: {
        channelType: 'wechat_work',
        weComAuthorization: createWeComAuthorizationRecord({
          tenantId: 'tenant-a',
          institutionId: 'inst-a',
          status: 'mock_authorized',
          sessionArchiveAuthorized: false,
          occurredAt,
        }),
      },
    });

    expect(withArchive.kind === 'created' && withoutArchive.kind === 'created' && {
      withArchive: withArchive.delivery.failureReason,
      withoutArchive: withoutArchive.delivery.failureReason,
      withArchiveStatus: withArchive.delivery.status,
      withoutArchiveStatus: withoutArchive.delivery.status,
    }).toEqual({
      withArchive: 'wecom_customer_contact_not_synced',
      withoutArchive: 'wecom_customer_contact_not_synced',
      withArchiveStatus: 'skipped',
      withoutArchiveStatus: 'skipped',
    });
  });

  it('审计 reason 覆盖企业微信 mock 授权读取、不可用、默认关闭和触达未授权', () => {
    const mockAuthorized = createMessageDeliveryFromApprovedDraft({
      draft: draft(),
      actorId: 'operator-1',
      occurredAt,
      options: {
        channelType: 'wechat_work',
        weComAuthorization: createWeComAuthorizationRecord({ tenantId: 'tenant-a', institutionId: 'inst-a', status: 'mock_authorized', occurredAt }),
      },
    });
    const unavailable = createMessageDeliveryFromApprovedDraft({
      draft: draft(),
      actorId: 'operator-1',
      occurredAt,
      options: { channelType: 'wechat_work' },
    });
    const defaultClosed = createMessageDeliveryFromApprovedDraft({
      draft: draft(),
      actorId: 'operator-1',
      occurredAt,
      options: {
        channelType: 'wechat_work',
        weComAuthorization: createWeComAuthorizationRecord({ tenantId: 'tenant-a', institutionId: 'inst-a', status: 'external_channel_disabled', occurredAt }),
      },
    });
    const reachOutUnauthorized = createMessageDeliveryFromApprovedDraft({
      draft: draft(),
      actorId: 'operator-1',
      occurredAt,
      options: {
        channelType: 'wechat_work',
        weComAuthorization: createWeComAuthorizationRecord({ tenantId: 'tenant-a', institutionId: 'inst-a', status: 'mock_authorized', weComReachOutAuthorized: false, occurredAt }),
      },
    });

    expect(mockAuthorized.kind === 'created' && messageDeliveryContactSafetyAuditReason(mockAuthorized.delivery)).toBe('wecom_mock_customer_contact_unavailable');
    expect(unavailable.kind === 'created' && messageDeliveryContactSafetyAuditReason(unavailable.delivery)).toBe('wecom_mock_authorization_unavailable');
    expect(defaultClosed.kind === 'created' && messageDeliveryContactSafetyAuditReason(defaultClosed.delivery)).toBe('wecom_channel_default_closed');
    expect(reachOutUnauthorized.kind === 'created' && messageDeliveryContactSafetyAuditReason(reachOutUnauthorized.delivery)).toBe('wecom_mock_authorization_unavailable');
  });

  it('支持 mock_sent、mock_failed、skipped、external_disabled 状态和低敏 failureReason', () => {
    const mockSent = createMessageDeliveryFromApprovedDraft({ draft: draft(), actorId: 'operator-1', occurredAt });
    const mockFailed = createMessageDeliveryFromApprovedDraft({
      draft: draft(),
      actorId: 'operator-1',
      occurredAt,
      options: { status: 'mock_failed' },
    });
    const skipped = createMessageDeliveryFromApprovedDraft({
      draft: draft(),
      actorId: 'operator-1',
      occurredAt,
      options: { status: 'skipped' },
    });
    const externalDisabled = createMessageDeliveryFromApprovedDraft({
      draft: draft(),
      actorId: 'operator-1',
      occurredAt,
      options: { channelType: 'sms', status: 'mock_sent' },
    });

    expect(mockSent.kind === 'created' && mockSent.delivery.status).toBe('mock_sent');
    expect(mockFailed.kind === 'created' && mockFailed.delivery).toEqual(expect.objectContaining({
      status: 'mock_failed',
      failureReason: 'mock_failure',
      deliveryMode: 'mock',
    }));
    expect(skipped.kind === 'created' && skipped.delivery).toEqual(expect.objectContaining({
      status: 'skipped',
      failureReason: 'consent_missing',
      deliveryMode: 'mock',
    }));
    expect(externalDisabled.kind === 'created' && externalDisabled.delivery).toEqual(expect.objectContaining({
      channelType: 'sms',
      deliveryMode: 'external_disabled',
      status: 'external_disabled',
      failureReason: 'external_channel_disabled',
    }));
  });

  it('企业微信 mock 触达成功、失败、客户联系不可用和 timeline metadata 回写均保持低敏', () => {
    const authorization = createWeComAuthorizationRecord({ tenantId: 'tenant-a', institutionId: 'inst-a', status: 'mock_authorized', occurredAt });
    const success = createMessageDeliveryFromApprovedDraft({
      draft: draft(),
      actorId: 'operator-1',
      occurredAt,
      options: {
        channelType: 'wechat_work',
        weComAuthorization: authorization,
        weComCustomerContacts: [weComContact()],
      },
    });
    const failed = createMessageDeliveryFromApprovedDraft({
      draft: draft(),
      actorId: 'operator-1',
      occurredAt,
      options: {
        channelType: 'wechat_work',
        weComAuthorization: authorization,
        weComCustomerContacts: [weComContact()],
        weComMockOutcome: 'mock_failed',
      },
    });
    const unlinked = createMessageDeliveryFromApprovedDraft({
      draft: draft(),
      actorId: 'operator-1',
      occurredAt,
      options: {
        channelType: 'wechat_work',
        weComAuthorization: authorization,
        weComCustomerContacts: [weComContact({ customerId: 'customer-1', linkedToSystemCustomer: false, availableForFollowUp: false })],
      },
    });
    const unmapped = createMessageDeliveryFromApprovedDraft({
      draft: draft(),
      actorId: 'operator-1',
      occurredAt,
      options: {
        channelType: 'wechat_work',
        weComAuthorization: authorization,
        weComCustomerContacts: [weComContact({ mappedSystemEmployeeRef: null, availableForFollowUp: false })],
      },
    });

    expect(success.kind === 'created' && success.delivery).toEqual(expect.objectContaining({
      channelType: 'wechat_work',
      deliveryMode: 'mock',
      status: 'mock_sent',
      failureReason: null,
      weComMockReachOut: expect.objectContaining({
        status: 'mock_sent',
        auditReason: 'wecom_mock_reachout_sent',
        noRealSend: true,
        noRealOutBound: true,
        noRealWeComApiCall: true,
        noWebhook: true,
        externalChannelEnabled: false,
        allowRealSend: false,
      }),
    }));
    expect(failed.kind === 'created' && failed.delivery).toEqual(expect.objectContaining({
      status: 'mock_failed',
      failureReason: 'mock_failure',
      weComMockReachOut: expect.objectContaining({ auditReason: 'wecom_mock_reachout_failed' }),
    }));
    expect(unlinked.kind === 'created' && unlinked.delivery).toEqual(expect.objectContaining({
      status: 'skipped',
      failureReason: 'wecom_external_contact_unlinked',
      weComMockReachOut: expect.objectContaining({ auditReason: 'wecom_mock_reachout_skipped' }),
    }));
    expect(unmapped.kind === 'created' && unmapped.delivery).toEqual(expect.objectContaining({
      status: 'skipped',
      failureReason: 'wecom_owner_employee_unmapped',
    }));
    expect(success.kind === 'created' && messageDeliveryWeComMockReachOutAuditReason(success.delivery)).toBe('wecom_mock_reachout_sent');

    if (success.kind !== 'created') return;
    const metadata = messageDeliveryToTimelineMetadata(success.delivery);
    const parsed = readMessageDeliveryFromMetadata(metadata);
    expect(metadata).toEqual(expect.objectContaining({
      weComMockReachOutStatus: 'mock_sent',
      weComMockReachOutAuditReason: 'wecom_mock_reachout_sent',
      weComMockReachOutNoRealSend: 'true',
      weComMockReachOutNoRealOutBound: 'true',
      weComMockReachOutNoRealWeComApiCall: 'true',
      weComMockReachOutNoWebhook: 'true',
      weComMockReachOutExternalChannelEnabled: 'false',
      weComMockReachOutAllowRealSend: 'false',
    }));
    expect(parsed?.weComMockReachOut).toEqual(expect.objectContaining({
      status: 'mock_sent',
      auditReason: 'wecom_mock_reachout_sent',
      noRealSend: true,
      noRealWeComApiCall: true,
    }));
    expect(JSON.stringify(mapMessageDeliveryToDto(success.delivery))).not.toMatch(/corpId|external_userid|userid|secret|access_token|refresh_token|encodingAESKey|callback|13800000000|110101199001011234|完整聊天|HIS payload|provider|model|token|cost|vendor|api key/i);
  });

  it('contentSnapshot、recipientRef 和 DTO 使用低敏白名单', () => {
    expect(containsUnsafeMessageDeliveryText('手机号 13812345678')).toBe(true);
    expect(containsUnsafeMessageDeliveryText('身份证 110101199001011234')).toBe(true);
    expect(containsUnsafeMessageDeliveryText('病历 MR-ABC123')).toBe(true);
    expect(containsUnsafeMessageDeliveryText('HIS payload provider model token cost vendor')).toBe(true);

    const result = createMessageDeliveryFromApprovedDraft({
      draft: draft({
        draftContent: '手机号 13812345678 provider model token',
        safePreview: '低敏预览',
      }),
      actorId: 'operator-1',
      occurredAt,
    });

    expect(result.kind === 'created' && result.delivery.contentSnapshot).toBe('低敏人工确认内容快照，未包含联系方式或外部渠道 payload。');
    expect(result.kind === 'created' && result.delivery.recipientRef).toBe('customer:customer-1');

    if (result.kind !== 'created') return;
    const dto = mapMessageDeliveryToDto(result.delivery);
    expect(Object.keys(dto).sort()).toEqual([
      'boundaryLabel',
      'channelType',
      'contentSnapshot',
      'contactSafety',
      'createdAt',
      'customerId',
      'deliveryId',
      'deliveryMode',
      'failureReason',
      'followUpTaskId',
      'messageDraftId',
      'recipientRef',
      'sentAt',
      'status',
      'updatedAt',
      'weComMockReachOut',
    ].sort());
    expect(JSON.stringify(dto)).not.toMatch(
      /tenantId|institutionId|phoneNumber|idNumber|medicalRecordNo|HIS|provider|model|token|cost|vendor|prompt|raw|DATABASE_URL|secret/i,
    );
  });

  it('timeline metadata 可读回 delivery，并保留内部 tenant/institution 用于隔离聚合', () => {
    const current = delivery({ status: 'mock_failed', failureReason: 'mock_failure' });
    const metadata = messageDeliveryToTimelineMetadata(current);
    const parsed = readMessageDeliveryFromMetadata(metadata);

    expect(metadata).toEqual(expect.objectContaining({
      messageDeliveryTenantId: 'tenant-a',
      messageDeliveryInstitutionId: 'inst-a',
      messageDeliveryStatus: 'mock_failed',
      contactSafetyDecisionCode: 'allowed',
      contactSafetyAllowed: 'true',
      contactSafetyAuditReason: 'contact_safety_allowed',
      requiresHumanApproval: 'true',
      forbidAutoSend: 'true',
      externalChannelEnabled: 'false',
    }));
    expect(parsed).toEqual(expect.objectContaining({
      ...current,
      contactSafetyDecision: expect.objectContaining({ code: 'allowed', auditReason: 'contact_safety_allowed' }),
    }));
  });

  it('审计 reason 覆盖创建、模拟成功、失败、跳过和外部禁用', () => {
    expect(messageDeliveryStatusAuditReason('pending')).toBe('message_delivery_created');
    expect(messageDeliveryStatusAuditReason('mock_sent')).toBe('message_delivery_mock_sent');
    expect(messageDeliveryStatusAuditReason('mock_failed')).toBe('message_delivery_mock_failed');
    expect(messageDeliveryStatusAuditReason('skipped')).toBe('message_delivery_skipped');
    expect(messageDeliveryStatusAuditReason('external_disabled')).toBe('message_delivery_external_disabled');
    expect(messageDeliveryContactSafetyAuditReason(delivery())).toBe('contact_safety_allowed');
  });
});
