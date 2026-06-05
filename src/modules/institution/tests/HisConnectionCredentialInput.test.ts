import { describe, expect, it, vi } from 'vitest';
import {
  mapHisConnectionCredentialErrorToDto,
  mapHisConnectionCredentialSuccessToDto,
} from '@/modules/institution/server/his-connection-credential-dto';
import {
  parseClearHisConnectionCredentialInput,
  parseCreateHisConnectionCredentialInput,
  parseRevokeHisConnectionCredentialInput,
  parseRotateHisConnectionCredentialInput,
  parseUpdateHisConnectionCredentialInput,
} from '@/modules/institution/server/his-connection-credential-input';

const validCredentialPayload = {
  credentialType: 'api_key',
  syntheticPlaceholder: 'synthetic_placeholder_demo_his_credential',
  idempotencyKey: 'idem_credential_001',
  reasonCode: 'operator_update',
};

function expectParseError(result: { ok: true; value: unknown } | { ok: false; error: string }) {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error('expected parse error');
  }

  return result.error;
}

function expectNoSensitiveCredentialData(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(
    /credentialRef|credential_ref|idempotencyKey|idem_credential_001|synthetic_placeholder_demo_his_credential|sk_live|sk_test|token|secret|apiKey|api_key|connectionString|connection_string|rawCredential|raw_credential|rawPayload|raw_payload|DATABASE_URL|postgres:\/\/|select \* from|SQL|stack/i,
  );
}

