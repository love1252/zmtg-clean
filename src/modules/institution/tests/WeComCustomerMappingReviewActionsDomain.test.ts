import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  executeWeComCustomerMappingReviewAction,
  weComCustomerMappingReviewActions,
  weComCustomerMappingReviewStates,
  type WeComCustomerMappingReviewActionCommand,
  type WeComCustomerMappingReviewAtomicBoundary,
  type WeComCustomerMappingReviewMapping,
  type WeComCustomerMappingReviewPermissionContext,
  type WeComCustomerMappingReviewSuccess,
} from '@/modules/institution/domain/wecom-customer-mapping-review-actions';

const context: WeComCustomerMappingReviewPermissionContext = {
  authenticated: true,
  tenantId: 'tenant-demo-a',
  institutionId: 'institution-demo-a',
  scope: 'tenant',
  capabilities: ['customer:read', 'customer:mapping_review'],
};

const mapping = (
  state: WeComCustomerMappingReviewMapping['state'] = 'pending_review',
  version = 3,
): WeComCustomerMappingReviewMapping => ({
  mappingId: 'mapping-demo-001',
  tenantId: context.tenantId,
  institutionId: context.institutionId,
  state,
  version,
});

const reasons = {
  approve_candidate: 'manual_evidence_confirmed',
  reject_candidate: 'evidence_not_sufficient',
  request_more_info: 'missing_low_sensitive_evidence',
  mark_conflict: 'multiple_candidate_conflict',
  reopen_review: 'new_low_sensitive_evidence',
} as const;

const command = (
  action: keyof typeof reasons = 'approve_candidate',
  overrides: Partial<WeComCustomerMappingReviewActionCommand> = {},
): WeComCustomerMappingReviewActionCommand => ({
  mappingId: 'mapping-demo-001',
  action,
  expectedVersion: 3,
  idempotencyKey: `review_${action}_0001`,
  reasonCode: reasons[action],
  ...(action === 'request_more_info' || action === 'mark_conflict' || action === 'reopen_review'
    ? { note: '仅需补充受控低敏证明' }
    : {}),
  ...overrides,
});

const run = (
  rawCommand: unknown = command(),
  permissionContext: unknown = context,
  currentMapping: unknown = mapping(),
  existingIdempotencyRecord: unknown = null,
  atomicBoundary?: unknown,
) => executeWeComCustomerMappingReviewAction(
  rawCommand,
  permissionContext,
  currentMapping,
  existingIdempotencyRecord,
  atomicBoundary,
);

const success = (result: ReturnType<typeof run>): WeComCustomerMappingReviewSuccess => {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`expected success, received ${result.reasonCode}`);
  }
  return result;
};

const acquiredBoundary = (
  overrides: Partial<WeComCustomerMappingReviewAtomicBoundary> = {},
): WeComCustomerMappingReviewAtomicBoundary => ({
  occupationResult: 'acquired',
  acceptedAuditReady: true,
  responseContractReady: true,
  transactionReady: true,
  ...overrides,
});

const testHash = (domain: string, fields: readonly string[]): string => {
  const hasher = createHash('sha256');
  hasher.update(`${Buffer.byteLength(domain, 'utf8')}:${domain}`);
  for (const field of fields) {
    hasher.update(`${Buffer.byteLength(field, 'utf8')}:${field}`);
  }
  return `sha256:${hasher.digest('hex')}`;
};

const requestFingerprintForTest = (value: WeComCustomerMappingReviewActionCommand): string => testHash(
  'zmtg:05c-e3:mapping-review-request:v1',
  [
    value.mappingId,
    value.action,
    String(value.expectedVersion),
    value.reasonCode,
    value.note === undefined ? 'note:absent' : `note:present:${value.note}`,
  ],
);

