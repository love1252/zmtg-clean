import { describe, expect, it } from 'vitest';
import {
  assertLowSensitiveOutput,
  checkLowSensitiveOutput,
} from '@/modules/security/domain/low-sensitive-output-guard';

describe('低敏输出守卫', () => {
  it('识别字段名和值中的高敏信息', () => {
    const result = checkLowSensitiveOutput({
      phone: '13800000000',
      idCard: '110105199001011234',
      medicalRecordNo: 'MR-001',
      birthDate: '1990-01-01',
      fullAddress: '北京市朝阳区完整地址',
      chatRecord: '完整聊天记录',
      secret: 'zmtg_sk_test_secret',
      access_token: 'access_token=abc',
      refreshToken: 'refresh_token=abc',
      apiKey: 'apiKey=abc',
      databaseUrl: 'postgres://user:pass@localhost/db',
      rawPayload: 'raw payload',
      hisPayload: 'HIS payload',
      external_userid: 'wm_real_external_userid',
      userid: 'real_userid',
      corpId: 'ww_real_corp',
    });

    expect(result.safe).toBe(false);
    expect(result.violations.map((violation) => violation.marker)).toEqual(
      expect.arrayContaining([
        'phone',
        'idcard',
        'medicalrecordno',
        'birthdate',
        'fulladdress',
        'chatrecord',
        'secret',
        'accesstoken',
        'refreshtoken',
        'apikey',
        'databaseurl',
        'rawpayload',
        'hispayload',
        'externaluserid',
        'userid',
        'corpid',
      ]),
    );
  });

  it('允许商用关键链路中的低敏状态输出', () => {
    const lowSensitivePayload = {
      customerImport: {
        successCount: 1,
        skippedCount: 0,
        boundary: '只导入低敏摘要，不接真实 HIS / 企业微信 / 短信 / webhook',
      },
      dashboard: {
        safety: '真实渠道默认关闭，当前仍为 mock，不真实发送 / 不真实出网',
      },
      messageDelivery: {
        status: 'external_disabled',
        allowRealSend: false,
        externalChannelEnabled: false,
      },
      audit: {
        reason: 'customer_import_permission_checked',
        result: 'allowed',
      },
    };

    expect(checkLowSensitiveOutput(lowSensitivePayload)).toEqual({ safe: true, violations: [] });
    expect(() => assertLowSensitiveOutput(lowSensitivePayload)).not.toThrow();
  });

  it('阻断 audit metadata 泄露高敏字段', () => {
    expect(() =>
      assertLowSensitiveOutput({
        auditMetadata: {
          rawPayload: { phone: '13800000000' },
        },
      }),
    ).toThrow(/低敏输出检查失败/);
  });

  it('识别常见高敏字段名别名，避免字段名回显绕过', () => {
    const result = checkLowSensitiveOutput({
      phoneNumber: '低敏占位',
      mobilePhone: '低敏占位',
      idNumber: '低敏占位',
      idCardNumber: '低敏占位',
      identityCardNumber: '低敏占位',
      medicalRecordNumber: '低敏占位',
      fullBirthday: '低敏占位',
      detailedAddress: '低敏占位',
      accessToken: '低敏占位',
      refreshToken: '低敏占位',
      api_key: '低敏占位',
      database_url: '低敏占位',
      raw_payload: '低敏占位',
      his_payload: '低敏占位',
      externalUserId: '低敏占位',
      corp_id: '低敏占位',
    });

    expect(result.safe).toBe(false);
    expect(result.violations.map((violation) => violation.marker)).toEqual(
      expect.arrayContaining([
        'phonenumber',
        'mobilephone',
        'idnumber',
        'idcardnumber',
        'identitycardnumber',
        'medicalrecordnumber',
        'fullbirthday',
        'detailedaddress',
        'accesstoken',
        'refreshtoken',
        'apikey',
        'databaseurl',
        'rawpayload',
        'hispayload',
        'externaluserid',
        'corpid',
      ]),
    );
  });
});
