import { describe, expect, it, vi } from 'vitest';
import {
  mapHisConnectionWriteMetadataToDto,
  parseCreateHisConnectionInput,
  parseUpdateHisConnectionInput,
} from '@/modules/institution/server/his-connection-write-input';

const validCreateInput = {
  connectionName: '星澜 HIS 连接',
  sourceSystem: 'his',
  vendorType: 'demo_vendor',
  systemType: 'his',
};

const writableFields = [
  'connectionName',
  'sourceSystem',
  'vendorType',
  'systemType',
] as const;

const forbiddenFields = [
  'tenantId',
  'id',
  'connectionId',
  'status',
  'credentialRef',
  'credentialConfigured',
  'healthStatus',
  'lastCheckedAt',
  'lastErrorCode',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'revokedAt',
  'deletedAt',
  'token',
  'secret',
  'apiKey',
  'oauthToken',
  'basicAuth',
  'signingKey',
  'privateKey',
  'connectionString',
  'rawPayload',
  'requestBody',
  'responseBody',
  'sql',
  'stack',
  'DATABASE_URL',
] as const;

const forbiddenAliases = [
  'API key',
  'api_key',
  'ApiKey',
  'APIKEY',
  'OAuth token',
  'oauth_token',
  'OAuthToken',
  'basic auth',
  'basic_auth',
  'BasicAuth',
  'private key',
  'private_key',
  'PrivateKey',
  'connection string',
  'connection_string',
  'ConnectionString',
  'raw payload',
  'raw_payload',
  'RawPayload',
] as const;

function expectParseError(result: { ok: true; value: unknown } | { ok: false; error: string }) {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error('expected parse error');
  }

  return result.error;
}

