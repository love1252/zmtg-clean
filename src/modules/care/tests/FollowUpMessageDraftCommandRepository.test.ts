import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createFollowUpMessageDraftCommandRepository } from '@/modules/care/server/follow-up-message-draft-command-repository';
import type { TenantDatabase } from '@/server/db/client';
import { customers, followUpCustomerTimelineEvents, followUpMessageDrafts, followUpTasks } from '@/server/db/schema';

const taskRow = {
  id: 'task-a', tenantId: 'tenant-a', institutionId: 'inst-a', customerId: 'customer-a', customerDisplayName: '低敏客户',
  journeyId: 'journey-a', stage: 'D1', status: 'due' as const, dueAt: new Date('2026-08-11T00:00:00.000Z'),
  suggestedAction: '人工确认', riskLevel: 'normal' as const, sourceTreatmentSummaryId: null, sourceSuggestionKey: null,
  updatedBy: null, updatedAt: null, createdAt: new Date('2026-08-09T00:00:00.000Z'),
};
const customerRow = { id: 'customer-a' };
const draftRow = {
  id: 'draft-a', tenantId: 'tenant-a', institutionId: 'inst-a', followUpTaskId: 'task-a', enrollmentId: null, stageId: null,
  customerId: 'customer-a', templateId: null, channelType: 'manual' as const, status: 'draft' as const,
  draftContent: '低敏草稿', editedContent: null, safePreview: '低敏草稿', approvedBy: null, approvedAt: null,
  rejectedBy: null, rejectedAt: null, markedSentBy: null, markedSentAt: null, safeReasonCode: 'fallback_generated' as const,
  metadataJson: { forbidAutoSend: true }, createdAt: new Date('2026-08-10T00:00:00.000Z'), updatedAt: new Date('2026-08-10T00:00:00.000Z'),
};

function thenable<T>(rows: T[], onFor?: () => void) {
  return {
    for: vi.fn(async () => { onFor?.(); return rows; }),
    then(resolve: (value: T[]) => unknown, reject: (reason: unknown) => unknown) {
      return Promise.resolve(rows).then(resolve, reject);
    },
  };
}

function database(input: { existingDrafts?: typeof draftRow[]; timelineInsert?: boolean } = {}) {
  const operations: string[] = [];
  const rowsFor = (table: unknown) => {
    if (table === followUpTasks) return [taskRow];
    if (table === customers) return [customerRow];
    if (table === followUpMessageDrafts) return input.existingDrafts ?? [];
    if (table === followUpCustomerTimelineEvents) return [];
    return [];
  };
  const select = vi.fn(() => ({
    from: (table: unknown) => ({
      where: () => {
        operations.push(table === followUpTasks ? 'select:task' : table === followUpMessageDrafts ? 'select:draft' : table === followUpCustomerTimelineEvents ? 'select:timeline' : 'select:other');
        return thenable(rowsFor(table), table === followUpTasks ? () => operations.push('lock:task') : undefined);
      },
    }),
  }));
  const insert = vi.fn((table: unknown) => ({
    values: (values: Record<string, unknown>) => {
      if (table === followUpMessageDrafts) {
        operations.push('insert:draft');
        return { returning: vi.fn(async () => [{ ...draftRow, ...values }]) };
      }
      operations.push('insert:timeline');
      return {
        onConflictDoNothing: () => ({
          returning: vi.fn(async () => input.timelineInsert === false ? [] : [{ id: 'timeline-a' }]),
        }),
      };
    },
  }));
  return { db: { select, insert } as unknown as TenantDatabase, operations };
}

const createInput = {
  tenantId: 'tenant-a', institutionId: 'inst-a', actorRole: 'tenant_admin',
  draft: {
    id: 'draft-a', followUpTaskId: 'task-a', enrollmentId: null, stageId: null, customerId: 'customer-a', templateId: null,
    channelType: 'manual' as const, status: 'draft' as const, draftContent: '低敏草稿', editedContent: null, safePreview: '低敏草稿',
    approvedBy: null, approvedAt: null, rejectedBy: null, rejectedAt: null, markedSentBy: null, markedSentAt: null,
    safeReasonCode: 'fallback_generated' as const, metadataJson: { forbidAutoSend: true },
    createdAt: '2026-08-10T00:00:00.000Z', updatedAt: '2026-08-10T00:00:00.000Z',
  },
};

describe('Care follow-up message draft command repository', () => {
  it('locks scoped follow-up task before active draft check and insert', async () => {
    const state = database();
    const result = await createFollowUpMessageDraftCommandRepository(state.db).createDraftWithTimeline(createInput);
    expect(result.kind).toBe('created');
    expect(state.operations.indexOf('lock:task')).toBeGreaterThan(-1);
    expect(state.operations.indexOf('lock:task')).toBeLessThan(state.operations.indexOf('select:draft'));
    expect(state.operations.indexOf('select:draft')).toBeLessThan(state.operations.indexOf('insert:draft'));
    expect(state.operations.indexOf('insert:draft')).toBeLessThan(state.operations.indexOf('insert:timeline'));
  });

  it('active draft conflict occurs before insert', async () => {
    const state = database({ existingDrafts: [draftRow] });
    const result = await createFollowUpMessageDraftCommandRepository(state.db).createDraftWithTimeline(createInput);
    expect(result).toEqual({ kind: 'conflict', resourceId: 'draft-a', reason: 'follow_up_message_draft_exists' });
    expect(state.operations).not.toContain('insert:draft');
  });

  it('source contains strict scope, expectedUpdatedAt and metadata CAS guards for C2-C6', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/modules/care/server/follow-up-message-draft-command-repository.ts'), 'utf8');
    expect(source).toContain("eq(followUpMessageDrafts.institutionId, input.institutionId)");
    expect(source.match(/eq\(followUpMessageDrafts\.updatedAt, new Date\(input\.expectedUpdatedAt\)\)/g)?.length).toBeGreaterThanOrEqual(5);
    expect(source).toContain("eq(followUpMessageDrafts.status, 'approved')");
    expect(source).toContain('eq(followUpMessageDrafts.metadataJson, input.expectedMetadataJson)');
    expect(source).toContain(".for('update')");
  });

  it('required lifecycle timeline failure aborts the write bundle', async () => {
    const state = database({ timelineInsert: false });
    await expect(createFollowUpMessageDraftCommandRepository(state.db).createDraftWithTimeline(createInput))
      .rejects.toThrow('required_timeline_evidence_failed');
  });
});
