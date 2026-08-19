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

});