const codePointLabel = (value: string): string => `U+${value.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;

const expectSensitiveNoteBlocked = (
  note: string,
  existingIdempotencyRecord: unknown = null,
  atomicBoundary?: unknown,
): void => {
  const current = mapping();
  const before = structuredClone(current);
  const result = run(
    command('approve_candidate', { note }),
    context,
    current,
    existingIdempotencyRecord,
    atomicBoundary,
  );
  expect(result).toEqual({
    ok: false,
    reasonCode: 'sensitive_input_blocked',
    auditEvents: [],
  });
  expect(result).not.toHaveProperty('mutationResult');
  expect(result).not.toHaveProperty('idempotencyRecord');
  expect(result).not.toHaveProperty('nextState');
  expect(JSON.stringify(result)).not.toContain(note);
  expect(current).toEqual(before);
};

describe('WeCom customer mapping review actions domain', () => {
  it('声明五个动作和七个状态的闭集', () => {
    expect(weComCustomerMappingReviewActions).toEqual([
      'approve_candidate',
      'reject_candidate',
      'request_more_info',
      'mark_conflict',
      'reopen_review',
    ]);
    expect(weComCustomerMappingReviewStates).toEqual([
      'pending_review',
      'needs_more_info',
      'conflict',
      'approved_pending_link',
      'rejected',
      'reopened',
      'disabled',
    ]);
  });

  it.each([
    ['approve_candidate', 'pending_review', 'approved_pending_link'],
    ['reject_candidate', 'pending_review', 'rejected'],
    ['request_more_info', 'pending_review', 'needs_more_info'],
    ['mark_conflict', 'pending_review', 'conflict'],
    ['reopen_review', 'conflict', 'reopened'],
  ] as const)('%s 执行合法 transition：%s → %s', (action, before, after) => {
    const result = success(run(command(action), context, mapping(before)));
    expect(result.mutationResult).toMatchObject({
      previousState: before,
      nextState: after,
      previousVersion: 3,
      nextVersion: 4,
      autoMergePerformed: false,
      realCustomerRelationshipWritten: false,
    });
    expect(result.idempotencyRecord.status).toBe('completed');
    expect(result.auditEvents.map((event) => event.eventType)).toEqual([
      'mapping_review_action_requested',
      {
        approve_candidate: 'mapping_review_approved',
        reject_candidate: 'mapping_review_rejected',
        request_more_info: 'mapping_review_more_info_requested',
        mark_conflict: 'mapping_review_conflict_marked',
        reopen_review: 'mapping_review_reopened',
      }[action],
    ]);
  });

  it.each([
    ['approve_candidate', 'needs_more_info', 'approved_pending_link'],
    ['approve_candidate', 'reopened', 'approved_pending_link'],
    ['reject_candidate', 'needs_more_info', 'rejected'],
    ['reject_candidate', 'conflict', 'rejected'],
    ['reject_candidate', 'reopened', 'rejected'],
    ['request_more_info', 'conflict', 'needs_more_info'],
    ['request_more_info', 'reopened', 'needs_more_info'],
    ['mark_conflict', 'needs_more_info', 'conflict'],
    ['mark_conflict', 'reopened', 'conflict'],
    ['reopen_review', 'approved_pending_link', 'reopened'],
    ['reopen_review', 'rejected', 'reopened'],
  ] as const)('覆盖补充合法 transition：%s %s → %s', (action, before, after) => {
    expect(success(run(command(action), context, mapping(before))).mutationResult.nextState).toBe(after);
  });

  it.each([
    ['approve_candidate', 'conflict'],
    ['approve_candidate', 'approved_pending_link'],
    ['approve_candidate', 'rejected'],
    ['reject_candidate', 'approved_pending_link'],
    ['reject_candidate', 'rejected'],
    ['request_more_info', 'needs_more_info'],
    ['request_more_info', 'approved_pending_link'],
    ['request_more_info', 'rejected'],
    ['mark_conflict', 'conflict'],
    ['mark_conflict', 'approved_pending_link'],
    ['mark_conflict', 'rejected'],
    ['reopen_review', 'pending_review'],
    ['reopen_review', 'needs_more_info'],
    ['reopen_review', 'reopened'],
  ] as const)('非法 transition fail-closed：%s / %s', (action, state) => {
    const current = mapping(state);
    const before = structuredClone(current);
    expect(run(command(action), context, current)).toMatchObject({ ok: false, reasonCode: 'action_not_allowed' });
    expect(current).toEqual(before);
  });

  it.each(weComCustomerMappingReviewActions)('disabled 不能被 %s 绕过', (action) => {
    expect(run(command(action), context, mapping('disabled'))).toMatchObject({
      ok: false,
      reasonCode: 'action_not_allowed',
    });
  });

  it('approve 只能进入 approved_pending_link，且不产生真实关系语义', () => {
    const result = success(run());
    expect(result.mutationResult.nextState).toBe('approved_pending_link');
    expect([
      result.mutationResult.previousState,
      result.mutationResult.nextState,
      ...result.auditEvents.flatMap((event) => [event.previousState, event.nextState]),
    ]).not.toEqual(expect.arrayContaining(['linked', 'merged', 'relation_written', 'auto_merged']));
    expect(result.mutationResult.autoMergePerformed).toBe(false);
    expect(result.mutationResult.realCustomerRelationshipWritten).toBe(false);
  });

  it('customer:read 不自动授予 mutation capability，权限检查优先 replay', () => {
    const first = success(run());
    const readOnly = { ...context, capabilities: ['customer:read'] };
    expect(run(command(), readOnly, mapping('rejected', 99), first.idempotencyRecord)).toEqual({
      ok: false,
      reasonCode: 'permission_denied',
      auditEvents: expect.any(Array),
    });
  });

  it('非 tenant scope 即使带 capability 也不能执行机构 mutation', () => {
    expect(run(command(), { ...context, scope: 'platform' })).toMatchObject({
      ok: false,
      reasonCode: 'permission_denied',
    });
  });

  it('tenant 与 institution mismatch 均 fail-closed', () => {
    expect(run(command(), { ...context, tenantId: 'tenant-other' })).toMatchObject({
      ok: false,
      reasonCode: 'tenant_mismatch',
    });
    expect(run(command(), { ...context, institutionId: 'institution-other' })).toMatchObject({
      ok: false,
      reasonCode: 'tenant_mismatch',
    });
  });

  it('command exact keys：unknown、targetStatus、autoMerge 和 relationship payload 均拒绝', () => {
    for (const extra of [
      { unknown: true },
      { targetStatus: 'approved_pending_link' },
      { autoMerge: false },
      { relationshipPayload: { customerId: 'customer-demo' } },
      { tenantId: context.tenantId },
      { institutionId: context.institutionId },
    ]) {
      expect(run({ ...command(), ...extra })).toMatchObject({
        ok: false,
        reasonCode: 'request_contract_invalid',
      });
    }
  });

  it('拒绝非法 action、跨动作 reason 和 clear_candidate', () => {
    expect(run({ ...command(), action: 'clear_candidate' })).toMatchObject({
      ok: false,
      reasonCode: 'request_contract_invalid',
    });
    expect(run({ ...command(), action: 'approve_candidate', reasonCode: 'evidence_not_sufficient' })).toMatchObject({
      ok: false,
      reasonCode: 'request_contract_invalid',
    });
  });

  it.each([
    'short',
    'review key with space',
    'review.key.with.dot',
    'review/key/with/slash',
    'review:key:colon',
    '复核键值_1234567890123456',
    'review_key_123456789\n',
    `review_${'a'.repeat(122)}`,
  ])('idempotencyKey 严格拒绝非法值且不 trim：%j', (idempotencyKey) => {
    const result = run(command('approve_candidate', { idempotencyKey }));
    expect(result).toMatchObject({ ok: false, reasonCode: 'idempotency_key_invalid' });
    expect(JSON.stringify(result)).not.toContain(idempotencyKey);
  });

  it('idempotencyKey 大小写敏感，输出与审计不保存原始 key', () => {
    const lower = success(run(command('approve_candidate', { idempotencyKey: 'review_case_key_0001' })));
    const upperCommand = command('approve_candidate', { idempotencyKey: 'REVIEW_CASE_KEY_0001' });
    expect(run(upperCommand, context, mapping(), lower.idempotencyRecord)).toMatchObject({
      ok: false,
      reasonCode: 'idempotency_record_invalid',
    });
    expect(JSON.stringify(lower)).not.toContain('review_case_key_0001');
    expect(lower.idempotencyRecord.keyDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('同 key 同指纹 completed replay 返回首次低敏结果，不重验当前 version', () => {
    const first = success(run());
    const replay = success(run(command(), context, mapping('rejected', 99), first.idempotencyRecord));
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.mutationResult).toEqual(first.mutationResult);
    expect(replay.auditEvents.map((event) => event.eventType)).toEqual(['mapping_review_idempotent_replay']);
  });

  it('同 key 不同指纹 conflict 优先于 version conflict', () => {
    const first = success(run());
    expect(run(
      command('approve_candidate', { expectedVersion: 2 }),
      context,
      mapping('rejected', 99),
      first.idempotencyRecord,
    )).toMatchObject({ ok: false, reasonCode: 'idempotency_conflict' });
  });

  it('同指纹 in_progress 固定阻断', () => {
    const first = success(run());
    const inProgress = {
      ...first.idempotencyRecord,
      status: 'in_progress',
      completedResult: null,
      completedResultDigest: null,
    };
    expect(run(command(), context, mapping(), inProgress)).toMatchObject({
      ok: false,
      reasonCode: 'idempotency_in_progress',
    });
  });

  it('幂等记录 shape、scope 或 completed result 完整性异常均 fail-closed', () => {
    const first = success(run());
    for (const invalid of [
      { ...first.idempotencyRecord, status: 'unknown' },
      { ...first.idempotencyRecord, tenantId: 'tenant-other' },
      { ...first.idempotencyRecord, completedResult: null },
      { ...first.idempotencyRecord, extra: true },
      { ...first.idempotencyRecord, completedResult: { ...first.idempotencyRecord.completedResult, nextVersion: 99 } },
    ]) {
      expect(run(command(), context, mapping(), invalid)).toMatchObject({
        ok: false,
        reasonCode: 'idempotency_record_invalid',
      });
    }
  });

  it('无已有记录时 stale expectedVersion 不创建幂等记录也不改变输入', () => {
    const current = mapping('pending_review', 4);
    const before = structuredClone(current);
    const result = run(command(), context, current);
    expect(result).toMatchObject({ ok: false, reasonCode: 'version_conflict' });
    expect(result).not.toHaveProperty('idempotencyRecord');
    expect(current).toEqual(before);
  });

  it('并发 approve / reject 仅首个成功，后一个得到 version_conflict', () => {
    const approved = success(run());
    const advanced = { ...mapping(), state: approved.mutationResult.nextState, version: approved.mutationResult.nextVersion };
    expect(run(
      command('reject_candidate', { idempotencyKey: 'reject_concurrent_0001' }),
      context,
      advanced,
    )).toMatchObject({ ok: false, reasonCode: 'version_conflict' });
  });

  it('unique occupation race 回到已有 completed 记录语义', () => {
    const winner = success(run());
    const boundary = acquiredBoundary({
      occupationResult: { kind: 'existing', record: winner.idempotencyRecord },
    });
    const raced = success(run(command(), context, mapping(), null, boundary));
    expect(raced.idempotentReplay).toBe(true);
    expect(raced.mutationResult).toEqual(winner.mutationResult);
  });

  it('accepted audit 失败时整体不提交', () => {
    const current = mapping();
    const before = structuredClone(current);
    const result = run(command(), context, current, null, acquiredBoundary({ acceptedAuditReady: false }));
    expect(result).toMatchObject({ ok: false, reasonCode: 'audit_unavailable' });
    expect(result).not.toHaveProperty('mutationResult');
    expect(result).not.toHaveProperty('idempotencyRecord');
    expect(current).toEqual(before);
  });

  it('输出重新校验失败时整体不提交', () => {
    const result = run(command(), context, mapping(), null, acquiredBoundary({ responseContractReady: false }));
    expect(result).toMatchObject({ ok: false, reasonCode: 'response_contract_invalid' });
    expect(result).not.toHaveProperty('mutationResult');
    expect(result).not.toHaveProperty('idempotencyRecord');
    expect(result.auditEvents).not.toContainEqual(expect.objectContaining({ eventType: 'mapping_review_approved' }));
  });

  it('transaction 失败时不返回 partial nextState', () => {
    expect(run(command(), context, mapping(), null, acquiredBoundary({ transactionReady: false }))).toEqual({
      ok: false,
      reasonCode: 'transaction_failed',
      auditEvents: expect.any(Array),
    });
  });

  it.each([
    '请联系 13800138000 核验',
    '身份证 11010519491231002X',
    'access_token=abcdef123456',
    'corp_secret=abcdef123456',
    'credential: abcdef123456',
    'raw_payload={demo}',
    'external_userid=wm_abcdef',
    'userid=zhangsan',
    'chat_content=完整聊天内容',
    'conversation archive 内容',
  ])('note 敏感文本阻断且不回显命中原文：%s', (note) => {
    expectSensitiveNoteBlocked(note);
  });

  it.each([
    ['裸手机号 / U+200B', `138​0013​8000`],
    ['+86 手机号 / U+200C U+200D', `+86‌138‍00138000`],
    ['0086 手机号 / U+2060', `0086⁠13800138000`],
    ['手机号 / U+FEFF', `138﻿00138000`],
    ['手机号 / Unicode dash', `138‑0013‒8000`],
    ['手机号 / Unicode space', `138 0013 8000`],
    ['手机号 / combining marks', `138͏0013́8000`],
    ['手机号 / variation selector', `138️00138000`],
    ['全角手机号', '１３８００１３８０００'],
    ['ASCII 与全角混合手机号', '138００1３80０0'],
    ['手机号 / Lm', `138ʰ0013ʲ8000`],
    ['手机号 / supplementary symbol', `138\u{1F600}00138000`],
    ['18 位身份证 / zero-width', `110105​19491231002X`],
    ['18 位身份证 / Unicode dash', `110105‐19491231002x`],
    ['18 位身份证 / combining', `110105́19491231002X`],
    ['18 位全角身份证', '１１０１０５１９４９１２３１００２Ｘ'],
    ['18 位混合身份证', '110１０５194９1231002x'],
    ['18 位身份证 / supplementary mark', `110105\u{E0100}19491231002X`],
  ])('Unicode 数字敏感信息 fail-closed：%s', (_label, note) => {
    expectSensitiveNoteBlocked(note);
  });

  it('Unicode 混淆类别对手机号各前缀和两种身份证格式保持不变量', () => {
    const separators = [
      '​',
      '‌',
      '‍',
      '⁠',
      '﻿',
      '‐',
      ' ',
      '͏',
      '́',
      '️',
      'ʰ',
      '\u{1F600}',
      '\u{E0100}',
    ];
    for (const separator of separators) {
      const label = codePointLabel(separator);
      for (const note of [
        `138${separator}00138000`,
        `+86${separator}13800138000`,
        `0086${separator}13800138000`,
        `110105${separator}194912310020`,
        `110105${separator}19491231002X`,
      ]) {
        expect(run(command('approve_candidate', { note })), label).toMatchObject({
          ok: false,
          reasonCode: 'sensitive_input_blocked',
        });
      }
    }
  });

  it('按 Unicode 类别验证局部数字候选，失败信息包含 code point', () => {
    const representatives = [
      ['P', '—', /\p{P}/u],
      ['Z', ' ', /\p{Z}/u],
      ['M', '͏', /\p{M}/u],
      ['C', '⁠', /\p{C}/u],
      ['S', '☃', /\p{S}/u],
      ['Lm', 'ʰ', /\p{Lm}/u],
      ['supplementary S', '\u{1F600}', /\p{S}/u],
      ['supplementary M', '\u{E0100}', /\p{M}/u],
    ] as const;

    for (const [category, separator, oracle] of representatives) {
      const label = `${category} ${codePointLabel(separator)}`;
      expect(oracle.test(separator), label).toBe(true);
      const phone = `138${separator}0013${separator}8000`;
      const identity = `110105${separator}19491231${separator}002X`;
      expect(run(command('approve_candidate', { note: phone })), label).toMatchObject({
        ok: false,
        reasonCode: 'sensitive_input_blocked',
      });
      expect(run(command('approve_candidate', { note: identity })), label).toMatchObject({
        ok: false,
        reasonCode: 'sensitive_input_blocked',
      });
    }
  });

  it.each([
    ['Cc', `低敏说明`],
    ['Cf', `低敏说明​`],
    ['Co', `低敏说明`],
    ['Nl', `低敏说明Ⅰ`],
    ['BMP noncharacter', `低敏说明﷐`],
    ['plane noncharacter', `低敏说明\u{1FFFF}`],
    ['lone high surrogate', `低敏说明\uD800`],
    ['lone low surrogate', `低敏说明\uDC00`],
  ])('note Unicode 完整性固定 fail-closed：%s', (_label, note) => {
    expectSensitiveNoteBlocked(note);
  });

  it('note 上限按 code point 计算，允许 512 个 supplementary code point 并拒绝第 513 个', () => {
    expect(run(command('approve_candidate', { note: '\u{20000}'.repeat(512) }))).toMatchObject({ ok: true });
    expectSensitiveNoteBlocked('安'.repeat(513));
  });

  it.each([
    '订单 138，批次 0013，数量 8000',
    '编号 110105，日期 19491231，序号 002X',
    '订单138正常文字00138000',
    '编号110105普通text19491231002X',
  ])('数字候选不跨普通文字或独立片段拼接：%s', (note) => {
    expect(run(command('approve_candidate', { note }))).toMatchObject({ ok: true });
  });

  it.each([
    'token',
    'access_token',
    'secret',
    'credential',
    'payload',
    'raw_payload',
    'webhook_payload',
    'api_response',
    'raw_response',
    'provider_response',
    'external_userid',
    'externalUserId',
    'userid',
    'userId',
    'chat',
    'message_content',
    'conversation',
    'conversation_content',
    'archive',
    'archive_content',
  ])('独立敏感 token / phrase 大小写不敏感阻断：%s', (marker) => {
    expectSensitiveNoteBlocked(`字段:${marker.toUpperCase()}:受控值`);
  });

  it.each(['_', '-', '.', ':', '/', ' '])('敏感 phrase 支持 %j 分隔', (separator) => {
    for (const words of [
      ['access', 'token'],
      ['raw', 'payload'],
      ['webhook', 'payload'],
      ['api', 'response'],
      ['raw', 'response'],
      ['provider', 'response'],
      ['external', 'user', 'id'],
      ['user', 'id'],
      ['message', 'content'],
      ['conversation', 'content'],
      ['archive', 'content'],
    ]) {
      expectSensitiveNoteBlocked(`字段:${words.join(separator)}:受控值`);
    }
  });

  it.each([
    `to​ken`,
    `to͏ken`,
    `access‌_́token`,
    `api⁠_͏response`,
    `external﻿UseŕId`,
    `message\u{E0100}_content`,
  ])('敏感标记不能被零宽字符、组合标记或 variation selector 拆分：%s', (marker) => {
    expectSensitiveNoteBlocked(`字段:${marker}:受控值`);
  });

  it.each([
    'tokenization 规则已评审',
    'archive design 已评审',
    '正常中文低敏备注',
    '业务描述不含受控字段内容',
    'payloading 不是独立字段',
    'conversationist 是普通完整单词',
  ])('安全文本不因 substring 或普通业务语义被误杀：%s', (note) => {
    expect(run(command('approve_candidate', { note }))).toMatchObject({ ok: true });
  });

  it('敏感 note 在 strict parser 阶段阻断，早于 permission、tenant、version、replay 和 occupation', () => {
    const note = `手机号 138​00138000 api_response`;
    const first = success(run());
    const forgedCommand = command('approve_candidate', { note });
    const forgedReplay = {
      ...first.idempotencyRecord,
      requestFingerprint: requestFingerprintForTest(forgedCommand),
    };
    for (const result of [
      run(forgedCommand, { ...context, capabilities: [] }, mapping('disabled', 99), forgedReplay),
      run(forgedCommand, { ...context, tenantId: 'tenant-other' }, mapping(), forgedReplay),
      run(forgedCommand, context, mapping('disabled', 99), forgedReplay),
      run(forgedCommand, context, mapping(), null, acquiredBoundary({
        occupationResult: { kind: 'existing', record: forgedReplay },
      })),
    ]) {
      expect(result).toEqual({ ok: false, reasonCode: 'sensitive_input_blocked', auditEvents: [] });
      expect(result).not.toHaveProperty('idempotencyRecord');
      expect(result).not.toHaveProperty('mutationResult');
      expect(JSON.stringify(result)).not.toContain(note);
    }
  });

  it('敏感 note 不产生请求指纹、幂等占位、accepted audit 或部分状态结果', () => {
    const note = `secret​:138͏00138000`;
    expectSensitiveNoteBlocked(note, null, acquiredBoundary());
    const serialized = JSON.stringify(run(command('approve_candidate', { note })));
    expect(serialized).not.toContain('sha256:');
    expect(serialized).not.toContain('mapping_review_action_requested');
    expect(serialized).not.toContain('mapping_review_approved');
    expect(serialized).not.toContain(note);
  });

  it('note 有 code point 上限，必填动作拒绝缺失或空备注', () => {
    expectSensitiveNoteBlocked('a'.repeat(513));
    const noNote = command('request_more_info');
    delete (noNote as { note?: string }).note;
    expect(run(noNote)).toMatchObject({ ok: false, reasonCode: 'request_contract_invalid' });
    expect(run(command('mark_conflict', { note: '' }))).toMatchObject({
      ok: false,
      reasonCode: 'request_contract_invalid',
    });
  });

  it('candidate_not_same_person 要求低敏 note', () => {
    expect(run(command('reject_candidate', {
      reasonCode: 'candidate_not_same_person',
    }))).toMatchObject({ ok: false, reasonCode: 'request_contract_invalid' });
  });

  it('getter、setter 和 toJSON 不执行', () => {
    const getter = vi.fn(() => 'mapping-demo-001');
    const setter = vi.fn();
    const toJSON = vi.fn();
    const raw = { ...command(), toJSON } as Record<string, unknown>;
    Object.defineProperty(raw, 'mappingId', { enumerable: true, get: getter, set: setter });
    const result = run(raw);
    expect(result).toMatchObject({ ok: false, reasonCode: 'request_contract_invalid' });
    expect(getter).not.toHaveBeenCalled();
    expect(setter).not.toHaveBeenCalled();
    expect(toJSON).not.toHaveBeenCalled();
  });

  it('Proxy 在任何反射 trap 前 fail-closed', () => {
    const traps = {
      ownKeys: vi.fn(() => Reflect.ownKeys(command())),
      getPrototypeOf: vi.fn(() => Object.prototype),
      getOwnPropertyDescriptor: vi.fn(),
      get: vi.fn(),
    };
    const proxied = new Proxy(command(), traps);
    expect(run(proxied)).toMatchObject({ ok: false, reasonCode: 'request_contract_invalid' });
    expect(traps.ownKeys).not.toHaveBeenCalled();
    expect(traps.getPrototypeOf).not.toHaveBeenCalled();
    expect(traps.getOwnPropertyDescriptor).not.toHaveBeenCalled();
    expect(traps.get).not.toHaveBeenCalled();
  });

  it('输入 mapping 和 command 均不会被 mutation', () => {
    const rawCommand = command();
    const current = mapping();
    const commandBefore = structuredClone(rawCommand);
    const mappingBefore = structuredClone(current);
    success(run(rawCommand, context, current));
    expect(rawCommand).toEqual(commandBefore);
    expect(current).toEqual(mappingBefore);
  });

  it('请求指纹绑定固定字段并区分 note 规范值，不依赖 command insertion order', () => {
    const original = success(run(command('approve_candidate', { note: '低敏说明 A' })));
    const reordered = {
      note: '低敏说明 A',
      reasonCode: 'manual_evidence_confirmed',
      idempotencyKey: command().idempotencyKey,
      expectedVersion: 3,
      action: 'approve_candidate',
      mappingId: 'mapping-demo-001',
    };
    const replay = success(run(reordered, context, mapping('rejected', 9), original.idempotencyRecord));
    expect(replay.idempotentReplay).toBe(true);
    expect(run(
      command('approve_candidate', { note: '低敏说明 B' }),
      context,
      mapping(),
      original.idempotencyRecord,
    )).toMatchObject({ ok: false, reasonCode: 'idempotency_conflict' });
  });

  it('body、string 和 recursion 边界 fail-closed，不接受 nested payload', () => {
    expect(run({ ...command(), note: { nested: 'value' } })).toMatchObject({
      ok: false,
      reasonCode: 'request_contract_invalid',
    });
    expect(run({ ...command(), mappingId: 'm'.repeat(257) })).toMatchObject({
      ok: false,
      reasonCode: 'request_contract_invalid',
    });
  });

  it('成功与 replay 输出均 recursive frozen', () => {
    const first = success(run());
    const replay = success(run(command(), context, mapping('rejected', 9), first.idempotencyRecord));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.mutationResult)).toBe(true);
    expect(Object.isFrozen(first.auditEvents)).toBe(true);
    expect(Object.isFrozen(first.idempotencyRecord.completedResult)).toBe(true);
    expect(Object.isFrozen(replay)).toBe(true);
  });
});
