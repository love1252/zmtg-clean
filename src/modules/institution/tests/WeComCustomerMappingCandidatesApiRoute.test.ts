import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/institution/wecom/customer-mapping-candidates/route';
import type { AccessContext } from '@/modules/security/domain/access-control';
import {
  createWeComCustomerMappingCandidatesFailClosedRawView,
  parseWeComCustomerMappingCandidatesReadonlyResponse,
  parseWeComCustomerMappingCandidatesResponse,
  weComCustomerMappingCandidatesResponseKeys,
} from '@/modules/institution/view-models/wecom-customer-mapping-candidates';
import { readWeComCustomerMappingCandidatesResponse } from '@/modules/institution/view-models/wecom-customer-mapping-candidates-reader';

const routeMocks = vi.hoisted(() => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/modules/security/server/access-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/security/server/access-context')>();
  return {
    ...actual,
    getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
  };
});

const context: AccessContext = {
  userId: 'admin-mock',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'tenant-mock-001',
  institutionId: 'institution-mock-001',
  source: 'demo_session',
};

function request() {
  return new Request('http://localhost/api/institution/wecom/customer-mapping-candidates');
}

function validPayload() {
  return {
    sourceKind: 'controlled_mock_fixture',
    dataMode: 'mock',
    mockDemo: true,
    readonly: true,
    authorizationStatus: 'authorized',
    providerStatus: 'mock_only',
    candidates: [{
      externalContactSummary: {
        displayName: '[MOCK] 客户甲',
        ownerSummary: '[MOCK] 顾问甲',
        tagNames: ['[MOCK] 重点客户'],
        sourceType: 'other_mock',
        addedAtDate: '2026-07-10',
        remarkSummary: '[MOCK] 已确认摘要',
      },
      systemCustomerSummary: {
        mockCustomerNumber: 'MOCK-001',
        displayNameSummary: '[MOCK] 客户甲',
        ownerSummary: '[MOCK] 顾问甲',
        tagNames: ['[MOCK] 重点客户'],
        statusSummary: 'active',
      },
      mappingStatus: 'candidate',
      confidenceLevel: 'high',
      conflictSummary: { status: 'none', unresolvedCount: 0 },
      manualReviewStatus: 'not_required',
    }],
    mappingStatus: 'candidate',
    confidenceLevel: 'high',
    conflictSummary: { status: 'none', unresolvedCount: 0 },
    manualReviewStatus: 'not_required',
    auditSummary: {
      status: 'recorded',
      eventType: 'mapping_candidate_generated',
      reasonCode: 'candidate_evidence_available',
    },
    failClosedReason: null,
    autoMergePerformed: false,
    realCustomerRelationshipWritten: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(context);
});

