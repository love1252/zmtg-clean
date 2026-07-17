import { describe, expect, it } from 'vitest';

import {
  createKnowledgeDraftVersion,
  createNextDraftFromPublishedVersion,
  knowledgeAssetApprovalStatuses,
  knowledgeItemLifecycles,
  knowledgeSafetyStatuses,
  knowledgeVersionLifecycles,
  transitionKnowledgeVersionLifecycle,
  type KnowledgeMetadataSnapshot,
  type KnowledgeVersion,
} from '../domain/knowledge-versioning';

const manifestHashA = `sha256:${'a'.repeat(64)}`;
const manifestHashB = `sha256:${'b'.repeat(64)}`;

function metadata(
  overrides: Partial<KnowledgeMetadataSnapshot> = {},
): KnowledgeMetadataSnapshot {
  return {
    title: '术后护理 FAQ',
    category: 'faq',
    tags: ['术后', '护理'],
    lowSensitiveSummary: '术后护理的内部知识摘要。',
    source: 'institution_editorial',
    riskLevel: 'medium',
    effectiveAt: null,
    reviewAt: '2026-12-31T00:00:00.000Z',
    useScope: 'ai_customer_reply',
    ...overrides,
  };
}

function createDraft(
  overrides: Partial<Parameters<typeof createKnowledgeDraftVersion>[0]> = {},
): KnowledgeVersion {
  const result = createKnowledgeDraftVersion({
    knowledgeId: 'knowledge-1',
    versionId: 'version-1',
    versionNumber: 1,
    previousVersionNumber: null,
    metadataSnapshot: metadata(),
    bodyRevisionId: 'body-revision-1',
    fileRevisionIds: ['file-revision-1', 'file-revision-2'],
    manifestHash: manifestHashA,
    createdAt: '2026-07-17T01:00:00.000Z',
    ...overrides,
  });

  if (!result.ok) {
    throw new Error(`draft fixture rejected: ${result.reasonCode}`);
  }
  return result.version;
}

function publishVersion(version: KnowledgeVersion): KnowledgeVersion {
  const publishing = transitionKnowledgeVersionLifecycle({
    version,
    to: 'publishing',
  });
  if (!publishing.ok) throw new Error(publishing.reasonCode);

  const published = transitionKnowledgeVersionLifecycle({
    version: publishing.version,
    to: 'published',
  });
  if (!published.ok) throw new Error(published.reasonCode);
  return published.version;
}

