import { describe, expect, it } from 'vitest';

import {
  createKnowledgeContentManifest,
  validateKnowledgeContentManifest,
  type CreateKnowledgeContentManifestInput,
  type KnowledgeContentManifest,
} from '../domain/knowledge-content-manifest';
import {
  createKnowledgeDraftVersion,
  createNextDraftFromPublishedVersion,
  isValidKnowledgeVersion,
  knowledgeAssetApprovalStatuses,
  knowledgeItemLifecycles,
  knowledgeSafetyStatuses,
  knowledgeVersionLifecycles,
  transitionKnowledgeVersionLifecycle,
  type KnowledgeMetadataSnapshot,
  type KnowledgeVersion,
} from '../domain/knowledge-versioning';

type DeepMutable<T> = T extends readonly (infer Item)[]
  ? DeepMutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
    : T;

const bodyContentHashA = `sha256:${'1'.repeat(64)}`;
const bodyContentHashB = `sha256:${'2'.repeat(64)}`;
const fileContentHashA = `sha256:${'3'.repeat(64)}`;
const fileContentHashB = `sha256:${'4'.repeat(64)}`;

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

function manifestInput(
  overrides: Partial<CreateKnowledgeContentManifestInput> = {},
): CreateKnowledgeContentManifestInput {
  return {
    manifestFormatVersion: 1,
    knowledgeId: 'knowledge-1',
    tenantId: 'tenant-1',
    institutionId: 'institution-1',
    ownershipSource: 'institution',
    metadataSnapshot: metadata(),
    body: {
      bodyRevisionId: 'body-revision-1',
      contentHash: bodyContentHashA,
      schemaVersion: 'body-schema-v1',
      templateVersion: 'faq-template-v1',
    },
    attachments: [
      {
        fileRevisionId: 'file-revision-1',
        contentHash: fileContentHashA,
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        safetyStatus: 'allowed',
        displayName: '护理说明.pdf',
      },
      {
        fileRevisionId: 'file-revision-2',
        contentHash: fileContentHashB,
        mimeType: 'image/png',
        sizeBytes: 2048,
        safetyStatus: 'pending',
        displayName: '护理示意图.png',
      },
    ],
    ...overrides,
  };
}

function contentManifest(
  overrides: Partial<CreateKnowledgeContentManifestInput> = {},
): KnowledgeContentManifest {
  const result = createKnowledgeContentManifest(manifestInput(overrides));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reasonCode);
  return result.manifest;
}

const manifestHashA = contentManifest().manifestHash;
const manifestHashB = contentManifest({
  body: {
    ...manifestInput().body,
    bodyRevisionId: 'body-revision-2',
    contentHash: bodyContentHashB,
  },
  attachments: [],
}).manifestHash;