describe('WeCom customer mapping candidates readonly API', () => {
  it('GET 返回 mock/demo 低敏候选、exact keys 和只读写入声明', async () => {
    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(payload)).toEqual(weComCustomerMappingCandidatesResponseKeys);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(payload).toMatchObject({
      sourceKind: 'controlled_mock_fixture',
      dataMode: 'mock',
      mockDemo: true,
      readonly: true,
      authorizationStatus: 'authorized',
      providerStatus: 'mock_only',
      mappingStatus: 'candidate',
      confidenceLevel: 'high',
      failClosedReason: null,
      autoMergePerformed: false,
      realCustomerRelationshipWritten: false,
    });
    expect(payload.candidates).toHaveLength(1);
    expect(Object.keys(payload.candidates[0])).toEqual([
      'externalContactSummary',
      'systemCustomerSummary',
      'mappingStatus',
      'confidenceLevel',
      'conflictSummary',
      'manualReviewStatus',
    ]);
    expect(payload.candidates[0].externalContactSummary.displayName).toBe('[MOCK] 客户甲');
    expect(payload.candidates[0].systemCustomerSummary.mockCustomerNumber).toBe('MOCK-001');
  });

  it('未登录 401，无机构权限 403，且不会进入候选读取', async () => {
    routeMocks.getDemoAccessContextFromRequest
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({
        ...context,
        role: 'platform_admin',
        scope: 'platform',
        tenantId: null,
        institutionId: null,
      });

    expect((await GET(request())).status).toBe(401);
    expect((await GET(request())).status).toBe(403);
  });

  it.each([
    ['tenant-mock-002', 'provider_disabled', 'disabled'],
    ['tenant-mock-003', 'external_provider_disabled', 'external_disabled'],
    ['tenant-demo-001', 'authorization_revoked', 'mock_only'],
  ] as const)('%s provider/authorization 不可用时 fail-closed', async (tenantId, reason, providerStatus) => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue({ ...context, tenantId });

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.candidates).toEqual([]);
    expect(payload.failClosedReason).toBe(reason);
    expect(payload.providerStatus).toBe(providerStatus);
    expect(payload.auditSummary.status).toBe('blocked');
    expect(payload.autoMergePerformed).toBe(false);
    expect(payload.realCustomerRelationshipWritten).toBe(false);
  });

  it('现有机构演示会话映射到受控 mock fixture，不泄漏 fixture tenant', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue({
      ...context,
      tenantId: 'growth-tenant-chengxing',
      institutionId: 'growth-inst-chengxing',
    });

    const payload = await (await GET(request())).json();

    expect(payload.candidates).toHaveLength(1);
    expect(payload.failClosedReason).toBeNull();
    expect(JSON.stringify(payload)).not.toContain('tenant-mock-001');
    expect(JSON.stringify(payload)).not.toContain('growth-tenant-chengxing');
  });

  it('tenant mismatch/未知租户不显示候选并 fail-closed', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue({
      ...context,
      tenantId: 'tenant-other-001',
    });

    const payload = await (await GET(request())).json();

    expect(payload.candidates).toEqual([]);
    expect(payload.failClosedReason).toBe('tenant_fixture_unavailable');
  });

  it('strict parser 对 unknown field 与 tenant mismatch fail-closed', () => {
    const raw = createWeComCustomerMappingCandidatesFailClosedRawView({
      tenantId: 'tenant-mock-001',
      reason: 'provider_disabled',
    });

    expect(parseWeComCustomerMappingCandidatesResponse(raw, 'tenant-other-001')).toBeNull();
    expect(parseWeComCustomerMappingCandidatesResponse(
      { ...raw, unknownField: 'blocked' },
      'tenant-mock-001',
    )).toBeNull();
    expect(parseWeComCustomerMappingCandidatesResponse(raw, 'tenant-mock-001')).not.toBeNull();
  });

  it('共享 strict parser 拒绝 root 与 nested unknown key', () => {
    const rootUnknown = { ...validPayload(), attackerControlled: '普通文本' };
    const nestedUnknown = validPayload();
    Object.assign(nestedUnknown.candidates[0].externalContactSummary, { rawNote: '普通文本' });

    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(rootUnknown)).toBeNull();
    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(nestedUnknown)).toBeNull();
  });

  it('12 层会扫描末端，但 13 层嵌套由递归深度保护直接 fail-closed', () => {
    function nestedPlainObjects(levels: number) {
      const terminal: Record<string, unknown> = {};
      let value: Record<string, unknown> = terminal;
      for (let level = 1; level < levels; level += 1) value = { nested: value };
      return { terminal, value };
    }

    const descriptorSpy = vi.spyOn(Object, 'getOwnPropertyDescriptors');
    const twelveLevels = nestedPlainObjects(12);
    const twelveLevelPayload: Record<string, unknown> = validPayload();
    twelveLevelPayload.candidates = twelveLevels.value;

    expect(
      parseWeComCustomerMappingCandidatesReadonlyResponse(twelveLevelPayload),
      '12 层输入虽然不符合 candidates 结构，但不应因递归深度超限而提前失败',
    ).toBeNull();
    expect(
      descriptorSpy.mock.calls.some(([value]) => value === twelveLevels.terminal),
      '12 层输入必须扫描到末端，以证明尚未触发递归深度保护',
    ).toBe(true);

    descriptorSpy.mockClear();
    const thirteenLevels = nestedPlainObjects(13);
    const thirteenLevelPayload: Record<string, unknown> = validPayload();
    thirteenLevelPayload.candidates = thirteenLevels.value;

    expect(
      parseWeComCustomerMappingCandidatesReadonlyResponse(thirteenLevelPayload),
      '13 层嵌套必须固定 fail-closed',
    ).toBeNull();
    expect(
      descriptorSpy.mock.calls.some(([value]) => value === thirteenLevels.terminal),
      '13 层嵌套末端不得被扫描；否则测试没有触达递归深度保护',
    ).toBe(false);
  });

  it('13 层嵌套经 parser 与 reader fail-closed，不执行副作用或回显原始内容', async () => {
    const sentinel = 'DEPTH_13_RAW_NESTED_CONTENT';
    let getterCount = 0;
    let setterCount = 0;
    let proxyTrapCount = 0;
    let toJsonCount = 0;
    const proxy = new Proxy({}, {
      getPrototypeOf() {
        proxyTrapCount += 1;
        return Object.prototype;
      },
      ownKeys() {
        proxyTrapCount += 1;
        return [];
      },
      getOwnPropertyDescriptor() {
        proxyTrapCount += 1;
        return undefined;
      },
      get() {
        proxyTrapCount += 1;
        return undefined;
      },
      set() {
        proxyTrapCount += 1;
        return false;
      },
    });
    const terminal: Record<string, unknown> = {
      sentinel,
      proxy,
      toJSON() {
        toJsonCount += 1;
        return { sentinel };
      },
    };
    Object.defineProperty(terminal, 'accessor', {
      enumerable: true,
      get() {
        getterCount += 1;
        return sentinel;
      },
      set() {
        setterCount += 1;
      },
    });
    let nested: Record<string, unknown> = terminal;
    for (let level = 1; level < 13; level += 1) nested = { nested };
    const payload: Record<string, unknown> = validPayload();
    payload.candidates = nested;

    let parsed: ReturnType<typeof parseWeComCustomerMappingCandidatesReadonlyResponse>;
    expect(() => {
      parsed = parseWeComCustomerMappingCandidatesReadonlyResponse(payload);
    }, '13 层嵌套 parser 不得抛出未捕获异常').not.toThrow();
    expect(parsed!, '13 层嵌套 parser 必须 fail-closed').toBeNull();

    const response = new Response(null, { status: 200 });
    vi.spyOn(response, 'json').mockResolvedValue(payload);
    const result = await readWeComCustomerMappingCandidatesResponse(response);

    expect(result, '13 层嵌套 reader 必须返回固定低敏错误').toEqual({
      ok: false,
      reason: 'response_contract_invalid',
    });
    expect(result.ok ? result.data.candidates : [], '13 层嵌套 reader 不得保留 candidates').toEqual([]);
    expect(JSON.stringify(result), '13 层嵌套 reader 不得回显原始内容').not.toContain(sentinel);
    expect({ getterCount, setterCount, proxyTrapCount, toJsonCount },
      '13 层嵌套不得执行 getter、setter、Proxy trap 或 toJSON').toEqual({
      getterCount: 0,
      setterCount: 0,
      proxyTrapCount: 0,
      toJsonCount: 0,
    });
  });

  it.each([
    ['手机号', '候选摘要 13812345678'],
    ['身份证号', '证件 110101199003071234'],
    ['external_userid', 'external_userid=wo_123'],
    ['externalUserId', 'externalUserId: wo_123'],
    ['userid', 'userid=zhangsan'],
    ['userId', 'userId: zhangsan'],
    ['access_token', 'access_token=top-secret'],
    ['secret', 'secret: top-secret'],
    ['credential', 'credential=private'],
    ['Authorization', 'Authorization: Bearer private'],
    ['rawResponse', 'rawResponse={private}'],
    ['apiResponse', 'apiResponse={private}'],
    ['webhookPayload', 'webhookPayload={private}'],
    ['原始 payload', '原始 payload：private'],
    ['聊天正文', '聊天正文：private'],
    ['消息正文', '消息正文：private'],
    ['conversation', 'conversationContent: private'],
    ['archive', 'sessionArchive: private'],
    ['原始异常', '原始异常：provider failed'],
    ['stack', 'stackTrace: private'],
    ['provider 响应', 'providerResponse: private'],
  ])('共享 strict parser 递归阻断%s字符串值', (_label, unsafeText) => {
    const payload = validPayload();
    payload.candidates[0].externalContactSummary.remarkSummary = unsafeText;

    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).toBeNull();
  });

  it.each([
    'token',
    'TOKEN',
    'api-token',
    'token: abc',
    'payload',
    'raw-payload',
    'payload={...}',
    'conversation',
    'conversation-content',
    'archive',
    'archive_content',
  ])('通用独立敏感 token %s 在 nested string 中使 parser 与 reader fail-closed', async (unsafeText) => {
    const payload = validPayload();
    payload.candidates[0].systemCustomerSummary.displayNameSummary = unsafeText;

    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).toBeNull();
    await expect(readWeComCustomerMappingCandidatesResponse(
      new Response(JSON.stringify(payload), { status: 200 }),
    )).resolves.toEqual({ ok: false, reason: 'response_contract_invalid' });
  });

  it('敏感 token 使用明确边界，不误杀 tokenization 与普通中文备注', async () => {
    const payload = validPayload();
    payload.candidates[0].externalContactSummary.remarkSummary = 'tokenization 模型的普通中文展示摘要';

    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).not.toBeNull();
    await expect(readWeComCustomerMappingCandidatesResponse(
      new Response(JSON.stringify(payload), { status: 200 }),
    )).resolves.toMatchObject({ ok: true });
  });

  it.each([
    '138-0013-8000',
    '138 0013 8000',
    '+86-138-0013-8000',
    '0086 138 0013 8000',
    '１38-００13-８000',
    '+８６-1３8-０013-8００0',
    '００86 １３8 001３ ８００0',
  ])('带分隔符手机号 %s fail-closed', async (phone) => {
    const payload = validPayload();
    payload.candidates[0].externalContactSummary.remarkSummary = `联系方式 ${phone}`;

    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).toBeNull();
    await expect(readWeComCustomerMappingCandidatesResponse(
      new Response(JSON.stringify(payload), { status: 200 }),
    )).resolves.toEqual({ ok: false, reason: 'response_contract_invalid' });
  });

  it('实际 Unicode Lm 代表字符插入各类手机号和身份证后全部 fail-closed', async () => {
    const lmOracle = /\p{Lm}/u;
    const representatives = [
      ['U+02C6 MODIFIER LETTER CIRCUMFLEX ACCENT', 'ˆ'],
      ['U+02B0 MODIFIER LETTER SMALL H', 'ʰ'],
      ['U+02EC MODIFIER LETTER VOICING', 'ˬ'],
      ['U+02E0 MODIFIER LETTER SMALL GAMMA', 'ˠ'],
      ['U+A69C MODIFIER LETTER CYRILLIC HARD SIGN', 'ꚜ'],
      ['U+A69D MODIFIER LETTER CYRILLIC SOFT SIGN', 'ꚝ'],
    ] as const;

    for (const [label, modifier] of representatives) {
      expect(lmOracle.test(modifier), `${label} must be classified as Lm by the test oracle`).toBe(true);
      for (const unsafeText of [
        `138${modifier}0013${modifier}8000`,
        `+86${modifier}138${modifier}0013${modifier}8000`,
        `0086${modifier}138${modifier}0013${modifier}8000`,
        `110105${modifier}19491231${modifier}0029`,
        `110105${modifier}19491231${modifier}002X`,
        `110105${modifier}19491231${modifier}002x`,
      ]) {
        const payload = validPayload();
        payload.candidates[0].externalContactSummary.remarkSummary = unsafeText;

        expect(
          parseWeComCustomerMappingCandidatesReadonlyResponse(payload),
          `${label} must not split a sensitive numeric span`,
        ).toBeNull();
        const readerResult = await readWeComCustomerMappingCandidatesResponse(
          new Response(JSON.stringify(payload), { status: 200 }),
        );
        expect(readerResult.ok).toBe(false);
        if (readerResult.ok) throw new Error(`${label} unexpectedly passed reader validation`);
        expect(readerResult).toEqual({ ok: false, reason: 'response_contract_invalid' });
        expect('data' in readerResult).toBe(false);
        const failClosedView = createWeComCustomerMappingCandidatesFailClosedRawView({
          tenantId: 'tenant-mock-001',
          reason: readerResult.reason,
        });
        expect(failClosedView.candidates).toEqual([]);
        expect(JSON.stringify(failClosedView)).not.toContain(unsafeText);
      }
    }
  });

  it('U+02F3 由独立 oracle 确认为 Sk，仍不能绕过数字敏感信息检测', () => {
    const character = '˳';
    expect(/\p{Lm}/u.test(character)).toBe(false);
    expect(/\p{Sk}/u.test(character)).toBe(true);

    for (const unsafeText of [
      `138${character}0013${character}8000`,
      `110105${character}19491231${character}002X`,
    ]) {
      const payload = validPayload();
      payload.candidates[0].externalContactSummary.remarkSummary = unsafeText;
      expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).toBeNull();
    }
  });

  it('BMP 全部 Lm code point 插入手机号和身份证后绝不 accepted', () => {
    const lmOracle = /\p{Lm}/u;
    const payload = validPayload();
    let checked = 0;

    for (let codePoint = 0; codePoint <= 0xFFFF; codePoint += 1) {
      const character = String.fromCodePoint(codePoint);
      if (!lmOracle.test(character)) continue;
      const label = `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;

      for (const unsafeText of [
        `138${character}0013${character}8000`,
        `110105${character}19491231${character}002X`,
      ]) {
        payload.candidates[0].externalContactSummary.remarkSummary = unsafeText;
        expect(
          parseWeComCustomerMappingCandidatesReadonlyResponse(payload),
          `${label} must not be accepted inside a sensitive numeric span`,
        ).toBeNull();
      }
      checked += 1;
    }

    expect(checked).toBeGreaterThan(200);
  });

  it('supplementary-plane Lm 代表字符插入手机号和身份证后 fail-closed', async () => {
    const modifier = '\u{10780}';
    expect(/\p{Lm}/u.test(modifier)).toBe(true);

    for (const unsafeText of [
      `138${modifier}0013${modifier}8000`,
      `110105${modifier}19491231${modifier}002X`,
    ]) {
      const payload = validPayload();
      payload.candidates[0].externalContactSummary.remarkSummary = unsafeText;
      expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).toBeNull();
      await expect(readWeComCustomerMappingCandidatesResponse(
        new Response(JSON.stringify(payload), { status: 200 }),
      )).resolves.toEqual({ ok: false, reason: 'response_contract_invalid' });
    }
  });

  it('Unicode Nl 采用固定 fail-closed 策略，不能无意成为数字边界', () => {
    const letterNumber = 'Ⅰ';
    expect(/\p{Nl}/u.test(letterNumber)).toBe(true);

    for (const unsafeText of [
      `138${letterNumber}0013${letterNumber}8000`,
      `110105${letterNumber}19491231${letterNumber}002X`,
    ]) {
      const payload = validPayload();
      payload.candidates[0].externalContactSummary.remarkSummary = unsafeText;
      expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).toBeNull();
    }
  });

  it.each([
    '110105-19491231-002X',
    '110105 19491231 002X',
    '110105-19491231-002x',
    '１１０１０５－１９４９１２３１　００２Ｘ',
    '１10１05-１９49１2３1-０02X',
  ])('带分隔符身份证号 %s fail-closed', async (idCard) => {
    const payload = validPayload();
    payload.candidates[0].externalContactSummary.remarkSummary = `证件 ${idCard}`;

    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).toBeNull();
    await expect(readWeComCustomerMappingCandidatesResponse(
      new Response(JSON.stringify(payload), { status: 200 }),
    )).resolves.toEqual({ ok: false, reason: 'response_contract_invalid' });
  });

  it('audit 展示字段中的通用敏感 token 整体 fail-closed', async () => {
    const payload = validPayload();
    payload.auditSummary.eventType = 'token';

    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).toBeNull();
    await expect(readWeComCustomerMappingCandidatesResponse(
      new Response(JSON.stringify(payload), { status: 200 }),
    )).resolves.toEqual({ ok: false, reason: 'response_contract_invalid' });
  });

  it.each([
    ['候选备注', (payload: ReturnType<typeof validPayload>, value: string) => {
      payload.candidates[0].externalContactSummary.remarkSummary = value;
    }],
    ['客户摘要', (payload: ReturnType<typeof validPayload>, value: string) => {
      payload.candidates[0].systemCustomerSummary.displayNameSummary = value;
    }],
    ['冲突摘要', (payload: ReturnType<typeof validPayload>, value: string) => {
      payload.candidates[0].conflictSummary.status = value;
    }],
    ['audit 展示字段', (payload: ReturnType<typeof validPayload>, value: string) => {
      payload.auditSummary.eventType = value;
    }],
  ])('%s 注入通用敏感 token 后 parser 与 reader 均 fail-closed', async (_field, inject) => {
    const payload = validPayload();
    inject(payload, 'payload: ATTACK_VALUE_4c71');

    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).toBeNull();
    await expect(readWeComCustomerMappingCandidatesResponse(
      new Response(JSON.stringify(payload), { status: 200 }),
    )).resolves.toEqual({ ok: false, reason: 'response_contract_invalid' });
  });

  it('数字扫描不把互不相关的短数字片段误拼接', async () => {
    const payload = validPayload();
    payload.candidates[0].externalContactSummary.remarkSummary = '普通摘要 138 项、0013 类、8000 条';

    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).not.toBeNull();
    await expect(readWeComCustomerMappingCandidatesResponse(
      new Response(JSON.stringify(payload), { status: 200 }),
    )).resolves.toMatchObject({ ok: true });
  });

  it.each([
    '编号 110105，日期 19491231，序号 002X',
    '订单 138，批次 0013，数量 8000',
    '区域 110105；时间 19491231；代码 002X',
    '编号 110105 reference 19491231 code 002X',
  ])('由普通文字明确分隔的独立数字 span 保持 accepted：%s', async (safeText) => {
    const payload = validPayload();
    payload.candidates[0].externalContactSummary.remarkSummary = safeText;

    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).not.toBeNull();
    await expect(readWeComCustomerMappingCandidatesResponse(
      new Response(JSON.stringify(payload), { status: 200 }),
    )).resolves.toMatchObject({ ok: true });
  });

  it('正常分段文本中的数字经过真实 parser 与 reader 后 accepted', async () => {
    const payload = validPayload();
    payload.candidates[0].externalContactSummary.remarkSummary =
      '编号 110105，日期 19491231，序号 002X';

    const parsed = parseWeComCustomerMappingCandidatesReadonlyResponse(payload);
    expect(parsed).not.toBeNull();
    expect(parsed?.candidates[0].externalContactSummary.remarkSummary).toBe(
      '编号 110105，日期 19491231，序号 002X',
    );
    await expect(readWeComCustomerMappingCandidatesResponse(
      new Response(JSON.stringify(payload), { status: 200 }),
    )).resolves.toMatchObject({
      ok: true,
      data: {
        candidates: [{
          externalContactSummary: {
            remarkSummary: '编号 110105，日期 19491231，序号 002X',
          },
        }],
      },
    });
  });

  it('数字位于不同 nested 字段时不跨字段共享候选状态', async () => {
    const payload = validPayload();
    payload.candidates[0].externalContactSummary.displayName = '编号 110105';
    payload.candidates[0].externalContactSummary.ownerSummary = '日期 19491231';
    payload.candidates[0].externalContactSummary.remarkSummary = '序号 002X';

    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).not.toBeNull();
    await expect(readWeComCustomerMappingCandidatesResponse(
      new Response(JSON.stringify(payload), { status: 200 }),
    )).resolves.toMatchObject({ ok: true });
  });

  it('Lu/Ll/Lt/Lo 均终止并完整重置当前数字候选', async () => {
    const boundaries = [
      ['Lu U+0041', 'A', /\p{Lu}/u],
      ['Ll U+0062', 'b', /\p{Ll}/u],
      ['Lt U+01C5', 'ǅ', /\p{Lt}/u],
      ['Lo U+6C49', '汉', /\p{Lo}/u],
    ] as const;

    for (const [label, boundary, oracle] of boundaries) {
      expect(oracle.test(boundary), `${label} must match its independent category oracle`).toBe(true);
      const payload = validPayload();
      payload.candidates[0].externalContactSummary.remarkSummary =
        `编号 110105${boundary}日期 19491231${boundary}序号 002X`;

      expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).not.toBeNull();
      await expect(readWeComCustomerMappingCandidatesResponse(
        new Response(JSON.stringify(payload), { status: 200 }),
      )).resolves.toMatchObject({ ok: true });
    }
  });

  it('数字扫描不跨越字母或汉字拼接，也不接受候选中段 X', async () => {
    for (const safeText of [
      '普通摘要 138A0013A8000',
      '普通摘要 138项0013类8000条',
    ]) {
      const payload = validPayload();
      payload.candidates[0].externalContactSummary.remarkSummary = safeText;
      expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).not.toBeNull();
    }

    const payload = validPayload();
    payload.candidates[0].externalContactSummary.remarkSummary = '证件 110105X19491231002';
    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).toBeNull();
    await expect(readWeComCustomerMappingCandidatesResponse(
      new Response(JSON.stringify(payload), { status: 200 }),
    )).resolves.toEqual({ ok: false, reason: 'response_contract_invalid' });
  });

  it('数字扫描资源上限超限时固定 fail-closed', () => {
    const overlongString = validPayload();
    overlongString.candidates[0].externalContactSummary.remarkSummary = '摘要' + 'a'.repeat(513);
    const overlongSpan = validPayload();
    overlongSpan.candidates[0].externalContactSummary.remarkSummary = `138${'‐'.repeat(65)}00138000`;
    const tooManyCandidates = validPayload();
    tooManyCandidates.candidates[0].externalContactSummary.remarkSummary =
      Array.from({ length: 33 }, (_, index) => `${index % 10}项`).join('');

    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(overlongString)).toBeNull();
    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(overlongSpan)).toBeNull();
    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(tooManyCandidates)).toBeNull();
  });

  it.each([
    ['U+200C', '‌'],
    ['U+200D', '‍'],
    ['U+2060', '⁠'],
    ['U+FEFF', '﻿'],
  ])('%s Unicode Cf 插入手机号和身份证后 parser 与 reader 均 fail-closed', async (_label, separator) => {
    for (const unsafeText of [
      `138${separator}0013${separator}8000`,
      `110105${separator}19491231${separator}002X`,
    ]) {
      const payload = validPayload();
      payload.candidates[0].externalContactSummary.remarkSummary = unsafeText;

      expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).toBeNull();
      await expect(readWeComCustomerMappingCandidatesResponse(
        new Response(JSON.stringify(payload), { status: 200 }),
      )).resolves.toEqual({ ok: false, reason: 'response_contract_invalid' });
    }
  });

  it.each([
    ['U+2010', '‐'],
    ['U+2011', '‑'],
    ['U+2012', '‒'],
    ['U+2013', '–'],
    ['U+2014', '—'],
    ['U+2015', '―'],
    ['U+2212', '−'],
    ['U+FF0D', '－'],
  ])('%s Unicode dash 插入手机号和身份证后仍被识别并阻断', async (_label, separator) => {
    for (const unsafeText of [
      `138${separator}0013${separator}8000`,
      `110105${separator}19491231${separator}002X`,
    ]) {
      const payload = validPayload();
      payload.candidates[0].externalContactSummary.remarkSummary = unsafeText;

      expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).toBeNull();
      await expect(readWeComCustomerMappingCandidatesResponse(
        new Response(JSON.stringify(payload), { status: 200 }),
      )).resolves.toEqual({ ok: false, reason: 'response_contract_invalid' });
    }
  });

  it.each([
    ['U+00A0', ' '],
    ['U+2007', ' '],
    ['U+202F', ' '],
    ['U+3000', '　'],
  ])('%s Unicode 空格插入手机号和身份证后仍被识别并阻断', async (_label, separator) => {
    for (const unsafeText of [
      `+86${separator}138${separator}0013${separator}8000`,
      `110105${separator}19491231${separator}002x`,
    ]) {
      const payload = validPayload();
      payload.candidates[0].externalContactSummary.remarkSummary = unsafeText;

      expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).toBeNull();
      await expect(readWeComCustomerMappingCandidatesResponse(
        new Response(JSON.stringify(payload), { status: 200 }),
      )).resolves.toEqual({ ok: false, reason: 'response_contract_invalid' });
    }
  });

  it.each([
    ['U+1680 OGHAM SPACE MARK', ' '],
    ['U+058A ARMENIAN HYPHEN', '֊'],
    ['U+05BE HEBREW PUNCTUATION MAQAF', '־'],
    ['U+2E17 DOUBLE OBLIQUE HYPHEN', '⸗'],
    ['U+034F COMBINING GRAPHEME JOINER', '͏'],
    ['U+FE0F VARIATION SELECTOR-16', '️'],
  ])('%s 插入手机号和身份证后 shared parser 与 reader 均 fail-closed', async (_label, separator) => {
    for (const unsafeText of [
      `138${separator}0013${separator}8000`,
      `110105${separator}19491231${separator}002X`,
    ]) {
      const payload = validPayload();
      payload.candidates[0].externalContactSummary.remarkSummary = unsafeText;

      expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).toBeNull();
      const result = await readWeComCustomerMappingCandidatesResponse(
        new Response(JSON.stringify(payload), { status: 200 }),
      );
      expect(result).toEqual({ ok: false, reason: 'response_contract_invalid' });
      expect(JSON.stringify(result)).not.toContain(unsafeText);
      expect(JSON.stringify(result)).not.toContain(separator);
      expect(createWeComCustomerMappingCandidatesFailClosedRawView({
        tenantId: 'tenant-mock-001',
        reason: 'response_contract_invalid',
      }).candidates).toEqual([]);
    }
  });

  it.each([
    ['Zs U+2000 EN QUAD', ' '],
    ['Zs U+205F MEDIUM MATHEMATICAL SPACE', ' '],
    ['Pd U+2011 NON-BREAKING HYPHEN', '‑'],
    ['Po U+2024 ONE DOT LEADER', '․'],
    ['Pc U+203F UNDERTIE', '‿'],
    ['Mn U+0301 COMBINING ACUTE ACCENT', '́'],
    ['Me U+20DD COMBINING ENCLOSING CIRCLE', '⃝'],
    ['Cf U+200E LEFT-TO-RIGHT MARK', '‎'],
    ['Cc U+0009 CHARACTER TABULATION', '	'],
    ['Sk U+02C2 MODIFIER LETTER LEFT ARROWHEAD', '˂'],
    ['Sm U+221E INFINITY', '∞'],
    ['So U+260E BLACK TELEPHONE', '☎'],
  ])('%s 位于连续数字候选内部时不能绕过手机号或身份证检测', async (_label, separator) => {
    for (const unsafeText of [
      `138${separator}0013${separator}8000`,
      `110105${separator}19491231${separator}002x`,
    ]) {
      const payload = validPayload();
      payload.candidates[0].externalContactSummary.remarkSummary = unsafeText;

      expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).toBeNull();
      await expect(readWeComCustomerMappingCandidatesResponse(
        new Response(JSON.stringify(payload), { status: 200 }),
      )).resolves.toEqual({ ok: false, reason: 'response_contract_invalid' });
    }
  });

  it('BMP 内 P/Z/M/C/S 类别 code point 插入受控数字候选后绝不 accepted', () => {
    const categoryOracle = /[\p{P}\p{Z}\p{M}\p{C}\p{S}]/u;
    const payload = validPayload();
    let checked = 0;

    for (let codePoint = 0; codePoint <= 0xFFFF; codePoint += 1) {
      const character = String.fromCodePoint(codePoint);
      if (!categoryOracle.test(character)) continue;
      const unsafeText = checked % 2 === 0
        ? `138${character}0013${character}8000`
        : `110105${character}19491231${character}002X`;
      payload.candidates[0].externalContactSummary.remarkSummary = unsafeText;
      const label = `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;

      expect(
        parseWeComCustomerMappingCandidatesReadonlyResponse(payload),
        `${label} must be blocked as numeric sensitive data or unsafe Unicode`,
      ).toBeNull();
      checked += 1;
    }

    expect(checked).toBeGreaterThan(10_000);
  });

  it.each([
    ['U+1D167 MUSICAL SYMBOL COMBINING TREMOLO-1', '\u{1D167}'],
    ['U+1F4DE TELEPHONE RECEIVER', '\u{1F4DE}'],
    ['U+E0001 LANGUAGE TAG', '\u{E0001}'],
    ['U+E0100 VARIATION SELECTOR-17', '\u{E0100}'],
    ['U+F0000 PRIVATE USE', '\u{F0000}'],
    ['U+10FFFF NONCHARACTER', '\u{10FFFF}'],
  ])('%s supplementary-plane 字符不能绕过数字敏感信息边界', (_label, separator) => {
    const payload = validPayload();
    payload.candidates[0].externalContactSummary.remarkSummary =
      `138${separator}0013${separator}8000`;

    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).toBeNull();
  });

  it('未列入允许集合的 Unicode Cf 即使不在号码中也整体 fail-closed', async () => {
    const payload = validPayload();
    payload.candidates[0].externalContactSummary.remarkSummary = '普通؜摘要';

    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(payload)).toBeNull();
    await expect(readWeComCustomerMappingCandidatesResponse(
      new Response(JSON.stringify(payload), { status: 200 }),
    )).resolves.toEqual({ ok: false, reason: 'response_contract_invalid' });
  });

  it('audit 与 failClosedReason 只接受注册代码', () => {
    const arbitraryAuditReason = validPayload();
    arbitraryAuditReason.auditSummary.reasonCode = 'provider said: 原始任意文本';
    const unknownFailClosedReason = {
      ...createWeComCustomerMappingCandidatesFailClosedRawView({
        tenantId: 'tenant-mock-001',
        reason: 'provider_disabled',
      }),
      failClosedReason: 'unregistered_reason',
    };
    const { tenantId: _tenantId, ...readonlyUnknownReason } = unknownFailClosedReason;

    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(arbitraryAuditReason)).toBeNull();
    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(readonlyUnknownReason)).toBeNull();
  });

  it('strict parser 不执行 getter 或 inherited/custom toJSON', () => {
    const getterPayload = validPayload();
    let getterExecuted = false;
    Object.defineProperty(getterPayload, 'mappingStatus', {
      enumerable: true,
      get() {
        getterExecuted = true;
        return 'candidate';
      },
    });
    const inheritedToJson = Object.create({ toJSON: () => ({ leaked: true }) });
    Object.assign(inheritedToJson, validPayload());
    const customToJson = Object.assign(validPayload(), { toJSON: () => ({ leaked: true }) });

    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(getterPayload)).toBeNull();
    expect(getterExecuted).toBe(false);
    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(inheritedToJson)).toBeNull();
    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(customToJson)).toBeNull();
  });

  it('strict parser 在 Proxy 输入上 fail-closed 且不触发任何 trap', () => {
    let trapCount = 0;
    const proxy = new Proxy(validPayload(), {
      getPrototypeOf() {
        trapCount += 1;
        return Object.prototype;
      },
      ownKeys() {
        trapCount += 1;
        return [];
      },
      getOwnPropertyDescriptor() {
        trapCount += 1;
        return undefined;
      },
      get() {
        trapCount += 1;
        return undefined;
      },
    });

    expect(parseWeComCustomerMappingCandidatesReadonlyResponse(proxy)).toBeNull();
    expect(trapCount).toBe(0);
  });

  it('reader 对合法 JSON 的非法 shape 与非法 JSON 固定 fail-closed', async () => {
    await expect(readWeComCustomerMappingCandidatesResponse(
      new Response(JSON.stringify({ ...validPayload(), unknown: 'value' }), { status: 200 }),
    )).resolves.toEqual({ ok: false, reason: 'response_contract_invalid' });
    await expect(readWeComCustomerMappingCandidatesResponse(
      new Response('{invalid-json', { status: 200 }),
    )).resolves.toEqual({ ok: false, reason: 'response_json_invalid' });
  });

  it('reader 非 2xx 忽略敏感 body 并返回固定状态', async () => {
    const response = new Response('rawResponse=13812345678; secret=private', { status: 503 });
    const textSpy = vi.spyOn(response, 'text');
    const jsonSpy = vi.spyOn(response, 'json');

    await expect(readWeComCustomerMappingCandidatesResponse(response)).resolves.toEqual({
      ok: false,
      reason: 'response_unavailable',
    });
    expect(textSpy).not.toHaveBeenCalled();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('API 不包含禁止字段，且不产生网络或数据库访问', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const payload = await (await GET(request())).json();
    const serialized = JSON.stringify(payload);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(serialized).not.toMatch(
      /phone|mobile|idcard|external_?userid|externalUserId|userId|secret|token|credential|chatContent|conversationContent|sessionArchive|rawResponse|webhookPayload|apiResponse|payload/iu,
    );
  });
});
