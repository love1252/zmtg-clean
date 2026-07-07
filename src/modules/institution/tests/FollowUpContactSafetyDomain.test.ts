import { describe, expect, it } from 'vitest';
import {
  createAllowedSandboxContactSafetyPolicy,
  defaultContactSafetyPolicy,
  evaluateContactSafetyGuard,
} from '@/modules/institution/domain/followup-contact-safety';

describe('follow-up contact safety guard domain', () => {
  it('默认关闭，safe failure 阻断未授权触达', () => {
    expect(evaluateContactSafetyGuard({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      channelType: 'mock',
      policy: defaultContactSafetyPolicy,
    })).toEqual(expect.objectContaining({
      allowed: false,
      code: 'blocked_consent_missing',
      status: 'skipped',
      failureReason: 'consent_missing',
      auditReason: 'contact_safety_consent_missing',
    }));
  });

  it('consent allowed 且 tenant/institution/channel 灰度通过后仍只允许 mock / manual', () => {
    const policy = createAllowedSandboxContactSafetyPolicy({ tenantId: 'tenant-a', institutionId: 'inst-a' });

    expect(evaluateContactSafetyGuard({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      channelType: 'mock',
      policy,
    })).toEqual(expect.objectContaining({
      allowed: true,
      code: 'allowed',
      status: 'mock_sent',
      deliveryMode: 'mock',
      failureReason: null,
      auditReason: 'contact_safety_allowed',
    }));

    expect(evaluateContactSafetyGuard({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      channelType: 'manual',
      policy,
    })).toEqual(expect.objectContaining({
      allowed: true,
      status: 'mock_sent',
      deliveryMode: 'manual',
    }));
  });

  it('opt-out 和 frequency cap 使用 skipped 低敏阻断', () => {
    const base = createAllowedSandboxContactSafetyPolicy({ tenantId: 'tenant-a', institutionId: 'inst-a' });

    expect(evaluateContactSafetyGuard({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      channelType: 'mock',
      policy: { ...base, optOut: true },
    })).toEqual(expect.objectContaining({
      code: 'blocked_opt_out',
      status: 'skipped',
      failureReason: 'opt_out',
      auditReason: 'contact_safety_opt_out',
    }));

    expect(evaluateContactSafetyGuard({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      channelType: 'mock',
      policy: { ...base, frequencyCap: 'reached' },
    })).toEqual(expect.objectContaining({
      code: 'blocked_frequency_cap',
      status: 'skipped',
      failureReason: 'frequency_cap_reached',
      auditReason: 'contact_safety_frequency_cap_reached',
    }));
  });

  it('channel disabled、tenant 和 institution 未进入灰度时阻断为 external_disabled', () => {
    const base = createAllowedSandboxContactSafetyPolicy({ tenantId: 'tenant-a', institutionId: 'inst-a' });

    expect(evaluateContactSafetyGuard({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      channelType: 'mock',
      policy: { ...base, channelEnabled: false },
    })).toEqual(expect.objectContaining({
      code: 'blocked_channel_disabled',
      status: 'external_disabled',
      failureReason: 'channel_disabled',
      auditReason: 'channel_gray_external_disabled',
    }));

    expect(evaluateContactSafetyGuard({
      tenantId: 'tenant-b',
      institutionId: 'inst-a',
      channelType: 'mock',
      policy: base,
    })).toEqual(expect.objectContaining({
      code: 'blocked_tenant_not_allowlisted',
      status: 'external_disabled',
      failureReason: 'tenant_not_allowlisted',
      auditReason: 'channel_gray_tenant_blocked',
    }));

    expect(evaluateContactSafetyGuard({
      tenantId: 'tenant-a',
      institutionId: 'inst-b',
      channelType: 'mock',
      policy: base,
    })).toEqual(expect.objectContaining({
      code: 'blocked_institution_not_allowlisted',
      status: 'external_disabled',
      failureReason: 'institution_not_allowlisted',
      auditReason: 'channel_gray_institution_blocked',
    }));
  });

  it('wechat_work / sms 即使在 allowlist 中仍 external_disabled，不真实发送', () => {
    const policy = createAllowedSandboxContactSafetyPolicy({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      channelTypes: ['manual', 'mock', 'wechat_work', 'sms'],
    });

    for (const channelType of ['wechat_work', 'sms'] as const) {
      expect(evaluateContactSafetyGuard({
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        channelType,
        policy: { ...policy, externalChannelEnabled: true },
      })).toEqual(expect.objectContaining({
        code: 'blocked_external_channel_disabled',
        status: 'external_disabled',
        deliveryMode: 'external_disabled',
        failureReason: 'external_channel_disabled',
        auditReason: 'channel_gray_external_disabled',
      }));
    }
  });

  it('非 sandbox/mock-only 策略 safe failure 为 external_disabled', () => {
    const policy = createAllowedSandboxContactSafetyPolicy({ tenantId: 'tenant-a', institutionId: 'inst-a' });

    expect(evaluateContactSafetyGuard({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      channelType: 'mock',
      policy: { ...policy, sandboxMockOnly: false },
    })).toEqual(expect.objectContaining({
      allowed: false,
      code: 'blocked_external_channel_disabled',
      status: 'external_disabled',
      deliveryMode: 'external_disabled',
      failureReason: 'external_channel_disabled',
      auditReason: 'channel_gray_external_disabled',
    }));
  });
});