describe('HIS 连接配置写入 payload parser', () => {
  it('create 只接受四个安全元数据字段并 trim 字符串', () => {
    const result = parseCreateHisConnectionInput({
      connectionName: '  星澜 HIS 写入连接  ',
      sourceSystem: '  his  ',
      vendorType: '  demo_vendor  ',
      systemType: '  his  ',
    });

    expect(result).toEqual({
      ok: true,
      value: {
        connectionName: '星澜 HIS 写入连接',
        sourceSystem: 'his',
        vendorType: 'demo_vendor',
        systemType: 'his',
      },
    });
  });

  it('create 缺少任一安全元数据字段时失败', () => {
    for (const field of writableFields) {
      const input: Partial<typeof validCreateInput> = { ...validCreateInput };
      delete input[field];

      expect(parseCreateHisConnectionInput(input)).toEqual({
        ok: false,
        error: `字段 ${field} 必须是非空字符串`,
      });
    }
  });

  it('create 拒绝空字符串、非字符串、超长字符串和嵌套对象', () => {
    expect(parseCreateHisConnectionInput({ ...validCreateInput, connectionName: '   ' })).toEqual({
      ok: false,
      error: '字段 connectionName 必须是非空字符串',
    });
    expect(parseCreateHisConnectionInput({ ...validCreateInput, sourceSystem: 123 })).toEqual({
      ok: false,
      error: '字段 sourceSystem 必须是非空字符串',
    });
    expect(parseCreateHisConnectionInput({ ...validCreateInput, vendorType: { code: 'his' } })).toEqual({
      ok: false,
      error: '字段 vendorType 必须是非空字符串',
    });
    expect(
      parseCreateHisConnectionInput({
        ...validCreateInput,
        connectionName: 'x'.repeat(161),
      }),
    ).toEqual({
      ok: false,
      error: '字段 connectionName 长度不能超过 160',
    });

    for (const field of ['sourceSystem', 'vendorType', 'systemType'] as const) {
      expect(parseCreateHisConnectionInput({ ...validCreateInput, [field]: 'x'.repeat(65) })).toEqual({
        ok: false,
        error: `字段 ${field} 长度不能超过 64`,
      });
    }
  });

  it('create 拒绝未知字段且不忽略', () => {
    expect(parseCreateHisConnectionInput({ ...validCreateInput, extraField: 'ignored?' })).toEqual({
      ok: false,
      error: '请求包含不允许的字段: extraField',
    });
  });

  it('create 拒绝服务端派生字段、状态字段、凭证字段和内部字段', () => {
    for (const field of forbiddenFields) {
      expect(parseCreateHisConnectionInput({ ...validCreateInput, [field]: 'forbidden' })).toEqual({
        ok: false,
        error: '请求包含不允许的字段',
      });
    }
  });

  it('create 拒绝敏感字段别名和大小写变体', () => {
    for (const field of forbiddenAliases) {
      expect(parseCreateHisConnectionInput({ ...validCreateInput, [field]: 'forbidden' })).toEqual({
        ok: false,
        error: '请求包含不允许的字段',
      });
    }
  });

  it('create 只接受普通 JSON object', () => {
    class NotPlainObject {
      connectionName = '星澜';
      sourceSystem = 'his';
      vendorType = 'demo_vendor';
      systemType = 'his';
    }

    const nullPrototypeObject = Object.create(null) as Record<string, unknown>;
    Object.assign(nullPrototypeObject, validCreateInput);

    for (const input of [
      null,
      undefined,
      'text',
      123,
      true,
      [],
      new Date('2026-06-04T00:00:00.000Z'),
      () => validCreateInput,
      new NotPlainObject(),
      nullPrototypeObject,
    ]) {
      expect(parseCreateHisConnectionInput(input)).toEqual({
        ok: false,
        error: '请求体必须是普通 JSON 对象',
      });
    }
  });

  it('create 拒绝敏感内容且错误不回显原始敏感值', () => {
    const result = parseCreateHisConnectionInput({
      ...validCreateInput,
      connectionName: '星澜 sk_test_should_never_echo DATABASE_URL=postgres://tenant:secret@localhost',
    });
    const error = expectParseError(result);

    expect(error).toBe('字段 connectionName 不允许包含敏感信息');
    expect(error).not.toContain('sk_test_should_never_echo');
    expect(error).not.toContain('postgres://tenant:secret@localhost');
  });

  it('禁止字段错误不回显字段原始值', () => {
    const result = parseCreateHisConnectionInput({
      ...validCreateInput,
      token: 'super-secret-token-value',
    });
    const error = expectParseError(result);

    expect(error).toBe('请求包含不允许的字段');
    expect(error).not.toContain('super-secret-token-value');
  });

  it('update 允许四个安全元数据字段的非空子集并 trim 字符串', () => {
    expect(parseUpdateHisConnectionInput({ connectionName: '  新连接名  ' })).toEqual({
      ok: true,
      value: { connectionName: '新连接名' },
    });
    expect(
      parseUpdateHisConnectionInput({
        sourceSystem: '  his  ',
        vendorType: '  demo_vendor  ',
        systemType: '  clinic_his  ',
      }),
    ).toEqual({
      ok: true,
      value: {
        sourceSystem: 'his',
        vendorType: 'demo_vendor',
        systemType: 'clinic_his',
      },
    });
  });

  it('update 拒绝空对象、未知字段、禁止字段和敏感别名', () => {
    expect(parseUpdateHisConnectionInput({})).toEqual({
      ok: false,
      error: '请求至少包含一个可更新字段',
    });
    expect(parseUpdateHisConnectionInput({ extraField: 'ignored?' })).toEqual({
      ok: false,
      error: '请求包含不允许的字段: extraField',
    });
    expect(parseUpdateHisConnectionInput({ credentialRef: 'cred_ref_should_not_be_accepted' })).toEqual({
      ok: false,
      error: '请求包含不允许的字段',
    });
    expect(parseUpdateHisConnectionInput({ 'API key': 'sk_test_should_not_be_accepted' })).toEqual({
      ok: false,
      error: '请求包含不允许的字段',
    });
  });

  it('update 拒绝非字符串、空字符串、超长字符串、嵌套对象和非普通对象', () => {
    expect(parseUpdateHisConnectionInput({ sourceSystem: 123 })).toEqual({
      ok: false,
      error: '字段 sourceSystem 必须是非空字符串',
    });
    expect(parseUpdateHisConnectionInput({ vendorType: '   ' })).toEqual({
      ok: false,
      error: '字段 vendorType 必须是非空字符串',
    });
    expect(parseUpdateHisConnectionInput({ systemType: { code: 'his' } })).toEqual({
      ok: false,
      error: '字段 systemType 必须是非空字符串',
    });
    expect(parseUpdateHisConnectionInput({ systemType: 'x'.repeat(65) })).toEqual({
      ok: false,
      error: '字段 systemType 长度不能超过 64',
    });
    expect(parseUpdateHisConnectionInput([])).toEqual({
      ok: false,
      error: '请求体必须是普通 JSON 对象',
    });
  });

  it('update 拒绝敏感内容且错误不回显原始敏感值', () => {
    const result = parseUpdateHisConnectionInput({
      sourceSystem: 'his token sk_live_should_never_echo stack DATABASE_URL',
    });
    const error = expectParseError(result);

    expect(error).toBe('字段 sourceSystem 不允许包含敏感信息');
    expect(error).not.toContain('sk_live_should_never_echo');
  });

  it('最小 DTO helper 只返回 create / update v1 允许的安全元数据字段', () => {
    const dto = mapHisConnectionWriteMetadataToDto({
      connectionName: '星澜 HIS 连接',
      sourceSystem: 'his',
      vendorType: 'demo_vendor',
      systemType: 'his',
    });

    expect(dto).toEqual(validCreateInput);
    expect(Object.keys(dto).sort()).toEqual([...writableFields].sort());
    expect(JSON.stringify(dto)).not.toMatch(
      /connectionId|tenantId|status|credentialRef|credentialConfigured|healthStatus|lastCheckedAt|lastErrorCode|createdAt|updatedAt|createdBy|updatedBy|revokedAt|deletedAt/i,
    );
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

    expect(parseCreateHisConnectionInput(validCreateInput).ok).toBe(true);
    expect(parseUpdateHisConnectionInput({ connectionName: '新连接名' }).ok).toBe(true);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
