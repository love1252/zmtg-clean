import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { resolveInstitutionCapabilityOffRouteV1 } from '@/modules/institution/components/InstitutionCapabilityOffPage';

describe('Conversation controlled-write independent review regressions', () => {
  it('reserved automations namespace remains physical capability-off and cannot become conversationId', () => {
    const automationsPath = resolve(
      process.cwd(),
      'src/app/hospital/conversations/automations/page.tsx',
    );
    const automationDetailPath = resolve(
      process.cwd(),
      'src/app/hospital/conversations/automations/[journeyId]/page.tsx',
    );
    expect(existsSync(automationsPath)).toBe(true);
    expect(existsSync(automationDetailPath)).toBe(true);

    const automationsSource = readFileSync(automationsPath, 'utf8');
    const detailSource = readFileSync(automationDetailPath, 'utf8');
    expect(automationsSource).toContain('HospitalCapabilityOffRoute');
    expect(detailSource).toContain('HospitalCapabilityOffRoute');
    expect(`${automationsSource}\n${detailSource}`).not.toMatch(
      /institution-conversation-controlled-write-runtime|fetch\(|REAL_SEND|AUTO_REACHOUT/iu,
    );

    expect(
      resolveInstitutionCapabilityOffRouteV1(['conversations', 'automations'])?.routeId,
    ).toBe('conversation_automations');
    expect(
      resolveInstitutionCapabilityOffRouteV1([
        'conversations',
        'automations',
        'journey-001',
      ])?.routeId,
    ).toBe('conversation_automation_detail');
    expect(
      resolveInstitutionCapabilityOffRouteV1(['conversations', 'conversation-001'])?.routeId,
    ).toBe('conversation_detail');
  });

  it('post-ready review keeps audit attribution outside the single-connection transaction and replays before CAS', () => {
    const runtime = readFileSync(
      resolve(
        process.cwd(),
        'src/server/orchestration/institution-conversation-controlled-write-runtime.ts',
      ),
      'utf8',
    );
    const repository = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/institution-conversations/server/conversation-command-repository.ts',
      ),
      'utf8',
    );
    const dbClient = readFileSync(
      resolve(process.cwd(), 'src/server/db/client.ts'),
      'utf8',
    );

    expect(dbClient).toContain('max: 1');
    const attributionIndex = runtime.lastIndexOf(
      'await resolveInstitutionAuditWriterVerifiedAttributionV1({',
    );
    const transactionIndex = runtime.indexOf('return await database.transaction(');
    expect(attributionIndex).toBeGreaterThan(-1);
    expect(transactionIndex).toBeGreaterThan(attributionIndex);

    const auditChangedStart = runtime.indexOf('async function auditChanged(');
    const readStart = runtime.indexOf(
      'export async function readCurrentInstitutionConversationControlledV1',
    );
    expect(runtime.slice(auditChangedStart, readStart)).not.toContain(
      'resolveInstitutionAuditWriterVerifiedAttributionV1',
    );

    const replayIndex = repository.indexOf(
      'existingIdempotentRows.length > 0',
    );
    const revisionIndex = repository.indexOf(
      'root.revision !== input.expectedConversationRevision',
    );
    expect(replayIndex).toBeGreaterThan(-1);
    expect(revisionIndex).toBeGreaterThan(replayIndex);
    expect(repository).toContain("kind: 'applied' | 'replayed'");
    expect(runtime).toContain("if (result.kind === 'applied')");
  });

  it('zero-risk normal close requires server-owned completeness and request identity binds segmentId', () => {
    const repository = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/institution-conversations/server/conversation-command-repository.ts',
      ),
      'utf8',
    );
    const segmentDomain = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/institution-conversations/domain/conversation-segments.ts',
      ),
      'utf8',
    );
    const detailPage = readFileSync(
      resolve(
        process.cwd(),
        'src/app/hospital/conversations/[conversationId]/page.tsx',
      ),
      'utf8',
    );

    expect(repository).toContain("completeness: 'authoritative_empty'");
    expect(repository).toContain('rows.length === 0');
    expect(repository).toContain('${segment.segmentId}');
    expect(segmentDomain).toContain("completeness?: 'authoritative_empty'");
    expect(segmentDomain).toContain("riskSet.completeness !== 'authoritative_empty'");
    expect(detailPage).toContain("'conversation-detail-placeholder'");
  });
  it('latest Codex review keeps replay before target Membership, close risk-aware, and release prose Chinese', () => {
    const runtime = readFileSync(resolve(process.cwd(), 'src/server/orchestration/institution-conversation-controlled-write-runtime.ts'), 'utf8');
    const repository = readFileSync(resolve(process.cwd(), 'src/modules/institution-conversations/server/conversation-command-repository.ts'), 'utf8');
    const releaseDoc = readFileSync(resolve(process.cwd(), 'docs/operations/seven-stream-conversations-controlled-write-release-20260819.md'), 'utf8');
    const detailShell = readFileSync(resolve(process.cwd(), 'src/modules/institution-conversations/components/ConversationControlledDetailShell.tsx'), 'utf8');

    const replayIndex = runtime.indexOf('await readConversationAssignmentReplayV1(database, {');
    const membershipIndex = runtime.indexOf('const assignee = await resolveCurrentAssignee(');
    expect(replayIndex).toBeGreaterThan(-1);
    expect(membershipIndex).toBeGreaterThan(replayIndex);
    expect(repository).toContain('hasRiskFacts?: boolean | null;');
    expect(repository).toContain('hasRiskFacts: !riskFree');
    expect(runtime).toContain('segment?.hasRiskFacts === false');
    expect(repository).toContain(
      'inArray(conversationAssignments.idempotencyKey, candidateKeys)',
    );
    expect(repository).toContain('historicalMatches.length > 1');
    const executeSource = repository.slice(
      repository.indexOf('export async function executeConversationCommandV1('),
    );
    expect(executeSource.indexOf("input.operation.kind === 'takeover'")).toBeGreaterThan(-1);
    expect(executeSource.indexOf('if (!root || !root.activeSegmentId)')).toBeGreaterThan(
      executeSource.indexOf("input.operation.kind === 'takeover'"),
    );
    expect(executeSource).toContain("'release_takeover'");
    expect(executeSource).toContain("'close'");
    expect(repository).toContain("'close-release'");
    expect(repository).toContain("'release-takeover'");
    expect(releaseDoc).toMatch(/^# 会话受控写完整闭环发布说明/mu);
    expect(releaseDoc).not.toContain('## Canonical write chain');
    expect(releaseDoc).not.toContain('## Released controlled mutations');
    expect(releaseDoc).not.toContain('## Hard boundaries');
    expect(releaseDoc).not.toContain('No new Conversation table');
    expect(detailShell).toContain('mutationErrorMessages');
    expect(detailShell).toContain('mutationErrorMessage(payload.code)');
    expect(detailShell).not.toContain('setMessage(payload.code');
    expect(detailShell).not.toContain('payload.code ??');
  });

  it('final Codex corrective locks own-assignment scope, state replay facts, and stable browser retries', () => {
    const runtime = readFileSync(
      resolve(process.cwd(), 'src/server/orchestration/institution-conversation-controlled-write-runtime.ts'),
      'utf8',
    );
    const auditRepository = readFileSync(
      resolve(process.cwd(), 'src/modules/audit/server/audit-event-repository.ts'),
      'utf8',
    );
    const detailShell = readFileSync(
      resolve(process.cwd(), 'src/modules/institution-conversations/components/ConversationControlledDetailShell.tsx'),
      'utf8',
    );

    expect(runtime).toContain('function recordInActorScope(');
    expect(runtime).toContain('!recordInActorScope(record, authorization.actor)');
    expect(runtime).toContain('!currentRecord || !recordInActorScope(currentRecord, actor)');
    expect(runtime).toContain(
      "operation.kind === 'request_human' && !isManagement(actor.role)",
    );
    expect(runtime).toContain(
      "canRequestHuman: isManagement(actor.role) && state === 'ai_handling'",
    );
    expect(runtime).toContain('conversationStateOperationAuditEventId(');
    expect(runtime).toContain('readConversationStateOperationReplayV1(');
    expect(runtime).toContain('readVerifiedInstitutionAuditEventById({');
    expect(runtime).toContain("'conversation-controlled-state-operation-v2'");
    expect(auditRepository).toContain('readVerifiedInstitutionAuditEventById(input: {');
    expect(auditRepository).toContain(
      "eq(auditEvents.institutionAttribution, 'verified')",
    );
    expect(detailShell).toContain('pendingMutationRequest');
    expect(detailShell).toContain('const stableRequestId = pending?.requestId ?? requestId();');
    expect(detailShell).toContain('body: request.body');
    expect(detailShell).toContain('操作结果尚未确认，请再次执行相同操作。');
  });


  it('latest replay review binds target versions and never returns an unchecked current assignment record', () => {
    const runtime = readFileSync(
      resolve(process.cwd(), 'src/server/orchestration/institution-conversation-controlled-write-runtime.ts'),
      'utf8',
    );
    const identityStart = runtime.indexOf('function conversationStateOperationAuditEventId(');
    const identityEnd = runtime.indexOf('type ConversationStateOperationReplayResultV1');
    expect(identityStart).toBeGreaterThan(-1);
    expect(identityEnd).toBeGreaterThan(identityStart);
    const identitySource = runtime.slice(identityStart, identityEnd);
    expect(identitySource).toContain("'conversation-controlled-state-operation-v2'");
    expect(identitySource).toContain('String(expectedConversationRevision)');
    expect(identitySource).toContain('String(expectedSegmentRevision)');
    expect(identitySource).toContain('String(expectedAssignmentRevision)');
    expect(runtime).toContain('function replayRecordVisibleToActor(');
    expect(runtime).toContain('function replayReadyMutationResult(');
    expect(runtime).toContain("operation.kind !== 'release_takeover' && operation.kind !== 'close'");
    expect(runtime).toContain('record.conversationRevision !== nextConversationRevision');
    expect(runtime).toContain('segment.revision !== nextSegmentRevision');
    expect(runtime).toContain('segment.assignmentRevision !== nextAssignmentRevision');
    expect(runtime).toContain('segment.assignment !== null');
    expect(runtime).toContain("segment.value.state === 'awaiting_human'");
    expect(runtime).toContain("segment.value.state === 'closed'");
    expect(runtime.match(/return replayReadyMutationResult\(/gu) ?? []).toHaveLength(3);
    expect(runtime).not.toContain('record: toDto(replay.record, actor)');
  });



  it('role-change review keeps active assignment ownership bound to account identity', () => {
    const assignmentDomain = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/institution-conversations/domain/conversation-assignments.ts',
      ),
      'utf8',
    );
    const repository = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/institution-conversations/server/conversation-command-repository.ts',
      ),
      'utf8',
    );

    expect(assignmentDomain).not.toContain(
      'active.assigneeRole !== command.actorRole',
    );
    expect(assignmentDomain).not.toContain(
      'fact.actorRole !== activeAssignment.assigneeRole',
    );
    expect(assignmentDomain).toContain(
      'fact.actorRole === command.actorRole',
    );
    expect(repository).not.toContain(
      'row.actorRole !== row.assigneeRole',
    );
    expect(repository).toContain(
      'row.actorUserId !== row.assigneeUserId',
    );
  });


  it('queue actionability remains fixed-query batch scoped', () => {
    const queueReader = readFileSync(
      resolve(process.cwd(), 'src/server/orchestration/institution-conversation-queue-reader.ts'),
      'utf8',
    );
    const repository = readFileSync(
      resolve(process.cwd(), 'src/modules/institution-conversations/server/conversation-command-repository.ts'),
      'utf8',
    );

    const queueStart = queueReader.indexOf(
      'export async function readCurrentInstitutionConversationQueueActionableIdsV1(',
    );
    const queueEnd = queueReader.indexOf(
      'export async function readCurrentInstitutionConversationQueueV1(',
      queueStart,
    );
    const queueSource = queueReader.slice(queueStart, queueEnd);
    expect(queueSource).toContain('readScopedConversationActionableIdsV1(getDatabase(), {');
    expect(queueSource).not.toContain('Promise.all(');
    expect(queueSource).not.toContain('readScopedConversationCommandRecordV1');

    const batchStart = repository.indexOf(
      'export async function readScopedConversationActionableIdsV1(',
    );
    const batchEnd = repository.indexOf('function serverOccurredAt(', batchStart);
    const batchSource = repository.slice(batchStart, batchEnd);
    expect(batchSource.match(/\.from\(/gu) ?? []).toHaveLength(2);
    expect(batchSource).toContain('.from(conversations)');
    expect(batchSource).toContain('.from(conversationAssignments)');
    expect(batchSource).not.toContain('.from(conversationSegments)');
    expect(batchSource).not.toContain('.from(conversationRisks)');
    expect(batchSource).toContain('projectConversationAssignments(');
    expect(batchSource).toContain('assignment.assigneeUserId === input.actorUserId');
  });

  it('management recovery reassign remains narrow and reuses existing V1 reassign', () => {
    const assignmentDomain = readFileSync(
      resolve(process.cwd(), 'src/modules/institution-conversations/domain/conversation-assignments.ts'),
      'utf8',
    );
    const segmentDomain = readFileSync(
      resolve(process.cwd(), 'src/modules/institution-conversations/domain/conversation-segments.ts'),
      'utf8',
    );
    const repository = readFileSync(
      resolve(process.cwd(), 'src/modules/institution-conversations/server/conversation-command-repository.ts'),
      'utf8',
    );
    const runtime = readFileSync(
      resolve(process.cwd(), 'src/server/orchestration/institution-conversation-controlled-write-runtime.ts'),
      'utf8',
    );

    expect(assignmentDomain).toContain("activeStatus === 'accepted'");
    expect(assignmentDomain).toContain("sourceSegmentState === 'human_handling'");
    expect(assignmentDomain).toContain("sourceSegmentState === 'waiting_customer'");
    expect(segmentDomain).toContain('export function recoverHumanHandlingForReassignment(');
    expect(repository).toContain('recoverHumanHandlingForReassignment(segment, {');
    expect(repository).toContain('released.sourceSegmentState === assigned.sourceSegmentState');
    expect(runtime).toContain("assignment?.status === 'accepted'");
    expect(runtime).toContain('assignment.assigneeUserId === segment?.value.currentHandlerId');
    expect(runtime).not.toContain("kind: 'force_reassign'");
    expect(runtime).not.toContain("kind: 'admin_release'");
  });

});