describe('knowledge versioning domain', () => {
  it('keeps item, version, safety, and asset approval lifecycles separate', () => {
    expect(knowledgeItemLifecycles).toEqual(['active', 'retired']);
    expect(knowledgeVersionLifecycles).toEqual([
      'draft',
      'publishing',
      'published',
    ]);
    expect(knowledgeSafetyStatuses).toEqual([
      'pending',
      'allowed',
      'blocked',
      'expired',
    ]);
    expect(knowledgeAssetApprovalStatuses).toEqual([
      'not_approved',
      'approved',
      'withdrawn',
      'blocked',
    ]);
    expect(Object.isFrozen(knowledgeItemLifecycles)).toBe(true);
    expect(Object.isFrozen(knowledgeVersionLifecycles)).toBe(true);
    expect(Object.isFrozen(knowledgeSafetyStatuses)).toBe(true);
    expect(Object.isFrozen(knowledgeAssetApprovalStatuses)).toBe(true);

    const version = createDraft();
    expect(version.lifecycle).toBe('draft');
    expect(version).not.toHaveProperty('itemLifecycle');
    expect(version).not.toHaveProperty('safetyStatus');
    expect(version).not.toHaveProperty('assetApprovalStatus');
    expect(version).not.toHaveProperty('status');
  });

  it('creates a deeply immutable draft from metadata, body, files, manifest hash, and a monotonic number', () => {
    const tags = ['术后', '护理'];
    const fileRevisionIds = ['file-revision-1', 'file-revision-2'];
    const metadataInput = metadata({ tags });
    const result = createKnowledgeDraftVersion({
      knowledgeId: 'knowledge-1',
      versionId: 'version-1',
      versionNumber: 1,
      previousVersionNumber: null,
      metadataSnapshot: metadataInput,
      bodyRevisionId: 'body-revision-1',
      fileRevisionIds,
      manifestHash: manifestHashA,
      createdAt: '2026-07-17T01:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    tags.push('输入后修改');
    fileRevisionIds.push('file-revision-3');
    (metadataInput as { title: string }).title = '输入后改标题';

    expect(result.version).toMatchObject({
      knowledgeId: 'knowledge-1',
      versionId: 'version-1',
      versionNumber: 1,
      lifecycle: 'draft',
      bodyRevisionId: 'body-revision-1',
      fileRevisionIds: ['file-revision-1', 'file-revision-2'],
      manifestHash: manifestHashA,
    });
    expect(result.version.metadataSnapshot.title).toBe('术后护理 FAQ');
    expect(result.version.metadataSnapshot.tags).toEqual(['术后', '护理']);
    expect(Object.isFrozen(result.version)).toBe(true);
    expect(Object.isFrozen(result.version.metadataSnapshot)).toBe(true);
    expect(Object.isFrozen(result.version.metadataSnapshot.tags)).toBe(true);
    expect(Object.isFrozen(result.version.fileRevisionIds)).toBe(true);
  });

  it('requires the next version number to be the exact monotonic successor', () => {
    const result = createKnowledgeDraftVersion({
      knowledgeId: 'knowledge-1',
      versionId: 'version-3',
      versionNumber: 3,
      previousVersionNumber: 1,
      metadataSnapshot: metadata(),
      bodyRevisionId: 'body-revision-3',
      fileRevisionIds: [],
      manifestHash: manifestHashB,
      createdAt: '2026-07-17T02:00:00.000Z',
    });

    expect(result).toEqual({
      ok: false,
      reasonCode: 'version_number_not_monotonic',
    });
  });

  it('rejects duplicate file revisions and malformed manifest hashes without doing hash IO', () => {
    const duplicateFiles = createKnowledgeDraftVersion({
      knowledgeId: 'knowledge-1',
      versionId: 'version-1',
      versionNumber: 1,
      previousVersionNumber: null,
      metadataSnapshot: metadata(),
      bodyRevisionId: 'body-revision-1',
      fileRevisionIds: ['file-revision-1', 'file-revision-1'],
      manifestHash: manifestHashA,
      createdAt: '2026-07-17T01:00:00.000Z',
    });
    const malformedHash = createKnowledgeDraftVersion({
      knowledgeId: 'knowledge-1',
      versionId: 'version-1',
      versionNumber: 1,
      previousVersionNumber: null,
      metadataSnapshot: metadata(),
      bodyRevisionId: 'body-revision-1',
      fileRevisionIds: [],
      manifestHash: 'not-a-content-hash',
      createdAt: '2026-07-17T01:00:00.000Z',
    });

    expect(duplicateFiles).toEqual({
      ok: false,
      reasonCode: 'duplicate_file_revision',
    });
    expect(malformedHash).toEqual({
      ok: false,
      reasonCode: 'manifest_hash_invalid',
    });
  });

  it('allows only draft -> publishing -> published and publishing -> draft repair transitions', () => {
    const draft = createDraft();
    const directPublish = transitionKnowledgeVersionLifecycle({
      version: draft,
      to: 'published',
    });
    const publishing = transitionKnowledgeVersionLifecycle({
      version: draft,
      to: 'publishing',
    });

    expect(directPublish).toEqual({
      ok: false,
      reasonCode: 'version_lifecycle_transition_invalid',
    });
    expect(publishing.ok).toBe(true);
    if (!publishing.ok) return;

    const repaired = transitionKnowledgeVersionLifecycle({
      version: publishing.version,
      to: 'draft',
    });
    const published = transitionKnowledgeVersionLifecycle({
      version: publishing.version,
      to: 'published',
    });

    expect(repaired.ok && repaired.version.lifecycle).toBe('draft');
    expect(published.ok && published.version.lifecycle).toBe('published');
    expect(draft.lifecycle).toBe('draft');
    expect(publishing.version.metadataSnapshot).toEqual(draft.metadataSnapshot);
    expect(publishing.version.manifestHash).toBe(draft.manifestHash);

    if (!published.ok) return;
    expect(transitionKnowledgeVersionLifecycle({
      version: published.version,
      to: 'draft',
    })).toEqual({
      ok: false,
      reasonCode: 'version_lifecycle_transition_invalid',
    });
  });

  it.each([
    ['draft', 'draft', false],
    ['draft', 'publishing', true],
    ['draft', 'published', false],
    ['publishing', 'draft', true],
    ['publishing', 'publishing', false],
    ['publishing', 'published', true],
    ['published', 'draft', false],
    ['published', 'publishing', false],
    ['published', 'published', false],
  ] as const)('enforces lifecycle matrix %s -> %s', (from, to, allowed) => {
    const draft = createDraft();
    const publishing = transitionKnowledgeVersionLifecycle({
      version: draft,
      to: 'publishing',
    });
    if (!publishing.ok) throw new Error(publishing.reasonCode);
    const published = transitionKnowledgeVersionLifecycle({
      version: publishing.version,
      to: 'published',
    });
    if (!published.ok) throw new Error(published.reasonCode);
    const version =
      from === 'draft'
        ? draft
        : from === 'publishing'
          ? publishing.version
          : published.version;
    const result = transitionKnowledgeVersionLifecycle({ version, to });

    expect(result.ok).toBe(allowed);
    if (!allowed) {
      expect(result).toEqual({
        ok: false,
        reasonCode: 'version_lifecycle_transition_invalid',
      });
    }
  });

  it.each([
    {
      name: 'draft file revisions are missing',
      run: () => {
        const { fileRevisionIds: _fileRevisionIds, ...input } = {
          knowledgeId: 'knowledge-1',
          versionId: 'version-1',
          versionNumber: 1,
          previousVersionNumber: null,
          metadataSnapshot: metadata(),
          bodyRevisionId: 'body-revision-1',
          fileRevisionIds: [],
          manifestHash: manifestHashA,
          createdAt: '2026-07-17T01:00:00.000Z',
        };
        return createKnowledgeDraftVersion(
          input as unknown as Parameters<
            typeof createKnowledgeDraftVersion
          >[0],
        );
      },
    },
    {
      name: 'draft metadata tags have the wrong type',
      run: () =>
        createKnowledgeDraftVersion({
          knowledgeId: 'knowledge-1',
          versionId: 'version-1',
          versionNumber: 1,
          previousVersionNumber: null,
          metadataSnapshot: {
            ...metadata(),
            tags: '护理',
          } as unknown as KnowledgeMetadataSnapshot,
          bodyRevisionId: 'body-revision-1',
          fileRevisionIds: [],
          manifestHash: manifestHashA,
          createdAt: '2026-07-17T01:00:00.000Z',
        }),
    },
    {
      name: 'draft versionId is not a controlled reference',
      run: () =>
        createKnowledgeDraftVersion({
          knowledgeId: 'knowledge-1',
          versionId: 'version with spaces',
          versionNumber: 1,
          previousVersionNumber: null,
          metadataSnapshot: metadata(),
          bodyRevisionId: 'body-revision-1',
          fileRevisionIds: [],
          manifestHash: manifestHashA,
          createdAt: '2026-07-17T01:00:00.000Z',
        }),
    },
    {
      name: 'draft createdAt is not an ISO timestamp',
      run: () =>
        createKnowledgeDraftVersion({
          knowledgeId: 'knowledge-1',
          versionId: 'version-1',
          versionNumber: 1,
          previousVersionNumber: null,
          metadataSnapshot: metadata(),
          bodyRevisionId: 'body-revision-1',
          fileRevisionIds: [],
          manifestHash: manifestHashA,
          createdAt: 'not-a-date',
        }),
    },
    {
      name: 'draft metadata effectiveAt is not an ISO timestamp',
      run: () =>
        createKnowledgeDraftVersion({
          knowledgeId: 'knowledge-1',
          versionId: 'version-1',
          versionNumber: 1,
          previousVersionNumber: null,
          metadataSnapshot: metadata({ effectiveAt: 'not-a-date' }),
          bodyRevisionId: 'body-revision-1',
          fileRevisionIds: [],
          manifestHash: manifestHashA,
          createdAt: '2026-07-17T01:00:00.000Z',
        }),
    },
    {
      name: 'transition version is missing',
      run: () =>
        transitionKnowledgeVersionLifecycle({
          to: 'published',
        } as unknown as Parameters<
          typeof transitionKnowledgeVersionLifecycle
        >[0]),
    },
    {
      name: 'transition lifecycle is unknown',
      run: () =>
        transitionKnowledgeVersionLifecycle({
          version: createDraft(),
          to: 'archived',
        } as unknown as Parameters<
          typeof transitionKnowledgeVersionLifecycle
        >[0]),
    },
    {
      name: 'next draft source version is missing',
      run: () =>
        createNextDraftFromPublishedVersion({
          versionId: 'version-2',
          metadataSnapshot: metadata(),
          bodyRevisionId: 'body-revision-2',
          fileRevisionIds: [],
          manifestHash: manifestHashB,
          createdAt: '2026-07-17T03:00:00.000Z',
        } as unknown as Parameters<
          typeof createNextDraftFromPublishedVersion
        >[0]),
    },
  ])('returns a controlled failure without throwing when $name', ({ run }) => {
    let result: ReturnType<typeof createKnowledgeDraftVersion> | undefined;
    expect(() => {
      result = run();
    }).not.toThrow();
    expect(result).toEqual({ ok: false, reasonCode: 'input_invalid' });
  });

  it('edits published content only by creating a new immutable draft version', () => {
    const published = publishVersion(createDraft());
    const result = createNextDraftFromPublishedVersion({
      sourceVersion: published,
      versionId: 'version-2',
      metadataSnapshot: metadata({ title: '术后护理 FAQ（修订）' }),
      bodyRevisionId: 'body-revision-2',
      fileRevisionIds: ['file-revision-1', 'file-revision-3'],
      manifestHash: manifestHashB,
      createdAt: '2026-07-17T03:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.version).toMatchObject({
      knowledgeId: published.knowledgeId,
      versionId: 'version-2',
      versionNumber: 2,
      lifecycle: 'draft',
      bodyRevisionId: 'body-revision-2',
      manifestHash: manifestHashB,
    });
    expect(published).toMatchObject({
      versionId: 'version-1',
      versionNumber: 1,
      lifecycle: 'published',
      bodyRevisionId: 'body-revision-1',
      manifestHash: manifestHashA,
    });

    const fromDraft = createNextDraftFromPublishedVersion({
      sourceVersion: createDraft(),
      versionId: 'version-2',
      metadataSnapshot: metadata(),
      bodyRevisionId: 'body-revision-2',
      fileRevisionIds: [],
      manifestHash: manifestHashB,
      createdAt: '2026-07-17T03:00:00.000Z',
    });
    expect(fromDraft).toEqual({
      ok: false,
      reasonCode: 'source_version_not_published',
    });

    const publishedBefore = structuredClone(published);
    const reusedVersionId = createNextDraftFromPublishedVersion({
      sourceVersion: published,
      versionId: published.versionId,
      metadataSnapshot: metadata({ title: '不应接受的修订' }),
      bodyRevisionId: 'body-revision-2',
      fileRevisionIds: [],
      manifestHash: manifestHashB,
      createdAt: '2026-07-17T03:00:00.000Z',
    });
    expect(reusedVersionId).toEqual({
      ok: false,
      reasonCode: 'version_id_reused',
    });
    expect(published).toEqual(publishedBefore);

    const overflowSource = Object.freeze({
      ...published,
      versionNumber: Number.MAX_SAFE_INTEGER,
    });
    const overflow = createNextDraftFromPublishedVersion({
      sourceVersion: overflowSource,
      versionId: 'version-overflow',
      metadataSnapshot: metadata(),
      bodyRevisionId: 'body-revision-overflow',
      fileRevisionIds: [],
      manifestHash: manifestHashB,
      createdAt: '2026-07-17T03:00:00.000Z',
    });
    expect(overflow).toEqual({
      ok: false,
      reasonCode: 'version_number_not_monotonic',
    });
  });
});
