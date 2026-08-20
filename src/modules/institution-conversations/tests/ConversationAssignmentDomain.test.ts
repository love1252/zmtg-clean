import { describe, expect, it } from 'vitest';
import {
  acceptConversationAssignment,
  assignConversationSegment,
  conversationAssignmentActorRoles,
  conversationAssignmentReasonCodes,
  conversationAssignmentStatuses,
  fallbackConversationSegment,
  projectConversationAssignments,
  reassignConversationSegment,
  rejectConversationAssignment,
  releaseConversationAssignment,
  type ConversationAssignmentHistory,
  type ConversationAssignmentMutationResult,
  type ConversationAssignmentProjection,
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

const assignedHistory = (
  overrides: Record<string, unknown> = {},
): ConversationAssignmentHistory => success(assignConversationSegment([], assignCommand(overrides))).history;

const acceptedHistory = (): ConversationAssignmentHistory => success(acceptConversationAssignment(
  assignedHistory(),
  decisionCommand(),
)).history;

const projection = (history: ConversationAssignmentHistory): ConversationAssignmentProjection => {
  const result = projectConversationAssignments(history, target);
  expect(result.kind).toBe('projected');
  if (result.kind !== 'projected') {
    throw new Error(`expected assignment projection, received ${result.code}`);
  }
  return result.projection;
};

describe('conversation assignment domain', () => {
  it('冻结四状态、五个 reasonCode 和四个稳定角色代码', () => {
    expect(conversationAssignmentStatuses).toEqual([
      'assigned',
      'accepted',
      'rejected',
      'released',
    ]);
    expect(conversationAssignmentReasonCodes).toEqual([
      'manual_assign',
      'manual_reassign',
      'manual_fallback',
      'assignee_reject',
      'handler_release',
    ]);
    expect(conversationAssignmentActorRoles).toEqual([
      'tenant_admin',
      'tenant_operator',
      'consultant',
      'customer_service',
    ]);
    expect(Object.isFrozen(conversationAssignmentStatuses)).toBe(true);
    expect(Object.isFrozen(conversationAssignmentReasonCodes)).toBe(true);
    expect(Object.isFrozen(conversationAssignmentActorRoles)).toBe(true);
  });

  it.each([
    ['tenant_admin', userId(1)],
    ['tenant_operator', userId(3)],
  ] as const)('%s 可追加 manual_assign 事实', (actorRole, actorUserId) => {
    const result = success(assignConversationSegment([], assignCommand({
      actorRole,
      actorUserId,
    })));
    expect(result.kind).toBe('applied');
    expect(result.history).toHaveLength(1);
    expect(result.history[0]).toMatchObject({
      revision: 1,
      status: 'assigned',
      reasonCode: 'manual_assign',
      actorRole,
      assigneeUserId: userId(2),
    });
    expect(result.projection).toMatchObject({
      activeAssignmentCount: 1,
      assigneeId: userId(2),
    });
  });

  it('人工 fallback 是独立的受控来源，不实现自动路由', () => {
    const result = success(fallbackConversationSegment([], assignCommand({
      idempotencyKey: idempotencyKey(20),
    })));
    expect(result.operationFacts).toHaveLength(1);
    expect(result.operationFacts[0]).toMatchObject({
      status: 'assigned',
      reasonCode: 'manual_fallback',
    });
  });

  it('目标 assignee 按 assigned → accepted → released 追加，accepted 继承来源 reason', () => {
    const assigned = assignedHistory();
    const accepted = success(acceptConversationAssignment(assigned, decisionCommand()));
    expect(accepted.history.map((fact) => [fact.revision, fact.status, fact.reasonCode])).toEqual([
      [1, 'assigned', 'manual_assign'],
      [2, 'accepted', 'manual_assign'],
    ]);
    expect(accepted.projection).toMatchObject({
      revision: 2,
      assignmentStatus: 'accepted',
      activeAssignmentCount: 1,
      assigneeId: userId(2),
    });

    const released = success(releaseConversationAssignment(accepted.history, decisionCommand({
      eventId: eventId(3),
      expectedRevision: 2,
      idempotencyKey: idempotencyKey(3),
      sourceSegmentState: 'human_handling',
      occurredAt: '2026-07-17T01:02:00.000Z',
    })));
    expect(released.history.at(-1)).toMatchObject({
      revision: 3,
      status: 'released',
      reasonCode: 'handler_release',
    });
    expect(released.projection).toMatchObject({
      activeAssignmentCount: 0,
      assigneeId: null,
    });
  });

  it('目标 assignee 可拒绝，随后管理员使用新 assignmentId 再分配', () => {
    const rejected = success(rejectConversationAssignment(
      assignedHistory(),
      decisionCommand(),
    ));
    expect(rejected.history.at(-1)).toMatchObject({
      status: 'rejected',
      reasonCode: 'assignee_reject',
    });
    expect(rejected.projection.activeAssignmentCount).toBe(0);

    const reassignedAfterReject = success(assignConversationSegment(rejected.history, assignCommand({
      eventId: eventId(3),
      assignmentId: assignmentId(2),
      expectedRevision: 2,
      idempotencyKey: idempotencyKey(3),
      assigneeUserId: userId(4),
      assigneeRole: 'customer_service',
      occurredAt: '2026-07-17T01:02:00.000Z',
    })));
    expect(reassignedAfterReject.projection).toMatchObject({
      revision: 3,
      assignmentId: assignmentId(2),
      assignmentStatus: 'assigned',
      activeAssignmentCount: 1,
      assigneeId: userId(4),
    });
  });

  it('待接管改派原子追加 released + assigned 两条连续事实', () => {
    const history = assignedHistory();
    const before = structuredClone(history);
    const result = success(reassignConversationSegment(history, reassignCommand()));
    expect(result.operationFacts.map((fact) => ({
      revision: fact.revision,
      assignmentId: fact.assignmentId,
      status: fact.status,
      reasonCode: fact.reasonCode,
      idempotencyKey: fact.idempotencyKey,
    }))).toEqual([
      {
        revision: 2,
        assignmentId: assignmentId(1),
        status: 'released',
        reasonCode: 'manual_reassign',
        idempotencyKey: idempotencyKey(10),
      },
      {
        revision: 3,
        assignmentId: assignmentId(2),
        status: 'assigned',
        reasonCode: 'manual_reassign',
        idempotencyKey: idempotencyKey(10),
      },
    ]);
    expect(result.projection).toMatchObject({
      revision: 3,
      assignmentId: assignmentId(2),
      assigneeRole: 'customer_service',
      activeAssignmentCount: 1,
      assigneeId: userId(4),
    });
    expect(history).toEqual(before);
  });

  it.each(['consultant', 'customer_service'] as const)(
    '%s 不得分配、fallback 或改派',
    (actorRole) => {
      const actorUserId = actorRole === 'consultant'
        ? userId(2)
        : userId(4);
      expect(assignConversationSegment([], assignCommand({ actorRole, actorUserId }))).toEqual({
        kind: 'blocked',
        code: 'actor_role_not_allowed',
      });
      expect(fallbackConversationSegment([], assignCommand({ actorRole, actorUserId }))).toEqual({
        kind: 'blocked',
        code: 'actor_role_not_allowed',
      });
      expect(reassignConversationSegment(assignedHistory(), reassignCommand({
        actorRole,
        actorUserId,
      }))).toEqual({ kind: 'blocked', code: 'actor_role_not_allowed' });
    },
  );

  it('assignment 所有权绑定账号身份，Membership 角色变化后仍可接受、拒绝和释放', () => {
    const assigned = assignedHistory();

    const accepted = success(acceptConversationAssignment(
      assigned,
      decisionCommand({ actorRole: 'customer_service' }),
    ));
    expect(accepted.history.at(-1)).toMatchObject({
      status: 'accepted',
      assigneeUserId: userId(2),
      assigneeRole: 'consultant',
      actorUserId: userId(2),
      actorRole: 'customer_service',
    });

    const rejected = success(rejectConversationAssignment(
      assigned,
      decisionCommand({ actorRole: 'customer_service' }),
    ));
    expect(rejected.history.at(-1)).toMatchObject({
      status: 'rejected',
      assigneeUserId: userId(2),
      assigneeRole: 'consultant',
      actorUserId: userId(2),
      actorRole: 'customer_service',
    });

    const released = success(releaseConversationAssignment(
      accepted.history,
      decisionCommand({
        eventId: eventId(3),
        expectedRevision: 2,
        idempotencyKey: idempotencyKey(21),
        actorRole: 'tenant_operator',
        sourceSegmentState: 'human_handling',
        occurredAt: '2026-07-17T01:02:00.000Z',
      }),
    ));
    expect(released.history.at(-1)).toMatchObject({
      status: 'released',
      assigneeUserId: userId(2),
      assigneeRole: 'consultant',
      actorUserId: userId(2),
      actorRole: 'tenant_operator',
      reasonCode: 'handler_release',
    });
    expect(released.projection.activeAssignmentCount).toBe(0);
  });

  it('同一 assignment decision 在角色变化后仍按账号身份幂等重放', () => {
    const first = success(acceptConversationAssignment(
      assignedHistory(),
      decisionCommand({ actorRole: 'customer_service' }),
    ));
    const replayed = success(acceptConversationAssignment(
      first.history,
      decisionCommand({ actorRole: 'tenant_operator' }),
    ));

    expect(replayed.kind).toBe('replayed');
    expect(replayed.history).toEqual(first.history);
    expect(replayed.operationFacts).toEqual(first.operationFacts);
    expect(replayed.projection).toEqual(first.projection);
  });

  it('不同账号或 assignmentId 仍不能接受、拒绝或释放', () => {
    const history = assignedHistory();
    for (const overrides of [
      { actorUserId: userId(5) },
      { assignmentId: assignmentId(99) },
    ]) {
      expect(acceptConversationAssignment(history, decisionCommand(overrides))).toEqual({
        kind: 'blocked',
        code: 'actor_not_assignee',
      });
      expect(rejectConversationAssignment(history, decisionCommand(overrides))).toEqual({
        kind: 'blocked',
        code: 'actor_not_assignee',
      });
    }

    expect(releaseConversationAssignment(acceptedHistory(), decisionCommand({
      eventId: eventId(3),
      expectedRevision: 2,
      idempotencyKey: idempotencyKey(21),
      actorUserId: userId(1),
      actorRole: 'tenant_admin',
      sourceSegmentState: 'human_handling',
      occurredAt: '2026-07-17T01:02:00.000Z',
    }))).toEqual({ kind: 'blocked', code: 'actor_not_assignee' });
  });

  it('状态守卫拒绝非 awaiting_human、重复决定和未接受 release', () => {
    expect(assignConversationSegment([], assignCommand({
      sourceSegmentState: 'ai_handling',
    }))).toEqual({ kind: 'blocked', code: 'transition_not_allowed' });
    expect(acceptConversationAssignment(assignedHistory(), decisionCommand({
      sourceSegmentState: 'closed',
    }))).toEqual({ kind: 'blocked', code: 'transition_not_allowed' });
    expect(rejectConversationAssignment(acceptedHistory(), decisionCommand({
      eventId: eventId(3),
      expectedRevision: 2,
      idempotencyKey: idempotencyKey(22),
      occurredAt: '2026-07-17T01:02:00.000Z',
    }))).toEqual({ kind: 'blocked', code: 'transition_not_allowed' });
    expect(releaseConversationAssignment(assignedHistory(), decisionCommand({
      sourceSegmentState: 'human_handling',
    }))).toEqual({ kind: 'blocked', code: 'transition_not_allowed' });
  });

  it('已 accepted 不得直接改派；handler release 回到人工队列后允许管理员重新分配', () => {
    expect(reassignConversationSegment(acceptedHistory(), reassignCommand({
      expectedRevision: 2,
    }))).toEqual({ kind: 'blocked', code: 'transition_not_allowed' });

    const released = success(releaseConversationAssignment(acceptedHistory(), decisionCommand({
      eventId: eventId(3),
      expectedRevision: 2,
      idempotencyKey: idempotencyKey(3),
      sourceSegmentState: 'waiting_customer',
      occurredAt: '2026-07-17T01:02:00.000Z',
    }))).history;
    const assignedAgain = success(assignConversationSegment(released, assignCommand({
      eventId: eventId(4),
      assignmentId: assignmentId(2),
      expectedRevision: 3,
      idempotencyKey: idempotencyKey(4),
      assigneeUserId: userId(4),
      assigneeRole: 'customer_service',
      occurredAt: '2026-07-17T01:03:00.000Z',
    })));
    expect(assignedAgain.projection).toMatchObject({
      revision: 4,
      assignmentId: assignmentId(2),
      assignmentStatus: 'assigned',
      activeAssignmentCount: 1,
      assigneeId: userId(4),
    });
  });

  it('改派拒绝相同 assignee、复用 assignmentId 或重复 eventId', () => {
    const history = assignedHistory();
    expect(reassignConversationSegment(history, reassignCommand({
      newAssigneeUserId: userId(2),
    }))).toEqual({ kind: 'blocked', code: 'assignee_unchanged' });
    expect(reassignConversationSegment(history, reassignCommand({
      newAssignmentId: assignmentId(1),
    }))).toEqual({ kind: 'blocked', code: 'assignment_id_conflict' });
    expect(reassignConversationSegment(history, reassignCommand({
      releaseEventId: eventId(1),
    }))).toEqual({ kind: 'blocked', code: 'event_id_conflict' });
    expect(reassignConversationSegment(history, reassignCommand({
      assignedEventId: eventId(10),
    }))).toEqual({ kind: 'blocked', code: 'event_id_conflict' });
  });

  it('每个命令绑定 expectedRevision，拒绝 stale、future 和非安全整数', () => {
    const history = assignedHistory();
    expect(acceptConversationAssignment(history, decisionCommand({ expectedRevision: 0 }))).toEqual({
      kind: 'blocked',
      code: 'revision_conflict',
    });
    expect(acceptConversationAssignment(history, decisionCommand({ expectedRevision: 2 }))).toEqual({
      kind: 'blocked',
      code: 'revision_conflict',
    });
    for (const expectedRevision of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(acceptConversationAssignment(history, decisionCommand({ expectedRevision }))).toEqual({
        kind: 'blocked',
        code: 'invalid_command',
      });
    }
  });

  it('同 scope 同幂等键同载荷复用，异载荷或跨操作 fail-closed', () => {
    const command = assignCommand();
    const first = success(assignConversationSegment([], command));
    const replayed = success(assignConversationSegment(first.history, command));
    expect(replayed.kind).toBe('replayed');
    expect(replayed.history).toHaveLength(1);
    expect(replayed.operationFacts).toEqual(first.operationFacts);

    expect(assignConversationSegment(first.history, {
      ...command,
      assigneeUserId: userId(5),
    })).toEqual({ kind: 'blocked', code: 'idempotency_conflict' });
    expect(fallbackConversationSegment(first.history, command)).toEqual({
      kind: 'blocked',
      code: 'idempotency_conflict',
    });
  });

  it('幂等重放先于 revision/状态判断，并返回当前完整投影', () => {
    const assign = assignCommand();
    const assigned = success(assignConversationSegment([], assign));
    const accepted = success(acceptConversationAssignment(assigned.history, decisionCommand()));

    const replayedAssign = success(assignConversationSegment(accepted.history, assign));
    expect(replayedAssign.kind).toBe('replayed');
    expect(replayedAssign.history).toHaveLength(2);
    expect(replayedAssign.projection.assignmentStatus).toBe('accepted');

    const reassign = reassignCommand();
    const reassigned = success(reassignConversationSegment(assigned.history, reassign));
    const acceptedNew = success(acceptConversationAssignment(reassigned.history, decisionCommand({
      eventId: eventId(12),
      assignmentId: assignmentId(2),
      expectedRevision: 3,
      idempotencyKey: idempotencyKey(12),
      actorUserId: userId(4),
      actorRole: 'customer_service',
      occurredAt: '2026-07-17T01:03:00.000Z',
    })));
    const replayedReassign = success(reassignConversationSegment(acceptedNew.history, reassign));
    expect(replayedReassign.kind).toBe('replayed');
    expect(replayedReassign.operationFacts).toHaveLength(2);
    expect(replayedReassign.projection.assignmentStatus).toBe('accepted');
  });

  it('reject 与 release 同样支持整条命令重放，并拒绝同 key 异载荷', () => {
    const rejectCommand = decisionCommand();
    const rejected = success(rejectConversationAssignment(assignedHistory(), rejectCommand));
    expect(success(rejectConversationAssignment(rejected.history, rejectCommand)).kind).toBe('replayed');
    expect(rejectConversationAssignment(rejected.history, {
      ...rejectCommand,
      occurredAt: '2026-07-17T01:01:00.001Z',
    })).toEqual({ kind: 'blocked', code: 'idempotency_conflict' });

    const releaseCommand = decisionCommand({
      eventId: eventId(3),
      expectedRevision: 2,
      idempotencyKey: idempotencyKey(3),
      sourceSegmentState: 'human_handling',
      occurredAt: '2026-07-17T01:02:00.000Z',
    });
    const released = success(releaseConversationAssignment(acceptedHistory(), releaseCommand));
    expect(success(releaseConversationAssignment(released.history, releaseCommand)).kind).toBe('replayed');
    expect(releaseConversationAssignment(released.history, {
      ...releaseCommand,
      sourceSegmentState: 'waiting_customer',
    })).toEqual({ kind: 'blocked', code: 'idempotency_conflict' });
  });

  it('manual_fallback 的 accept 继承来源 reason，并支持同载荷重放', () => {
    const fallback = success(fallbackConversationSegment([], assignCommand({
      idempotencyKey: idempotencyKey(20),
    })));
    const acceptCommand = decisionCommand();
    const accepted = success(acceptConversationAssignment(fallback.history, acceptCommand));
    expect(accepted.history.at(-1)).toMatchObject({
      status: 'accepted',
      reasonCode: 'manual_fallback',
    });
    expect(success(acceptConversationAssignment(accepted.history, acceptCommand)).kind).toBe('replayed');
    expect(acceptConversationAssignment(accepted.history, {
      ...acceptCommand,
      occurredAt: '2026-07-17T01:01:00.001Z',
    })).toEqual({ kind: 'blocked', code: 'idempotency_conflict' });
  });

  it('终态 assignmentId 不得复用，新一轮分配必须使用新 opaque reference', () => {
    const rejected = success(rejectConversationAssignment(
      assignedHistory(),
      decisionCommand(),
    )).history;
    expect(assignConversationSegment(rejected, assignCommand({
      eventId: eventId(3),
      expectedRevision: 2,
      idempotencyKey: idempotencyKey(3),
      occurredAt: '2026-07-17T01:02:00.000Z',
    }))).toEqual({ kind: 'blocked', code: 'assignment_id_conflict' });
  });

  it('时间只接受 canonical UTC 毫秒格式且不得早于上一事实', () => {
    for (const occurredAt of [
      '2026-07-17T01:00:00',
      '2026-07-17T01:00:00.000',
      '2026-02-30T01:00:00.000Z',
    ]) {
      expect(assignConversationSegment([], assignCommand({ occurredAt }))).toEqual({
        kind: 'blocked',
        code: 'invalid_timestamp',
      });
    }
    expect(acceptConversationAssignment(assignedHistory(), decisionCommand({
      occurredAt: '2026-07-17T00:59:59.999Z',
    }))).toEqual({ kind: 'blocked', code: 'invalid_timestamp' });
  });

  it('成功、重放和阻断均不修改输入；所有返回层级深冻结', () => {
    const command = assignCommand();
    const commandBefore = structuredClone(command);
    const rawHistory: ConversationAssignmentHistory = [];
    const result = success(assignConversationSegment(rawHistory, command));

    expect(command).toEqual(commandBefore);
    expect(rawHistory).toEqual([]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.history)).toBe(true);
    expect(Object.isFrozen(result.history[0])).toBe(true);
    expect(Object.isFrozen(result.operationFacts)).toBe(true);
    expect(Object.isFrozen(result.operationFacts[0])).toBe(true);
    expect(Object.isFrozen(result.projection)).toBe(true);

    const replay = success(assignConversationSegment(result.history, command));
    expect(Object.isFrozen(replay)).toBe(true);
    expect(Object.isFrozen(replay.history)).toBe(true);
    expect(Object.isFrozen(replay.operationFacts)).toBe(true);

    const failure = assignConversationSegment([], assignCommand({ actorRole: 'consultant' }));
    expect(Object.isFrozen(failure)).toBe(true);
  });

  it('投影不会修改或冻结调用方历史', () => {
    const history = assignedHistory().map((fact) => ({ ...fact }));
    const before = structuredClone(history);
    const result = projectConversationAssignments(history, target);
    expect(result.kind).toBe('projected');
    expect(history).toEqual(before);
    expect(Object.isFrozen(history)).toBe(false);
    expect(Object.isFrozen(history[0])).toBe(false);
    if (result.kind === 'projected') {
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.projection)).toBe(true);
    }
  });

  it('稳定投影不依赖输入对象引用或时间排序修复', () => {
    const history = assignedHistory();
    const first = projection(history);
    const second = projection(structuredClone(history));
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });
});