describe('knowledge content manifest domain', () => {
  it('derives one deterministic SHA-256 from the fixed descriptor order and deeply freezes the result', () => {
    const input = manifestInput();
    const inputBefore = structuredClone(input);
    const first = createKnowledgeContentManifest(input);
    const second = createKnowledgeContentManifest(structuredClone(input));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.manifest.manifestHash).toBe(second.manifest.manifestHash);
    expect(first.manifest.manifestHash).toBe(
      'sha256:3db45f6511ec4b0c8904018e446fcfa8ceab7c1bac34d76301737ba46cef3071',
    );
    expect(first.manifest.manifestHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(input).toEqual(inputBefore);
    expect(Object.isFrozen(first.manifest)).toBe(true);
    expect(Object.isFrozen(first.manifest.metadataSnapshot)).toBe(true);
    expect(Object.isFrozen(first.manifest.metadataSnapshot.tags)).toBe(true);
    expect(Object.isFrozen(first.manifest.body)).toBe(true);
    expect(Object.isFrozen(first.manifest.attachments)).toBe(true);
    expect(Object.isFrozen(first.manifest.attachments[0])).toBe(true);
    expect(first.manifest).not.toHaveProperty('bodyText');
    expect(first.manifest).not.toHaveProperty('fileBytes');
    expect(JSON.stringify(first.manifest)).not.toMatch(
      /storageKey|provider|prompt|completion|vector|payload|ocrText/i,
    );
  });

  it('ignores object insertion order while preserving declared tag and attachment order', () => {
    const input = manifestInput();
    const reverseEntries = (value: object): Record<string, unknown> =>
      Object.fromEntries(Object.entries(value).reverse());
    const reordered = reverseEntries(input);
    reordered.metadataSnapshot = reverseEntries(input.metadataSnapshot);
    reordered.body = reverseEntries(input.body);
    reordered.attachments = input.attachments.map(reverseEntries);

    const base = createKnowledgeContentManifest(input);
    const changedInsertionOrder = createKnowledgeContentManifest(
      reordered as unknown as CreateKnowledgeContentManifestInput,
    );

    expect(base.ok).toBe(true);
    expect(changedInsertionOrder.ok).toBe(true);
    if (!base.ok || !changedInsertionOrder.ok) return;
    expect(changedInsertionOrder.manifest.manifestHash).toBe(
      base.manifest.manifestHash,
    );
    expect(changedInsertionOrder.manifest).toEqual(base.manifest);
  });

  it('changes the hash for every normalized semantic field and preserves tag and attachment declaration order', () => {
    const base = manifestInput();
    const baseResult = createKnowledgeContentManifest(base);
    expect(baseResult.ok).toBe(true);
    if (!baseResult.ok) return;

    const mutations: readonly Readonly<{
      name: string;
      mutate: (
        input: DeepMutable<CreateKnowledgeContentManifestInput>,
      ) => void;
    }>[] = [
      { name: 'knowledgeId', mutate: (input) => { input.knowledgeId = 'knowledge-2'; } },
      { name: 'tenantId', mutate: (input) => { input.tenantId = 'tenant-2'; } },
      { name: 'institutionId', mutate: (input) => { input.institutionId = 'institution-2'; } },
      { name: 'ownershipSource', mutate: (input) => { input.ownershipSource = 'platform'; } },
      { name: 'title', mutate: (input) => { input.metadataSnapshot.title = '护理 FAQ 修订'; } },
      { name: 'category', mutate: (input) => { input.metadataSnapshot.category = 'training'; } },
      { name: 'tag value', mutate: (input) => { input.metadataSnapshot.tags[0] = '复核'; } },
      { name: 'tag order', mutate: (input) => { input.metadataSnapshot.tags.reverse(); } },
      { name: 'summary', mutate: (input) => { input.metadataSnapshot.lowSensitiveSummary = '修订后的低敏摘要。'; } },
      { name: 'source', mutate: (input) => { input.metadataSnapshot.source = 'controlled_import'; } },
      { name: 'risk', mutate: (input) => { input.metadataSnapshot.riskLevel = 'high'; } },
      { name: 'effectiveAt', mutate: (input) => { input.metadataSnapshot.effectiveAt = '2026-08-01T00:00:00.000Z'; } },
      { name: 'reviewAt', mutate: (input) => { input.metadataSnapshot.reviewAt = '2027-01-01T00:00:00.000Z'; } },
      { name: 'useScope', mutate: (input) => { input.metadataSnapshot.useScope = 'internal_only'; } },
      { name: 'body revision', mutate: (input) => { input.body.bodyRevisionId = 'body-revision-2'; } },
      { name: 'body content hash', mutate: (input) => { input.body.contentHash = bodyContentHashB; } },
      { name: 'body schema', mutate: (input) => { input.body.schemaVersion = 'body-schema-v2'; } },
      { name: 'body template', mutate: (input) => { input.body.templateVersion = 'faq-template-v2'; } },
      { name: 'attachment order', mutate: (input) => { input.attachments.reverse(); } },
      { name: 'file revision', mutate: (input) => { input.attachments[0].fileRevisionId = 'file-revision-3'; } },
      { name: 'file content hash', mutate: (input) => { input.attachments[0].contentHash = `sha256:${'5'.repeat(64)}`; } },
      { name: 'MIME', mutate: (input) => { input.attachments[0].mimeType = 'application/octet-stream'; } },
      { name: 'size', mutate: (input) => { input.attachments[0].sizeBytes = 1025; } },
      { name: 'file safety', mutate: (input) => { input.attachments[0].safetyStatus = 'blocked'; } },
      { name: 'display name', mutate: (input) => { input.attachments[0].displayName = '护理说明-修订.pdf'; } },
    ];

    for (const mutation of mutations) {
      const changed = structuredClone(base);
      mutation.mutate(changed as DeepMutable<typeof changed>);
      const result = createKnowledgeContentManifest(changed);
      expect(result.ok, mutation.name).toBe(true);
      if (!result.ok) continue;
      expect(result.manifest.manifestHash, mutation.name).not.toBe(
        baseResult.manifest.manifestHash,
      );
    }
  });

  it('fails closed for malformed descriptors and duplicate file revisions without throwing or echoing input', () => {
    const duplicate = manifestInput({
      attachments: [
        manifestInput().attachments[0],
        {
          ...manifestInput().attachments[1],
          fileRevisionId: 'file-revision-1',
        },
      ],
    });
    const missingBody = manifestInput() as unknown as Record<string, unknown>;
    delete missingBody.body;
    const extraField = { ...manifestInput(), rawBody: 'SENSITIVE_BODY' };
    const malformedCases = [
      { input: duplicate, reasonCode: 'duplicate_file_revision' },
      { input: missingBody, reasonCode: 'input_invalid' },
      { input: extraField, reasonCode: 'input_invalid' },
      {
        input: manifestInput({
          body: { ...manifestInput().body, contentHash: 'invalid-hash' },
        }),
        reasonCode: 'input_invalid',
      },
      {
        input: manifestInput({
          attachments: [
            { ...manifestInput().attachments[0], sizeBytes: Number.MAX_SAFE_INTEGER + 1 },
          ],
        }),
        reasonCode: 'input_invalid',
      },
      {
        input: manifestInput({
          attachments: [
            { ...manifestInput().attachments[0], safetyStatus: 'unknown' as never },
          ],
        }),
        reasonCode: 'input_invalid',
      },
      {
        input: new Proxy(manifestInput(), {
          ownKeys() {
            throw new Error('must not escape');
          },
        }),
        reasonCode: 'input_invalid',
      },
    ] as const;

    for (const malformed of malformedCases) {
      let result: ReturnType<typeof createKnowledgeContentManifest> | undefined;
      expect(() => {
        result = createKnowledgeContentManifest(
          malformed.input as CreateKnowledgeContentManifestInput,
        );
      }).not.toThrow();
      expect(result).toEqual({ ok: false, reasonCode: malformed.reasonCode });
      expect(JSON.stringify(result)).not.toContain('SENSITIVE_BODY');
    }
  });

  it('rejects ambiguous Unicode, sparse or accessor data, hidden keys, and negative zero', () => {
    let accessorReads = 0;
    const accessorMetadata = { ...metadata() } as Record<string, unknown>;
    Object.defineProperty(accessorMetadata, 'title', {
      enumerable: true,
      get() {
        accessorReads += 1;
        return '不得读取的标题';
      },
    });

    const sparseTags = new Array<string>(2);
    sparseTags[0] = '术后';
    const sparseAttachments = new Array<
      CreateKnowledgeContentManifestInput['attachments'][number]
    >(2);
    sparseAttachments[0] = manifestInput().attachments[0];

    const hiddenKey = manifestInput() as Record<string, unknown>;
    Object.defineProperty(hiddenKey, 'hiddenPayload', {
      value: 'SENSITIVE_HIDDEN',
      enumerable: false,
    });
    const symbolKey = manifestInput() as Record<PropertyKey, unknown>;
    symbolKey[Symbol('hidden')] = 'SENSITIVE_SYMBOL';

    const malformedInputs = [
      manifestInput({
        metadataSnapshot: metadata({ title: '\ud800' }),
      }),
      manifestInput({
        attachments: [
          {
            ...manifestInput().attachments[0],
            displayName: '\udc00.pdf',
          },
        ],
      }),
      manifestInput({
        attachments: [
          { ...manifestInput().attachments[0], sizeBytes: -0 },
        ],
      }),
      manifestInput({
        metadataSnapshot: metadata({ tags: sparseTags }),
      }),
      manifestInput({ attachments: sparseAttachments }),
      manifestInput({
        metadataSnapshot:
          accessorMetadata as unknown as KnowledgeMetadataSnapshot,
      }),
      hiddenKey,
      symbolKey,
    ];

    for (const input of malformedInputs) {
      expect(() =>
        createKnowledgeContentManifest(
          input as CreateKnowledgeContentManifestInput,
        ),
      ).not.toThrow();
      expect(
        createKnowledgeContentManifest(
          input as CreateKnowledgeContentManifestInput,
        ),
      ).toEqual({ ok: false, reasonCode: 'input_invalid' });
    }
    expect(accessorReads).toBe(0);
  });

  it('rejects Array subclasses before overridden iteration can bypass descriptor validation', () => {
    class ValidationBypassArray<T> extends Array<T> {}
    Object.defineProperty(ValidationBypassArray.prototype, 'every', {
      value: () => true,
    });

    const unsafeTags = new ValidationBypassArray<unknown>();
    unsafeTags.push({ rawText: 'SENSITIVE_RAW_TAG' });
    const unsafeAttachments = new ValidationBypassArray<unknown>();
    unsafeAttachments.push({ rawBytes: 'SENSITIVE_FILE_BYTES' });

    const results = [
      createKnowledgeContentManifest(
        manifestInput({
          metadataSnapshot: metadata({
            tags: unsafeTags as unknown as readonly string[],
          }),
        }),
      ),
      createKnowledgeContentManifest(
        manifestInput({
          attachments:
            unsafeAttachments as unknown as CreateKnowledgeContentManifestInput['attachments'],
        }),
      ),
    ];

    for (const result of results) {
      expect(result).toEqual({ ok: false, reasonCode: 'input_invalid' });
      expect(JSON.stringify(result)).not.toMatch(
        /SENSITIVE_RAW_TAG|SENSITIVE_FILE_BYTES/,
      );
    }
  });

  it('rejects non-enumerable manifest fields instead of hashing a non-JSON shape', () => {
    const input = manifestInput();
    Object.defineProperty(input, 'tenantId', {
      value: input.tenantId,
      enumerable: false,
    });

    expect(createKnowledgeContentManifest(input)).toEqual({
      ok: false,
      reasonCode: 'input_invalid',
    });
  });

  it('derives the canonical hash without consulting inherited array serialization hooks', () => {
    const previous = Object.getOwnPropertyDescriptor(Array.prototype, 'toJSON');
    try {
      Object.defineProperty(Array.prototype, 'toJSON', {
        configurable: true,
        value: () => ['collapsed'],
      });

      const first = createKnowledgeContentManifest(manifestInput());
      const changed = createKnowledgeContentManifest(
        manifestInput({ tenantId: 'tenant-2' }),
      );
      expect(first.ok).toBe(true);
      expect(changed.ok).toBe(true);
      if (!first.ok || !changed.ok) return;
      expect(first.manifest.manifestHash).toBe(manifestHashA);
      expect(changed.manifest.manifestHash).not.toBe(
        first.manifest.manifestHash,
      );
    } finally {
      if (previous === undefined) {
        delete (Array.prototype as { toJSON?: unknown }).toJSON;
      } else {
        Object.defineProperty(Array.prototype, 'toJSON', previous);
      }
    }
  });

  it('rejects top-level and nested Proxy descriptors without executing traps', () => {
    let trapCount = 0;
    const handler: ProxyHandler<object> = {
      get(target, property, receiver) {
        trapCount += 1;
        return Reflect.get(target, property, receiver);
      },
      getOwnPropertyDescriptor(target, property) {
        trapCount += 1;
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
      getPrototypeOf(target) {
        trapCount += 1;
        return Reflect.getPrototypeOf(target);
      },
      ownKeys(target) {
        trapCount += 1;
        return Reflect.ownKeys(target);
      },
    };
    const topLevelProxy = new Proxy(
      manifestInput(),
      handler as ProxyHandler<CreateKnowledgeContentManifestInput>,
    );
    const nestedProxy = manifestInput({
      metadataSnapshot: new Proxy(
        metadata(),
        handler as ProxyHandler<KnowledgeMetadataSnapshot>,
      ),
    });

    expect(createKnowledgeContentManifest(topLevelProxy)).toEqual({
      ok: false,
      reasonCode: 'input_invalid',
    });
    expect(createKnowledgeContentManifest(nestedProxy)).toEqual({
      ok: false,
      reasonCode: 'input_invalid',
    });
    expect(trapCount).toBe(0);
  });

  it('rejects revoked manifest and attachment-array proxies without throwing', () => {
    const topLevel = Proxy.revocable(manifestInput(), {});
    const attachments = Proxy.revocable(
      [...manifestInput().attachments],
      {},
    );
    const nestedInput = manifestInput({ attachments: attachments.proxy });
    topLevel.revoke();
    attachments.revoke();

    expect(() =>
      createKnowledgeContentManifest(topLevel.proxy),
    ).not.toThrow();
    expect(createKnowledgeContentManifest(topLevel.proxy)).toEqual({
      ok: false,
      reasonCode: 'input_invalid',
    });
    expect(() => createKnowledgeContentManifest(nestedInput)).not.toThrow();
    expect(createKnowledgeContentManifest(nestedInput)).toEqual({
      ok: false,
      reasonCode: 'input_invalid',
    });
  });

  it.each([
    '2026-02-30T00:00:00.000Z',
    '2026-04-31T00:00:00.000Z',
    '2026-01-01T24:00:00.000Z',
    '2026-01-01T00:60:00.000Z',
    '2026-01-01T00:00:60.000Z',
    '2026-01-01T00:00:00.000+24:00',
    '2026-01-01T00:00:00.0001Z',
  ])('rejects impossible calendar timestamp %s', (effectiveAt) => {
    expect(
      createKnowledgeContentManifest(
        manifestInput({
          metadataSnapshot: metadata({ effectiveAt }),
        }),
      ),
    ).toEqual({ ok: false, reasonCode: 'input_invalid' });
  });

  it('detects a changed descriptor or hash when validating a persisted manifest', () => {
    const manifest = contentManifest();
    const changedDescriptor = {
      ...structuredClone(manifest),
      tenantId: 'tenant-2',
    };
    const changedHash = {
      ...structuredClone(manifest),
      manifestHash: `sha256:${'f'.repeat(64)}`,
    };

    expect(validateKnowledgeContentManifest(changedDescriptor)).toEqual({
      ok: false,
      reasonCode: 'manifest_hash_mismatch',
    });
    expect(validateKnowledgeContentManifest(changedHash)).toEqual({
      ok: false,
      reasonCode: 'manifest_hash_mismatch',
    });
    const valid = validateKnowledgeContentManifest(structuredClone(manifest));
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    expect(valid.manifest).toEqual(manifest);
    expect(Object.isFrozen(valid.manifest)).toBe(true);
    expect(Object.isFrozen(valid.manifest.attachments)).toBe(true);
  });
});

function createDraft(): KnowledgeVersion {
  const result = createKnowledgeDraftVersion({
    versionId: 'version-1',
    versionNumber: 1,
    previousVersionNumber: null,
    contentManifest: contentManifest(),
    createdAt: '2026-07-17T01:00:00.000Z',
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

  it('creates a deeply immutable draft from one validated content manifest and a monotonic number', () => {
    const mutableManifest = structuredClone(
      contentManifest(),
    ) as DeepMutable<KnowledgeContentManifest>;
    const expectedManifest = structuredClone(mutableManifest);
    const result = createKnowledgeDraftVersion({
      versionId: 'version-1',
      versionNumber: 1,
      previousVersionNumber: null,
      contentManifest: mutableManifest,
      createdAt: '2026-07-17T01:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    mutableManifest.metadataSnapshot.tags.push('输入后修改');
    mutableManifest.attachments.push({
      ...mutableManifest.attachments[0],
      fileRevisionId: 'file-revision-3',
    });
    mutableManifest.metadataSnapshot.title = '输入后改标题';

    expect(result.version).toMatchObject({
      knowledgeId: 'knowledge-1',
      versionId: 'version-1',
      versionNumber: 1,
      lifecycle: 'draft',
      bodyRevisionId: 'body-revision-1',
      fileRevisionIds: ['file-revision-1', 'file-revision-2'],
      manifestHash: expectedManifest.manifestHash,
    });
    expect(result.version.metadataSnapshot.title).toBe('术后护理 FAQ');
    expect(result.version.metadataSnapshot.tags).toEqual(['术后', '护理']);
    expect(Object.isFrozen(result.version)).toBe(true);
    expect(Object.isFrozen(result.version.metadataSnapshot)).toBe(true);
    expect(Object.isFrozen(result.version.metadataSnapshot.tags)).toBe(true);
    expect(Object.isFrozen(result.version.fileRevisionIds)).toBe(true);
    expect(result.version.contentManifest).toEqual(expectedManifest);
    expect(Object.isFrozen(result.version.contentManifest)).toBe(true);
    expect(Object.isFrozen(result.version.contentManifest.body)).toBe(true);
    expect(Object.isFrozen(result.version.contentManifest.attachments)).toBe(
      true,
    );
    expect(
      Object.isFrozen(result.version.contentManifest.attachments[0]),
    ).toBe(true);
  });

  it('requires the next version number to be the exact monotonic successor', () => {
    const result = createKnowledgeDraftVersion({
      versionId: 'version-3',
      versionNumber: 3,
      previousVersionNumber: 1,
      contentManifest: contentManifest({
        body: {
          ...manifestInput().body,
          bodyRevisionId: 'body-revision-3',
          contentHash: bodyContentHashB,
        },
        attachments: [],
      }),
      createdAt: '2026-07-17T02:00:00.000Z',
    });

    expect(result).toEqual({
      ok: false,
      reasonCode: 'version_number_not_monotonic',
    });
  });

  it('rejects duplicate file revisions and a tampered manifest hash without reading content bytes', () => {
    const duplicateManifest = {
      ...structuredClone(contentManifest()),
      attachments: [
        structuredClone(contentManifest().attachments[0]),
        {
          ...structuredClone(contentManifest().attachments[1]),
          fileRevisionId: 'file-revision-1',
        },
      ],
    };
    const duplicateFiles = createKnowledgeDraftVersion({
      versionId: 'version-1',
      versionNumber: 1,
      previousVersionNumber: null,
      contentManifest: duplicateManifest,
      createdAt: '2026-07-17T01:00:00.000Z',
    });
    const tamperedHash = createKnowledgeDraftVersion({
      versionId: 'version-1',
      versionNumber: 1,
      previousVersionNumber: null,
      contentManifest: {
        ...structuredClone(contentManifest({ attachments: [] })),
        manifestHash: `sha256:${'f'.repeat(64)}`,
      },
      createdAt: '2026-07-17T01:00:00.000Z',
    });

    expect(duplicateFiles).toEqual({
      ok: false,
      reasonCode: 'duplicate_file_revision',
    });
    expect(tamperedHash).toEqual({
      ok: false,
      reasonCode: 'manifest_hash_mismatch',
    });
  });

  it('rejects every split-brain field between the version shell and its immutable manifest', () => {
    const draft = createDraft();
    const mismatches: readonly KnowledgeVersion[] = [
      { ...draft, knowledgeId: 'knowledge-2' },
      {
        ...draft,
        metadataSnapshot: {
          ...draft.metadataSnapshot,
          title: '不一致标题',
        },
      },
      { ...draft, bodyRevisionId: 'body-revision-2' },
      { ...draft, fileRevisionIds: [...draft.fileRevisionIds].reverse() },
      { ...draft, manifestHash: `sha256:${'f'.repeat(64)}` },
    ];

    for (const mismatch of mismatches) {
      const before = structuredClone(mismatch);
      expect(isValidKnowledgeVersion(mismatch)).toBe(false);
      expect(transitionKnowledgeVersionLifecycle({
        version: mismatch,
        to: 'publishing',
      })).toEqual({
        ok: false,
        reasonCode: 'manifest_binding_mismatch',
      });
      expect(mismatch).toEqual(before);
    }

    const rawHashBypass = createKnowledgeDraftVersion({
      versionId: 'version-raw-hash',
      versionNumber: 1,
      previousVersionNumber: null,
      contentManifest: contentManifest(),
      manifestHash: `sha256:${'f'.repeat(64)}`,
      createdAt: '2026-07-17T01:00:00.000Z',
    } as unknown as Parameters<typeof createKnowledgeDraftVersion>[0]);
    expect(rawHashBypass).toEqual({ ok: false, reasonCode: 'input_invalid' });

    const changedManifest = {
      ...structuredClone(draft.contentManifest),
      tenantId: 'tenant-2',
    };
    expect(transitionKnowledgeVersionLifecycle({
      version: { ...draft, contentManifest: changedManifest },
      to: 'publishing',
    })).toEqual({
      ok: false,
      reasonCode: 'manifest_hash_mismatch',
    });
  });

  it('rejects a proxied version without executing traps or throwing', () => {
    let trapCount = 0;
    const draft = createDraft();
    const proxiedVersion = new Proxy(draft, {
      get(target, property, receiver) {
        trapCount += 1;
        return Reflect.get(target, property, receiver);
      },
      getOwnPropertyDescriptor(target, property) {
        trapCount += 1;
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
      getPrototypeOf(target) {
        trapCount += 1;
        return Reflect.getPrototypeOf(target);
      },
      ownKeys(target) {
        trapCount += 1;
        return Reflect.ownKeys(target);
      },
    });

    expect(() =>
      transitionKnowledgeVersionLifecycle({
        version: proxiedVersion,
        to: 'publishing',
      }),
    ).not.toThrow();
    expect(
      transitionKnowledgeVersionLifecycle({
        version: proxiedVersion,
        to: 'publishing',
      }),
    ).toEqual({ ok: false, reasonCode: 'input_invalid' });
    expect(trapCount).toBe(0);
  });

  it('rejects a revoked version proxy without throwing', () => {
    const revocable = Proxy.revocable(createDraft(), {});
    revocable.revoke();

    expect(() =>
      transitionKnowledgeVersionLifecycle({
        version: revocable.proxy,
        to: 'publishing',
      }),
    ).not.toThrow();
    expect(
      transitionKnowledgeVersionLifecycle({
        version: revocable.proxy,
        to: 'publishing',
      }),
    ).toEqual({ ok: false, reasonCode: 'input_invalid' });
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
      name: 'draft content manifest is missing',
      run: () => {
        const { contentManifest: _contentManifest, ...input } = {
          versionId: 'version-1',
          versionNumber: 1,
          previousVersionNumber: null,
          contentManifest: contentManifest(),
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
          versionId: 'version-1',
          versionNumber: 1,
          previousVersionNumber: null,
          contentManifest: {
            ...structuredClone(contentManifest()),
            metadataSnapshot: {
              ...metadata(),
              tags: '护理',
            } as unknown as KnowledgeMetadataSnapshot,
          },
          createdAt: '2026-07-17T01:00:00.000Z',
        }),
    },
    {
      name: 'draft versionId is not a controlled reference',
      run: () =>
        createKnowledgeDraftVersion({
          versionId: 'version with spaces',
          versionNumber: 1,
          previousVersionNumber: null,
          contentManifest: contentManifest(),
          createdAt: '2026-07-17T01:00:00.000Z',
        }),
    },
    {
      name: 'draft createdAt is not an ISO timestamp',
      run: () =>
        createKnowledgeDraftVersion({
          versionId: 'version-1',
          versionNumber: 1,
          previousVersionNumber: null,
          contentManifest: contentManifest(),
          createdAt: 'not-a-date',
        }),
    },
    {
      name: 'draft metadata effectiveAt is not an ISO timestamp',
      run: () =>
        createKnowledgeDraftVersion({
          versionId: 'version-1',
          versionNumber: 1,
          previousVersionNumber: null,
          contentManifest: {
            ...structuredClone(contentManifest()),
            metadataSnapshot: metadata({ effectiveAt: 'not-a-date' }),
          },
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
          contentManifest: contentManifest({
            body: {
              ...manifestInput().body,
              bodyRevisionId: 'body-revision-2',
              contentHash: bodyContentHashB,
            },
            attachments: [],
          }),
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
    const nextManifest = contentManifest({
      metadataSnapshot: metadata({ title: '术后护理 FAQ（修订）' }),
      body: {
        ...manifestInput().body,
        bodyRevisionId: 'body-revision-2',
        contentHash: bodyContentHashB,
      },
      attachments: [
        manifestInput().attachments[0],
        {
          ...manifestInput().attachments[1],
          fileRevisionId: 'file-revision-3',
          contentHash: `sha256:${'5'.repeat(64)}`,
        },
      ],
    });
    const result = createNextDraftFromPublishedVersion({
      sourceVersion: published,
      versionId: 'version-2',
      contentManifest: nextManifest,
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
      manifestHash: nextManifest.manifestHash,
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
      contentManifest: nextManifest,
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
      contentManifest: contentManifest({
        ...manifestInput(),
        metadataSnapshot: metadata({ title: '不应接受的修订' }),
      }),
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
      contentManifest: contentManifest({
        body: {
          ...manifestInput().body,
          bodyRevisionId: 'body-revision-overflow',
          contentHash: bodyContentHashB,
        },
        attachments: [],
      }),
      createdAt: '2026-07-17T03:00:00.000Z',
    });
    expect(overflow).toEqual({
      ok: false,
      reasonCode: 'version_number_not_monotonic',
    });
  });

  it.each([
    ['knowledgeId', { knowledgeId: 'knowledge-2' }],
    ['tenantId', { tenantId: 'tenant-2' }],
    ['institutionId', { institutionId: 'institution-2' }],
    ['ownershipSource', { ownershipSource: 'platform' as const }],
  ])('fails closed when the next draft changes the item %s', (_field, overrides) => {
    const published = publishVersion(createDraft());
    const foreignManifest = contentManifest(overrides);
    const sourceBefore = structuredClone(published);
    const manifestBefore = structuredClone(foreignManifest);

    const result = createNextDraftFromPublishedVersion({
      sourceVersion: published,
      versionId: 'version-2',
      contentManifest: foreignManifest,
      createdAt: '2026-07-17T03:00:00.000Z',
    });

    expect(result).toEqual({
      ok: false,
      reasonCode: 'manifest_binding_mismatch',
    });
    expect(published).toEqual(sourceBefore);
    expect(foreignManifest).toEqual(manifestBefore);
  });

  it('rejects a next draft timestamp earlier than its published source version', () => {
    const published = publishVersion(createDraft());
    const result = createNextDraftFromPublishedVersion({
      sourceVersion: published,
      versionId: 'version-2',
      contentManifest: contentManifest(),
      createdAt: '2026-07-17T00:59:59.999Z',
    });

    expect(result).toEqual({ ok: false, reasonCode: 'input_invalid' });
  });
});
