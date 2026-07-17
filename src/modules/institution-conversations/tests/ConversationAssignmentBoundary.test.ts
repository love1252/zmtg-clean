import { describe, expect, it } from 'vitest';
import {
  acceptConversationAssignment,
  assignConversationSegment,
  projectConversationAssignments,
  reassignConversationSegment,
  rejectConversationAssignment,
  releaseConversationAssignment,
  type ConversationAssignmentFact,
  type ConversationAssignmentHistory,
  type ConversationAssignmentMutationResult,
} from '@/modules/institution-conversations/domain/conversation-assignments';

const opaqueReference = (prefix: string, value: number): string => (
  `${prefix}_a${value.toString(16).padStart(15, '0')}`
);
const idempotencyKey = (value: number): string => (
  `idem_a${value.toString(16).padStart(31, '0')}`
);
const eventId = (value: number): string => opaqueReference('ase', value);
const assignmentId = (value: number): string => opaqueReference('asn', value);
const userId = (value: number): string => opaqueReference('usr', value);

const target = {
  tenantId: opaqueReference('ten', 1),
  institutionId: opaqueReference('ins', 1),
  conversationId: opaqueReference('con', 1),
  segmentId: opaqueReference('seg', 1),
} as const;

const assignCommand = (overrides: Record<string, unknown> = {}) => ({
  eventId: eventId(1),
  assignmentId: assignmentId(1),
  ...target,
  expectedRevision: 0,
  idempotencyKey: idempotencyKey(1),
  actorUserId: userId(1),
  actorRole: 'tenant_admin',
  assigneeUserId: userId(2),
  assigneeRole: 'consultant',
  sourceSegmentState: 'awaiting_human',
  occurredAt: '2026-07-17T01:00:00.000Z',
  ...overrides,
});

const decisionCommand = (overrides: Record<string, unknown> = {}) => ({
  eventId: eventId(2),
  assignmentId: assignmentId(1),
  ...target,
  expectedRevision: 1,
  idempotencyKey: idempotencyKey(2),
  actorUserId: userId(2),
  actorRole: 'consultant',
  sourceSegmentState: 'awaiting_human',
  occurredAt: '2026-07-17T01:01:00.000Z',
  ...overrides,
});

const reassignCommand = (overrides: Record<string, unknown> = {}) => ({
  releaseEventId: eventId(10),
  assignedEventId: eventId(11),
  currentAssignmentId: assignmentId(1),
  newAssignmentId: assignmentId(2),
  ...target,
  expectedRevision: 1,
  idempotencyKey: idempotencyKey(10),
  actorUserId: userId(3),
  actorRole: 'tenant_operator',
  newAssigneeUserId: userId(4),
  newAssigneeRole: 'customer_service',
  sourceSegmentState: 'awaiting_human',
  occurredAt: '2026-07-17T01:02:00.000Z',
  ...overrides,
});

const success = (result: ConversationAssignmentMutationResult): Extract<
  ConversationAssignmentMutationResult,
  { kind: 'applied' | 'replayed' }
> => {
  expect(result.kind === 'applied' || result.kind === 'replayed').toBe(true);
  if (result.kind === 'blocked') {
    throw new Error(`expected successful assignment mutation, received ${result.code}`);
  }
  return result;
};

const assignedHistory = (): ConversationAssignmentHistory => success(
  assignConversationSegment([], assignCommand()),
).history;

const acceptedHistory = (): ConversationAssignmentHistory => success(
  acceptConversationAssignment(assignedHistory(), decisionCommand()),
).history;

