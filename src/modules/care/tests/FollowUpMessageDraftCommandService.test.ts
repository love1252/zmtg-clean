import { describe, expect, it, vi } from 'vitest';
import {
  CareFollowUpMessageDraftCommandInputError,
  createFollowUpMessageDraftCommandService,
  type FollowUpMessageDraftCommandRepository,
} from '@/modules/care/application/follow-up-message-draft-command-service';

function repository(): FollowUpMessageDraftCommandRepository {
  return {
    createDraftWithTimeline: vi.fn(async () => ({ kind: 'not_found_or_not_owned' as const })),
    updateDraftContentWithTimeline: vi.fn(async () => ({ kind: 'not_found_or_not_owned' as const })),
    approveDraftWithTimeline: vi.fn(async () => ({ kind: 'not_found_or_not_owned' as const })),
    rejectDraftWithTimeline: vi.fn(async () => ({ kind: 'not_found_or_not_owned' as const })),
    markDraftSentWithTimeline: vi.fn(async () => ({ kind: 'not_found_or_not_owned' as const })),
    updateControlledReachOutMetadata: vi.fn(async () => ({ kind: 'not_found_or_not_owned' as const })),
  };
}

const attribution = { tenantId: 'tenant-a', institutionId: 'inst-a' };
const occurredAt = '2026-08-10T00:00:00.000Z';

describe('Care follow-up message draft command service', () => {
  it('requires non-null exact tenant and institution attribution', async () => {
    const repo = repository();
    const service = createFollowUpMessageDraftCommandService(repo);
    await expect(service.updateDraftContentWithTimeline({
      attribution: { tenantId: 'tenant-a', institutionId: '' }, actorRole: 'tenant_admin', draftId: 'draft-a',
      expectedUpdatedAt: occurredAt, editedContent: '低敏内容', safePreview: '低敏内容', safeReasonCode: 'draft_content_updated', occurredAt,
    })).rejects.toBeInstanceOf(CareFollowUpMessageDraftCommandInputError);
    expect(repo.updateDraftContentWithTimeline).not.toHaveBeenCalled();
  });

  it('passes server attribution and expectedUpdatedAt to lifecycle CAS repository', async () => {
    const repo = repository();
    const service = createFollowUpMessageDraftCommandService(repo);
    await service.approveDraftWithTimeline({
      attribution, actorId: 'admin-a', actorRole: 'tenant_admin', draftId: 'draft-a',
      expectedUpdatedAt: '2026-08-10T00:00:00.000Z', occurredAt: '2026-08-10T00:05:00.000Z',
    });
    expect(repo.approveDraftWithTimeline).toHaveBeenCalledWith({
      tenantId: 'tenant-a', institutionId: 'inst-a', actorId: 'admin-a', actorRole: 'tenant_admin', draftId: 'draft-a',
      expectedUpdatedAt: '2026-08-10T00:00:00.000Z', occurredAt: '2026-08-10T00:05:00.000Z',
    });
  });

  it('controlled reach-out command preserves expected metadata CAS inputs', async () => {
    const repo = repository();
    const service = createFollowUpMessageDraftCommandService(repo);
    await service.updateControlledReachOutMetadata({
      attribution, draftId: 'draft-a', expectedUpdatedAt: occurredAt,
      expectedMetadataJson: { prior: 'safe' }, metadataJson: { prior: 'safe', weComControlledReachOut: { status: 'ready_no_send' } },
      occurredAt: '2026-08-10T00:10:00.000Z',
    });
    expect(repo.updateControlledReachOutMetadata).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-a', institutionId: 'inst-a', draftId: 'draft-a', expectedUpdatedAt: occurredAt,
      expectedMetadataJson: { prior: 'safe' },
    }));
  });
});
