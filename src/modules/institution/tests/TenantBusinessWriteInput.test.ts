import { describe, expect, it } from 'vitest';
import {
  parseCreateAppointmentPayload,
  parseCreateCustomerPayload,
  parseFollowUpTransitionPayload,
  parseUpdateAppointmentPayload,
  parseUpdateCustomerPayload,
} from '@/modules/institution/server/tenant-business-write-input';

describe('租户业务写入 payload 校验', () => {
  it('接受脱敏客户创建字段并拒绝 tenantId 注入', () => {
    expect(
      parseCreateCustomerPayload({
        displayName: '王女士',
        lifecycle: 'consulting',
        priority: 'high',
        ownerUserId: 'consultant-lin',
        projectInterest: '热玛吉修复组合',
        maskedPhone: '138****1208',
        maskedMedicalRecordNo: 'MR****001',
        lastTouchSummary: '术后第 28 天',
        nextAction: '人工回访',
        tags: ['高价值'],
      }),
    ).toEqual({
      ok: true,
      value: {
        displayName: '王女士',
        lifecycle: 'consulting',
        priority: 'high',
        ownerUserId: 'consultant-lin',
        projectInterest: '热玛吉修复组合',
        maskedPhone: '138****1208',
        maskedMedicalRecordNo: 'MR****001',
        lastTouchSummary: '术后第 28 天',
        nextAction: '人工回访',
        tags: ['高价值'],
      },
    });

    expect(
      parseCreateCustomerPayload({
        tenantId: 'other-tenant',
        displayName: '王女士',
      }),
    ).toEqual({ ok: false, error: '请求包含不允许的字段: tenantId' });
  });

  it('拒绝原始 PII 字段和非脱敏病历字段', () => {
    expect(parseCreateCustomerPayload({ phoneNumber: '13800000000' })).toEqual({
      ok: false,
      error: '请求包含不允许的字段: phoneNumber',
    });
    expect(parseUpdateCustomerPayload({ id: 'cust_001', medicalRecordNo: 'MR-RAW-001' })).toEqual({
      ok: false,
      error: '请求包含不允许的字段: medicalRecordNo',
    });
  });

  it('拒绝伪装成脱敏字段的原始客户标识', () => {
    expect(
      parseCreateCustomerPayload({
        displayName: '王女士',
        lifecycle: 'consulting',
        priority: 'high',
        ownerUserId: 'consultant-lin',
        projectInterest: '热玛吉修复组合',
        maskedPhone: '13800000000',
        maskedMedicalRecordNo: 'MR****001',
        lastTouchSummary: '术后第 28 天',
        nextAction: '人工回访',
        tags: ['高价值'],
      }),
    ).toEqual({
      ok: false,
      error: '字段 maskedPhone 必须是脱敏展示值',
    });

    expect(parseUpdateCustomerPayload({ id: 'cust_001', maskedMedicalRecordNo: 'MR-RAW-001' })).toEqual({
      ok: false,
      error: '字段 maskedMedicalRecordNo 必须是脱敏展示值',
    });
  });

  it('校验客户更新必须包含 id 且至少包含一个可更新字段', () => {
    expect(parseUpdateCustomerPayload({ displayName: '王女士' })).toEqual({
      ok: false,
      error: '字段 id 必须是非空字符串',
    });
    expect(parseUpdateCustomerPayload({ id: 'cust_001' })).toEqual({
      ok: false,
      error: '至少提供一个可更新字段',
    });
  });

  it('拒绝空白客户标签写入', () => {
    expect(
      parseCreateCustomerPayload({
        displayName: '王女士',
        lifecycle: 'consulting',
        priority: 'high',
        ownerUserId: 'consultant-lin',
        projectInterest: '热玛吉修复组合',
        maskedPhone: '138****1208',
        maskedMedicalRecordNo: 'MR****001',
        lastTouchSummary: '术后第 28 天',
        nextAction: '人工回访',
        tags: [' '],
      }),
    ).toEqual({
      ok: false,
      error: '字段 tags 必须是非空字符串数组',
    });

    expect(parseUpdateCustomerPayload({ id: 'cust_001', tags: [' '] })).toEqual({
      ok: false,
      error: '字段 tags 必须是非空字符串数组',
    });
  });

  it('校验预约创建和更新字段', () => {
    expect(
      parseCreateAppointmentPayload({
        customerId: 'cust_001',
        customerDisplayName: '王女士',
        project: '水光补水',
        scheduledAt: '2026-06-01T10:30:00+08:00',
        consultantUserId: 'consultant-xu',
        status: 'pending_confirmation',
        note: '待确认',
      }),
    ).toMatchObject({
      ok: true,
      value: {
        customerId: 'cust_001',
        status: 'pending_confirmation',
      },
    });

    expect(parseCreateAppointmentPayload({ scheduledAt: 'not-a-date' })).toEqual({
      ok: false,
      error: '字段 scheduledAt 必须是有效时间字符串',
    });

    expect(
      parseCreateAppointmentPayload({ scheduledAt: '2026-02-31T10:30:00+08:00' }),
    ).toEqual({
      ok: false,
      error: '字段 scheduledAt 必须是有效时间字符串',
    });

    expect(
      parseUpdateAppointmentPayload({
        id: 'appt_001',
        status: 'arrived',
        note: '已到院',
      }),
    ).toEqual({
      ok: true,
      value: {
        id: 'appt_001',
        status: 'arrived',
        note: '已到院',
      },
    });
  });

  it('校验随访状态流转 payload', () => {
    expect(parseFollowUpTransitionPayload({ id: 'fu_001', nextStatus: 'in_progress' })).toEqual({
      ok: true,
      value: {
        id: 'fu_001',
        nextStatus: 'in_progress',
      },
    });

    expect(parseFollowUpTransitionPayload({ id: 'fu_001', nextStatus: 'unknown' })).toEqual({
      ok: false,
      error: '字段 nextStatus 值不在允许范围内',
    });
  });

  it('拒绝非白名单字段和非 JSON object 请求体', () => {
    expect(
      parseUpdateAppointmentPayload({ id: 'appt_001', status: 'arrived', note: '已到院', x: 1 }),
    ).toEqual({
      ok: false,
      error: '请求包含不允许的字段: x',
    });
    expect(parseFollowUpTransitionPayload(null)).toEqual({
      ok: false,
      error: '请求体必须是 JSON object',
    });
  });
});