describe('HIS 连接配置凭证 parser 最小边界', () => {
  it('create / update / rotate 成功解析合成 placeholder 并 trim 安全字段', () => {
    const expected = {
      credentialType: 'api_key',
      syntheticPlaceholder: 'synthetic_placeholder_demo_his_credential',
      idempotencyKey: 'idem_credential_001',
      reasonCode: 'operator_update',
    };

    expect(
      parseCreateHisConnectionCredentialInput({
        credentialType: ' api_key ',
        syntheticPlaceholder: ' synthetic_placeholder_demo_his_credential ',
        idempotencyKey: ' idem_credential_001 ',
        reasonCode: ' operator_update ',
      }),
    ).toEqual({ ok: true, value: expected });
    expect(parseUpdateHisConnectionCredentialInput(validCredentialPayload)).toEqual({
      ok: true,
      value: expected,
    });
    expect(parseRotateHisConnectionCredentialInput(validCredentialPayload)).toEqual({
      ok: true,
      value: expected,
    });
  });

  it('clear / revoke 成功解析可选 reasonCode，且不接受凭证材料', () => {
    expect(parseClearHisConnectionCredentialInput({ reasonCode: ' operator_clear ' })).toEqual({
      ok: true,
      value: { reasonCode: 'operator_clear' },
    });
    expect(parseRevokeHisConnectionCredentialInput({ reasonCode: ' operator_revoke ' })).toEqual({
      ok: true,
      value: { reasonCode: 'operator_revoke' },
    });
    expect(parseClearHisConnectionCredentialInput({})).toEqual({
      ok: true,
      value: {},
    });
    expect(
      parseRevokeHisConnectionCredentialInput({
        syntheticPlaceholder: 'synthetic_placeholder_should_not_clear',
      }),
    ).toEqual({ ok: false, error: 'validation_failed' });
  });

  it('拒绝非普通对象、未知字段、租户字段、内部字段、状态字段和健康字段', () => {
    class NotPlainObject {
      credentialType = 'api_key';
      syntheticPlaceholder = 'synthetic_placeholder_class_payload';
      idempotencyKey = 'idem_class_payload';
    }
    const nullPrototypeObject = Object.create(null) as Record<string, unknown>;
    Object.assign(nullPrototypeObject, validCredentialPayload);

    for (const input of [
      null,
      '',
      [],
      () => validCredentialPayload,
      new Date('2026-06-06T00:00:00.000Z'),
      new NotPlainObject(),
      nullPrototypeObject,
    ]) {
      expect(parseCreateHisConnectionCredentialInput(input)).toEqual({
        ok: false,
        error: 'validation_failed',
      });
    }

    for (const field of [
      'unknownField',
      'tenantId',
      'credentialRef',
      'credentialConfigured',
      'status',
      'healthStatus',
    ]) {
      expect(
        parseCreateHisConnectionCredentialInput({
          ...validCredentialPayload,
          [field]: 'forbidden',
        }),
      ).toEqual({ ok: false, error: 'validation_failed' });
    }
  });

  it('拒绝 raw HIS payload、external secret path、token、secret、API key 和 connection string', () => {
    const forbiddenPayloads = [
      { rawPayload: { event: 'raw_his_payload' } },
      { rawHisPayload: 'raw payload should not pass' },
      { externalSecretPath: '/secret/tenant/demo/path' },
      { token: 'token_should_not_pass' },
      { secret: 'secret_should_not_pass' },
      { apiKey: 'sk_test_should_not_pass' },
      { connectionString: 'postgres://tenant:secret@localhost:5432/zmtg' },
    ];

    for (const forbidden of forbiddenPayloads) {
      expect(parseCreateHisConnectionCredentialInput({ ...validCredentialPayload, ...forbidden })).toEqual({
        ok: false,
        error: 'validation_failed',
      });
    }

    for (const syntheticPlaceholder of [
      'synthetic_placeholder_token_should_not_pass',
      'synthetic_placeholder_secret_should_not_pass',
      'synthetic_placeholder_raw_credential_should_not_pass',
      'synthetic_placeholder_raw_payload_should_not_pass',
    ]) {
      expect(
        parseCreateHisConnectionCredentialInput({
          ...validCredentialPayload,
          syntheticPlaceholder,
        }),
      ).toEqual({ ok: false, error: 'validation_failed' });
    }
  });

  it('校验 credentialType、syntheticPlaceholder、idempotencyKey 和 reasonCode', () => {
    expect(
      parseCreateHisConnectionCredentialInput({
        ...validCredentialPayload,
        credentialType: 'unsupported',
      }),
    ).toEqual({ ok: false, error: 'validation_failed' });
    expect(
      parseCreateHisConnectionCredentialInput({
        ...validCredentialPayload,
        syntheticPlaceholder: 'real_credential_material',
      }),
    ).toEqual({ ok: false, error: 'validation_failed' });
    expect(
      parseCreateHisConnectionCredentialInput({
        ...validCredentialPayload,
        idempotencyKey: 'bad key with spaces',
      }),
    ).toEqual({ ok: false, error: 'validation_failed' });
    expect(
      parseCreateHisConnectionCredentialInput({
        ...validCredentialPayload,
        reasonCode: 'bad reason with spaces',
      }),
    ).toEqual({ ok: false, error: 'validation_failed' });
  });

  it('create / update / rotate 必须有 placeholder 和 idempotencyKey，且 update 不能用空值表达清空', () => {
    expect(
      parseCreateHisConnectionCredentialInput({
        credentialType: 'api_key',
        syntheticPlaceholder: 'synthetic_placeholder_missing_idem',
      }),
    ).toEqual({ ok: false, error: 'validation_failed' });
    expect(
      parseUpdateHisConnectionCredentialInput({
        credentialType: 'api_key',
        syntheticPlaceholder: ' ',
        idempotencyKey: 'idem_update_empty_placeholder',
      }),
    ).toEqual({ ok: false, error: 'validation_failed' });
    expect(
      parseRotateHisConnectionCredentialInput({
        ...validCredentialPayload,
        credentialRef: 'cred_ref_old_should_not_pass',
      }),
    ).toEqual({ ok: false, error: 'validation_failed' });
  });

  it('错误不回显输入原文、真实凭证形态或 secret path', () => {
    const result = parseCreateHisConnectionCredentialInput({
      ...validCredentialPayload,
      apiKey: 'sk_live_should_never_echo',
      externalSecretPath: '/secret/tenant/demo/his',
    });
    const error = expectParseError(result);

    expect(error).toBe('validation_failed');
    expect(error).not.toContain('sk_live_should_never_echo');
    expect(error).not.toContain('/secret/tenant/demo/his');
  });

  it('parser 不调用外部系统、不读取浏览器存储、不依赖 request 上下文', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    vi.stubGlobal('localStorage', localStorage);

    expect(parseCreateHisConnectionCredentialInput(validCredentialPayload).ok).toBe(true);
    expect(parseClearHisConnectionCredentialInput({ reasonCode: 'operator_clear' }).ok).toBe(true);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});

describe('HIS 连接配置凭证 DTO 最小边界', () => {
  it('成功 DTO 最小化，只返回 ok 和 credentialConfigured', () => {
    expect(mapHisConnectionCredentialSuccessToDto({ credentialConfigured: true })).toEqual({
      ok: true,
      credentialConfigured: true,
    });
    expect(mapHisConnectionCredentialSuccessToDto({ credentialConfigured: false })).toEqual({
      ok: true,
      credentialConfigured: false,
    });
  });

  it('错误 DTO 稳定且不包含 credentialRef、idempotencyKey 或敏感字段', () => {
    const dto = mapHisConnectionCredentialErrorToDto('service_unavailable');

    expect(dto).toEqual({
      ok: false,
      code: 'service_unavailable',
      error: '服务暂不可用',
    });
    expectNoSensitiveCredentialData(dto);
  });
}
);