describe('conversation assignment boundaries', () => {
  it('空、assigned、accepted、rejected、released 只投影权威 0 或 1', () => {
    expect(projectConversationAssignments([], target)).toEqual({
      kind: 'projected',
      projection: {
        ...target,
        revision: 0,
        assignmentId: null,
        assigneeRole: null,
        assignmentStatus: null,
        activeAssignmentCount: 0,
        assigneeId: null,
      },
    });

    const assigned = assignedHistory();
    expect(projectConversationAssignments(assigned, target)).toMatchObject({
      kind: 'projected',
      projection: {
        assignmentStatus: 'assigned',
        activeAssignmentCount: 1,
        assigneeId: userId(2),
      },
    });

    const accepted = acceptedHistory();
    expect(projectConversationAssignments(accepted, target)).toMatchObject({
      kind: 'projected',
      projection: {
        assignmentStatus: 'accepted',
        activeAssignmentCount: 1,
        assigneeId: userId(2),
      },
    });

    const rejected = success(rejectConversationAssignment(assigned, decisionCommand())).history;
    expect(projectConversationAssignments(rejected, target)).toMatchObject({
      kind: 'projected',
      projection: { activeAssignmentCount: 0, assigneeId: null },
    });

    const released = success(releaseConversationAssignment(accepted, decisionCommand({
      eventId: eventId(3),
      expectedRevision: 2,
      idempotencyKey: idempotencyKey(3),
      sourceSegmentState: 'human_handling',
      occurredAt: '2026-07-17T01:02:00.000Z',
    }))).history;
    expect(projectConversationAssignments(released, target)).toMatchObject({
      kind: 'projected',
      projection: { activeAssignmentCount: 0, assigneeId: null },
    });
  });

  it('投影保留 scope、target、revision 和 assignment provenance，不输出裸 guard', () => {
    const result = projectConversationAssignments(assignedHistory(), target);
    expect(result.kind).toBe('projected');
    if (result.kind !== 'projected') return;

    expect(result.projection).toMatchObject({
      ...target,
      revision: 1,
      assignmentId: assignmentId(1),
      assignmentStatus: 'assigned',
      activeAssignmentCount: 1,
      assigneeId: userId(2),
    });
    expect('guard' in result.projection).toBe(false);
  });

  it.each([
    [{ tenantId: opaqueReference('ten', 99) }, 'scope_mismatch'],
    [{ institutionId: opaqueReference('ins', 99) }, 'scope_mismatch'],
    [{ conversationId: opaqueReference('con', 99) }, 'target_mismatch'],
    [{ segmentId: opaqueReference('seg', 99) }, 'target_mismatch'],
  ] as const)('先按 scope/target 拒绝同名 ID 与幂等键：%j', (overrides, code) => {
    const history = assignedHistory();
    expect(assignConversationSegment(history, assignCommand(overrides))).toEqual({
      kind: 'blocked',
      code,
    });
    expect(projectConversationAssignments(history, { ...target, ...overrides })).toEqual({
      kind: 'blocked',
      code,
    });
  });

  it('合法 target 的 scope mismatch 先于非 scope 字段错误和幂等查询', () => {
    expect(assignConversationSegment(assignedHistory(), assignCommand({
      tenantId: opaqueReference('ten', 99),
      actorUserId: 'not-an-opaque-user-reference',
      idempotencyKey: 'not-an-opaque-idempotency-key',
    }))).toEqual({ kind: 'blocked', code: 'scope_mismatch' });

    expect(acceptConversationAssignment(assignedHistory(), decisionCommand({
      tenantId: opaqueReference('ten', 99),
      actorUserId: 'not-an-opaque-user-reference',
      idempotencyKey: 'not-an-opaque-idempotency-key',
    }))).toEqual({ kind: 'blocked', code: 'scope_mismatch' });

    expect(reassignConversationSegment(assignedHistory(), reassignCommand({
      institutionId: opaqueReference('ins', 99),
      actorUserId: 'not-an-opaque-user-reference',
      idempotencyKey: 'not-an-opaque-idempotency-key',
    }))).toEqual({ kind: 'blocked', code: 'scope_mismatch' });
  });

  it('不同机构可独立使用同名 ID/key，但混入另一机构历史 fail-closed', () => {
    const institutionOne = assignedHistory();
    const institutionTwo = success(assignConversationSegment([], assignCommand({
      tenantId: opaqueReference('ten', 2),
      institutionId: opaqueReference('ins', 2),
    })));
    expect(institutionTwo.kind).toBe('applied');
    expect(institutionTwo.projection.tenantId).toBe(opaqueReference('ten', 2));

    const mixed = [
      ...institutionOne,
      { ...institutionTwo.history[0], revision: 2 },
    ];
    expect(projectConversationAssignments(mixed, target)).toEqual({
      kind: 'blocked',
      code: 'invalid_assignment_history',
    });
    expect(assignConversationSegment(mixed, assignCommand({
      eventId: eventId(99),
      assignmentId: assignmentId(99),
      expectedRevision: 2,
      idempotencyKey: idempotencyKey(99),
    }))).toEqual({ kind: 'blocked', code: 'invalid_assignment_history' });
  });

  it.each([
    'revision_gap',
    'duplicate_event',
    'time_reversal',
    'unknown_status',
    'unknown_role',
    'unknown_reason',
    'extra_key',
    'symbol_key',
  ] as const)('损坏历史 %s 不得产生可用 guard', (corruption) => {
    const base = assignedHistory()[0]!;
    let history: unknown;
    if (corruption === 'revision_gap') {
      history = [{ ...base, revision: 2 }];
    } else if (corruption === 'duplicate_event') {
      history = [base, {
        ...base,
        revision: 2,
        assignmentId: assignmentId(2),
        idempotencyKey: idempotencyKey(90),
      }];
    } else if (corruption === 'time_reversal') {
      history = [base, {
        ...base,
        eventId: eventId(2),
        revision: 2,
        status: 'accepted',
        actorUserId: base.assigneeUserId,
        actorRole: base.assigneeRole,
        idempotencyKey: idempotencyKey(91),
        occurredAt: '2026-07-17T00:59:59.999Z',
      }];
    } else if (corruption === 'unknown_status') {
      history = [{ ...base, status: 'pending' }];
    } else if (corruption === 'unknown_role') {
      history = [{ ...base, assigneeRole: 'advisor' }];
    } else if (corruption === 'unknown_reason') {
      history = [{ ...base, reasonCode: 'free_text_reason' }];
    } else if (corruption === 'extra_key') {
      history = [{ ...base, note: 'not allowed' }];
    } else {
      const withSymbol = { ...base } as ConversationAssignmentFact & Record<symbol, string>;
      withSymbol[Symbol('hidden')] = 'not allowed';
      history = [withSymbol];
    }
    expect(projectConversationAssignments(history, target)).toEqual({
      kind: 'blocked',
      code: 'invalid_assignment_history',
    });
  });

  it('双活动分配、错误生命周期和半个改派批次均整体 fail-closed', () => {
    const first = assignedHistory()[0]!;
    const secondActive = {
      ...first,
      eventId: eventId(2),
      assignmentId: assignmentId(2),
      revision: 2,
      idempotencyKey: idempotencyKey(92),
      assigneeUserId: userId(4),
      assigneeRole: 'customer_service',
      occurredAt: '2026-07-17T01:01:00.000Z',
    } satisfies ConversationAssignmentFact;
    expect(projectConversationAssignments([first, secondActive], target)).toEqual({
      kind: 'blocked',
      code: 'invalid_assignment_history',
    });

    const invalidAccepted = {
      ...first,
      eventId: eventId(3),
      assignmentId: assignmentId(99),
      revision: 2,
      status: 'accepted',
      actorUserId: first.assigneeUserId,
      actorRole: first.assigneeRole,
      idempotencyKey: idempotencyKey(93),
      occurredAt: '2026-07-17T01:01:00.000Z',
    } satisfies ConversationAssignmentFact;
    expect(projectConversationAssignments([first, invalidAccepted], target)).toEqual({
      kind: 'blocked',
      code: 'invalid_assignment_history',
    });

    const reassigned = success(reassignConversationSegment(assignedHistory(), reassignCommand()));
    expect(projectConversationAssignments(reassigned.history.slice(0, -1), target)).toEqual({
      kind: 'blocked',
      code: 'invalid_assignment_history',
    });

    const accepted = acceptedHistory();
    expect(projectConversationAssignments([
      accepted[0]!,
      { ...accepted[1]!, idempotencyKey: accepted[0]!.idempotencyKey },
    ], target)).toEqual({
      kind: 'blocked',
      code: 'invalid_assignment_history',
    });
  });

  it('命令必须是 exact plain data object，额外敏感或自由文本字段不能进入事实', () => {
    const forbiddenValues = {
      phone: '138-0013-8000',
      email: 'patient@example.test',
      displayName: '张某某',
      address: '某市某路 88 号',
      diagnosis: '示例诊断文本',
      messageBody: '客户聊天正文',
      safeSummary: '自由摘要',
      channelNickname: '渠道昵称',
      externalAccount: 'wxid_example',
      providerPayload: { raw: 'payload' },
      credential: 'secret-value',
      note: '自由备注',
      internalError: 'stack trace',
    } as const;

    for (const [key, value] of Object.entries(forbiddenValues)) {
      expect(assignConversationSegment([], {
        ...assignCommand(),
        [key]: value,
      })).toEqual({ kind: 'blocked', code: 'invalid_command' });
    }

    const commandWithSymbol = assignCommand() as ReturnType<typeof assignCommand> & Record<symbol, string>;
    commandWithSymbol[Symbol('message')] = 'hidden text';
    expect(assignConversationSegment([], commandWithSymbol)).toEqual({
      kind: 'blocked',
      code: 'invalid_command',
    });

    const commandWithAccessor = { ...assignCommand() };
    let accessorReadCount = 0;
    Object.defineProperty(commandWithAccessor, 'actorUserId', {
      enumerable: true,
      configurable: true,
      get: () => {
        accessorReadCount += 1;
        Object.defineProperty(commandWithAccessor, 'actorUserId', {
          enumerable: true,
          value: userId(1),
        });
        return userId(1);
      },
    });
    expect(assignConversationSegment([], commandWithAccessor)).toEqual({
      kind: 'blocked',
      code: 'invalid_command',
    });
    expect(accessorReadCount).toBe(0);

    let nestedAccessorReadCount = 0;
    const nestedAccessor = {};
    Object.defineProperty(nestedAccessor, 'value', {
      enumerable: true,
      get: () => {
        nestedAccessorReadCount += 1;
        return userId(1);
      },
    });
    expect(assignConversationSegment([], {
      ...assignCommand(),
      actorUserId: nestedAccessor,
    })).toEqual({ kind: 'blocked', code: 'invalid_command' });
    expect(nestedAccessorReadCount).toBe(0);

    expect(assignConversationSegment([], new Proxy(assignCommand(), {}))).toEqual({
      kind: 'blocked',
      code: 'invalid_command',
    });
  });

  it.each([
    ['eventId', '138-0013-8000'],
    ['assignmentId', 'Alice-Smith'],
    ['tenantId', 'cancer-diagnosis'],
    ['institutionId', 'address-88-main-street'],
    ['conversationId', 'message-customer-needs-refund'],
    ['segmentId', 'phone-13900139000'],
    ['actorUserId', 'patient-john-doe'],
    ['assigneeUserId', 'patient-13800138000'],
    ['idempotencyKey', 'phone-13800138000-idempotency'],
  ] as const)('允许字段 %s 也只接受字段级 opaque reference', (field, value) => {
    expect(assignConversationSegment([], {
      ...assignCommand(),
      [field]: value,
    })).toEqual({ kind: 'blocked', code: 'invalid_identifier' });
  });

  it('Proxy history、Proxy fact 和数组 accessor 均不能绕过历史检查', () => {
    const history = assignedHistory();
    expect(projectConversationAssignments(new Proxy([...history], {}), target)).toEqual({
      kind: 'blocked',
      code: 'invalid_assignment_history',
    });
    expect(projectConversationAssignments([new Proxy({ ...history[0]! }, {})], target)).toEqual({
      kind: 'blocked',
      code: 'invalid_assignment_history',
    });
    const accessorHistory: unknown[] = [];
    Object.defineProperty(accessorHistory, '0', {
      enumerable: true,
      configurable: true,
      get: () => history[0],
    });
    accessorHistory.length = 1;
    expect(projectConversationAssignments(accessorHistory, target)).toEqual({
      kind: 'blocked',
      code: 'invalid_assignment_history',
    });

    let factAccessorReadCount = 0;
    const factWithAccessor = { ...history[0]! };
    Object.defineProperty(factWithAccessor, 'actorUserId', {
      enumerable: true,
      configurable: true,
      get: () => {
        factAccessorReadCount += 1;
        Object.defineProperty(factWithAccessor, 'actorUserId', {
          enumerable: true,
          value: userId(1),
        });
        return userId(1);
      },
    });
    expect(projectConversationAssignments([factWithAccessor], target)).toEqual({
      kind: 'blocked',
      code: 'invalid_assignment_history',
    });
    expect(factAccessorReadCount).toBe(0);

    let nestedFactAccessorReadCount = 0;
    const nestedFactAccessor = {};
    Object.defineProperty(nestedFactAccessor, 'value', {
      enumerable: true,
      get: () => {
        nestedFactAccessorReadCount += 1;
        return userId(1);
      },
    });
    expect(projectConversationAssignments([{
      ...history[0]!,
      actorUserId: nestedFactAccessor,
    }], target)).toEqual({ kind: 'blocked', code: 'invalid_assignment_history' });
    expect(nestedFactAccessorReadCount).toBe(0);
  });

  it('成功事实和投影仅含低敏白名单，不生成 R4/消息/provider 字段', () => {
    const result = success(assignConversationSegment([], assignCommand()));
    expect(Object.keys(result.history[0]!).sort()).toEqual([
      'actorRole',
      'actorUserId',
      'assigneeRole',
      'assigneeUserId',
      'assignmentId',
      'conversationId',
      'eventId',
      'idempotencyKey',
      'institutionId',
      'occurredAt',
      'reasonCode',
      'revision',
      'segmentId',
      'sourceSegmentState',
      'status',
      'tenantId',
    ]);
    expect(Object.keys(result.projection).sort()).toEqual([
      'activeAssignmentCount',
      'assigneeId',
      'assigneeRole',
      'assignmentId',
      'assignmentStatus',
      'conversationId',
      'institutionId',
      'revision',
      'segmentId',
      'tenantId',
    ]);

    const serialized = JSON.stringify(result);
    for (const forbiddenKey of [
      'displayName',
      'subject',
      'safeSummary',
      'messageBody',
      'providerPayload',
      'credential',
      'production',
      'sourceVersion',
      'readiness',
      'freshness',
      'detailHref',
    ]) {
      expect(serialized).not.toContain(forbiddenKey);
    }
  });

  it('阻断只返回受控 kind/code，不泄露 scope、assignee 或对象存在性', () => {
    const failure = acceptConversationAssignment(assignedHistory(), decisionCommand({
      actorUserId: userId(5),
    }));
    expect(failure).toEqual({ kind: 'blocked', code: 'actor_not_assignee' });
    expect(Object.keys(failure).sort()).toEqual(['code', 'kind']);
    expect(JSON.stringify(failure)).not.toContain(userId(2));
    expect(Object.isFrozen(failure)).toBe(true);

    for (const decide of [
      acceptConversationAssignment,
      rejectConversationAssignment,
      releaseConversationAssignment,
    ]) {
      const emptyFailure = decide([], decisionCommand({
        expectedRevision: 0,
        sourceSegmentState: 'human_handling',
      }));
      const wrongActorFailure = decide(
        decide === releaseConversationAssignment ? acceptedHistory() : assignedHistory(),
        decisionCommand({
          eventId: eventId(20),
          expectedRevision: decide === releaseConversationAssignment ? 2 : 1,
          idempotencyKey: idempotencyKey(20),
          actorUserId: userId(5),
          sourceSegmentState: decide === releaseConversationAssignment
            ? 'human_handling'
            : 'awaiting_human',
          occurredAt: '2026-07-17T01:02:00.000Z',
        }),
      );
      const wrongAssignmentFailure = decide(
        decide === releaseConversationAssignment ? acceptedHistory() : assignedHistory(),
        decisionCommand({
          eventId: eventId(21),
          assignmentId: assignmentId(99),
          expectedRevision: decide === releaseConversationAssignment ? 2 : 1,
          idempotencyKey: idempotencyKey(21),
          sourceSegmentState: decide === releaseConversationAssignment
            ? 'human_handling'
            : 'awaiting_human',
          occurredAt: '2026-07-17T01:02:00.000Z',
        }),
      );
      expect(emptyFailure).toEqual({ kind: 'blocked', code: 'actor_not_assignee' });
      expect(wrongActorFailure).toEqual(emptyFailure);
      expect(wrongAssignmentFailure).toEqual(emptyFailure);
    }
  });

  it('非法 history 无法通过 mutation 修复，输入数组及事实保持不变', () => {
    const base = assignedHistory()[0]!;
    const corrupted = [
      { ...base },
      {
        ...base,
        eventId: eventId(99),
        assignmentId: assignmentId(99),
        revision: 2,
        idempotencyKey: idempotencyKey(99),
      },
    ];
    const before = structuredClone(corrupted);
    expect(assignConversationSegment(corrupted, assignCommand({
      eventId: eventId(100),
      assignmentId: assignmentId(100),
      expectedRevision: 2,
      idempotencyKey: idempotencyKey(100),
    }))).toEqual({ kind: 'blocked', code: 'invalid_assignment_history' });
    expect(corrupted).toEqual(before);
    expect(Object.isFrozen(corrupted)).toBe(false);
    expect(Object.isFrozen(corrupted[0])).toBe(false);
  });
});
