import { createHash, randomUUID } from 'node:crypto';

import { and, asc, eq, sql } from 'drizzle-orm';

import { chunkV1KnowledgeBaseRuntimeDocument } from '@/modules/knowledge-base/server/v1-knowledge-base-upload-parse-chunk-runtime';
import {
  PLATFORM_KNOWLEDGE_PARSER_VERSION,
  parseKnowledgeDocumentFile,
} from '@/modules/open-platform/server/platform-knowledge-document-parsing-service';
import { createLocalPlatformKnowledgeFileStorage } from '@/modules/open-platform/server/platform-knowledge-file-storage';
import { INSTITUTION_KNOWLEDGE_FILE_MAX_BYTES } from '@/modules/institution/server/institution-knowledge-upload-service';
import { checkTenantQuotaForUsage } from '@/modules/institution/server/tenant-quota-enforcement';
import { isRoleInInstitutionSectionAudienceV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import {
  createInstitutionActionPolicyV1,
  isInstitutionActionPolicyAllowV1,
} from '@/modules/security/server/institution-action-policy';
import { getDatabase, type TenantDatabase } from '@/server/db/client';
import {
  institutionKnowledgeUploadDrafts,
  knowledgeChunks,
  knowledgeDocumentFileParseChunks,
  knowledgeDocumentFileParses,
  knowledgeDocumentFiles,
  knowledgeDocuments,
  knowledgeFormalDocumentPublications,
  knowledgeFormalDocumentVersions,
  knowledgeFormalSources,
  knowledgeSources,
  platformKnowledgeInstitutionVisibility,
} from '@/server/db/schema';
import {
  consumeInstitutionCustomerWriteAuthorizationV1,
  resolveInstitutionCustomerWriteAuthorizationV1,
  type InstitutionCustomerWriteAuthorizationConsumptionV1,
} from '@/server/orchestration/institution-customer-write-authorization';

type KnowledgeWriteAction = 'update' | 'approve';
type AllowedActor = InstitutionCustomerWriteAuthorizationConsumptionV1;

export type InstitutionKnowledgeUploadResultV1 =
  | Readonly<{
      kind: 'ready';
      upload: Readonly<{
        uploadId: string;
        knowledgeId: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
        parserType: string;
        warningCodes: readonly string[];
        title: string;
        category: string;
        state: 'parsed' | 'confirmed' | 'published';
        revision: number;
        sectionCount: number;
        sections: readonly Readonly<{
          index: number;
          preview: string;
          charCount: number;
        }>[];
        publishedVersion: number | null;
        publishedAt: string | null;
      }>;
    }>
  | Readonly<{
      kind: 'invalid' | 'forbidden' | 'conflict' | 'quota_denied' | 'unavailable';
      code: string;
      message?: string;
    }>;

const INVALID_ID = /[^A-Za-z0-9._:-]/u;
const ALLOWED_EXTENSIONS = new Set(['.txt', '.md', '.pdf', '.docx', '.xlsx', '.csv']);

function id(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function digest(content: Uint8Array | string) {
  return createHash('sha256').update(content).digest('hex');
}

function cleanFileName(value: string) {
  const base = value.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? '';
  return base.replace(/[\x00-\x1f\x7f]/gu, '').trim();
}

function extension(value: string) {
  const index = value.lastIndexOf('.');
  return index < 0 ? '' : value.slice(index).toLowerCase();
}

function initialTitle(fileName: string) {
  const suffix = extension(fileName);
  return (suffix ? fileName.slice(0, -suffix.length) : fileName).trim().slice(0, 200);
}

function validLabel(value: string, maxLength: number) {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength && !/[\x00-\x1f\x7f]/u.test(trimmed);
}

async function authorize(action: KnowledgeWriteAction): Promise<AllowedActor | 'forbidden' | null> {
  const resolution = await resolveInstitutionCustomerWriteAuthorizationV1();
  if (resolution.kind === 'forbidden') return 'forbidden';
  if (resolution.kind !== 'allowed') return null;
  const actor = consumeInstitutionCustomerWriteAuthorizationV1(resolution.authorization);
  if (!actor) return null;
  if (!isRoleInInstitutionSectionAudienceV1(actor.role, 'knowledge')) return 'forbidden';
  const decision = createInstitutionActionPolicyV1({}).authorize({
    objectType: 'knowledge_item',
    action,
    role: actor.role,
  });
  return isInstitutionActionPolicyAllowV1(decision) ? actor : 'forbidden';
}

async function readScopedDraft(
  database: TenantDatabase,
  actor: AllowedActor,
  uploadId: string,
) {
  const [row] = await database
    .select({
      draft: institutionKnowledgeUploadDrafts,
      fileName: knowledgeDocumentFiles.originalFilename,
      fileSize: knowledgeDocumentFiles.sizeBytes,
      mimeType: knowledgeDocumentFiles.mimeType,
      sectionCount: knowledgeDocumentFileParses.chunkCount,
    })
    .from(institutionKnowledgeUploadDrafts)
    .innerJoin(
      knowledgeDocumentFiles,
      and(
        eq(knowledgeDocumentFiles.tenantId, institutionKnowledgeUploadDrafts.tenantId),
        eq(knowledgeDocumentFiles.id, institutionKnowledgeUploadDrafts.fileId),
      ),
    )
    .innerJoin(
      knowledgeDocumentFileParses,
      and(
        eq(knowledgeDocumentFileParses.tenantId, institutionKnowledgeUploadDrafts.tenantId),
        eq(knowledgeDocumentFileParses.fileId, institutionKnowledgeUploadDrafts.fileId),
      ),
    )
    .where(and(
      eq(institutionKnowledgeUploadDrafts.tenantId, actor.tenantId),
      eq(institutionKnowledgeUploadDrafts.institutionId, actor.institutionId),
      eq(institutionKnowledgeUploadDrafts.id, uploadId),
    ))
    .limit(1);
  return row ?? null;
}

async function readyResult(
  database: TenantDatabase,
  actor: AllowedActor,
  uploadId: string,
): Promise<InstitutionKnowledgeUploadResultV1> {
  const row = await readScopedDraft(database, actor, uploadId);
  if (!row) return Object.freeze({ kind: 'invalid', code: 'knowledge_upload_not_found' });
  const chunks = await database
    .select({
      index: knowledgeDocumentFileParseChunks.chunkIndex,
      preview: knowledgeDocumentFileParseChunks.textPreview,
      charCount: knowledgeDocumentFileParseChunks.charCount,
    })
    .from(knowledgeDocumentFileParseChunks)
    .where(and(
      eq(knowledgeDocumentFileParseChunks.tenantId, actor.tenantId),
      eq(knowledgeDocumentFileParseChunks.knowledgeDocumentId, row.draft.knowledgeDocumentId),
      eq(knowledgeDocumentFileParseChunks.fileId, row.draft.fileId),
    ))
    .orderBy(asc(knowledgeDocumentFileParseChunks.chunkIndex))
    .limit(20);

  return Object.freeze({
    kind: 'ready' as const,
    upload: Object.freeze({
      uploadId: row.draft.id,
      knowledgeId: row.draft.knowledgeDocumentId,
      fileName: row.fileName,
      fileSize: row.fileSize,
      mimeType: row.mimeType,
      parserType: row.draft.parserType,
      warningCodes: Object.freeze([...(row.draft.warningCodes ?? [])]),
      title: row.draft.title,
      category: row.draft.category,
      state: row.draft.state as 'parsed' | 'confirmed' | 'published',
      revision: row.draft.revision,
      sectionCount: row.sectionCount,
      sections: Object.freeze(chunks.map((chunk) => Object.freeze(chunk))),
      publishedVersion: row.draft.publishedVersion,
      publishedAt: row.draft.publishedAt?.toISOString() ?? null,
    }),
  });
}

function authorizationFailure(actor: AllowedActor | 'forbidden' | null) {
  return actor === 'forbidden'
    ? Object.freeze({ kind: 'forbidden' as const, code: 'institution_knowledge_write_forbidden' })
    : Object.freeze({ kind: 'unavailable' as const, code: 'institution_knowledge_write_unavailable' });
}

export async function uploadCurrentInstitutionKnowledgeV1(input: Readonly<{
  fileName: string;
  mimeType: string;
  content: Uint8Array;
}>): Promise<InstitutionKnowledgeUploadResultV1> {
  const actor = await authorize('update');
  if (actor === 'forbidden' || !actor) return authorizationFailure(actor);
  const fileName = cleanFileName(input.fileName);
  if (
    !fileName
    || fileName.length > 255
    || !ALLOWED_EXTENSIONS.has(extension(fileName))
    || input.content.byteLength === 0
    || input.content.byteLength > INSTITUTION_KNOWLEDGE_FILE_MAX_BYTES
  ) {
    return Object.freeze({
      kind: 'invalid',
      code: 'invalid_knowledge_upload_file',
      message: '请选择 2 MB 以内的 PDF、DOCX、XLSX、Markdown、TXT 或 CSV 文件',
    });
  }

  const database = getDatabase();
  const fileSizeMb = Math.max(1, Math.ceil(input.content.byteLength / 1024 / 1024));
  for (const quota of [
    ['knowledge_items', 1],
    ['knowledge_files', 1],
    ['knowledge_single_file_size_mb', fileSizeMb],
    ['knowledge_total_storage_mb', fileSizeMb],
  ] as const) {
    const decision = await checkTenantQuotaForUsage({
      database,
      tenantId: actor.tenantId,
      resource: quota[0],
      quantity: quota[1],
    }).catch(() => null);
    if (!decision) {
      return Object.freeze({ kind: 'unavailable', code: 'knowledge_upload_quota_unavailable' });
    }
    if (!decision.allowed) {
      return Object.freeze({ kind: 'quota_denied', code: decision.reason });
    }
  }

  const uploadId = id('ku');
  const sourceId = id('ks');
  const knowledgeId = id('kd');
  const fileId = id('kf');
  const parsed = parseKnowledgeDocumentFile({
    fileName,
    mimeType: input.mimeType,
    buffer: input.content,
    tenantId: actor.tenantId,
    institutionId: actor.institutionId,
    knowledgeId,
    fileId,
  });
  if (parsed.status !== 'succeeded') {
    return Object.freeze({
      kind: 'invalid',
      code: parsed.failureReasonCode,
      message: parsed.safeMessage,
    });
  }

  const chunks = chunkV1KnowledgeBaseRuntimeDocument({ text: parsed.text });
  if (chunks.length === 0) {
    return Object.freeze({ kind: 'invalid', code: 'parse_empty_text', message: '文件未提取到可发布文本' });
  }

  const storage = createLocalPlatformKnowledgeFileStorage();
  const saved = await storage.save({
    tenantId: actor.tenantId,
    knowledgeId,
    fileId,
    originalFilename: fileName,
    mimeType: input.mimeType,
    content: input.content,
  });
  const now = new Date();
  const title = initialTitle(fileName);
  const category = '机构上传';

  try {
    await database.transaction(async (transaction) => {
      const scoped = transaction as unknown as TenantDatabase;
      await scoped.insert(knowledgeSources).values({
        id: sourceId,
        tenantId: actor.tenantId,
        institutionId: actor.institutionId,
        workspaceId: actor.institutionId,
        sourceKind: 'institution_upload',
        status: 'pending',
        readonlyStatus: 'blocked',
        sourceLabel: category,
      });
      await scoped.insert(knowledgeDocuments).values({
        id: knowledgeId,
        tenantId: actor.tenantId,
        institutionId: actor.institutionId,
        workspaceId: actor.institutionId,
        sourceId,
        sourceKind: 'institution_upload',
        status: 'pending',
        readonlyStatus: 'blocked',
        title,
        version: 'draft',
      });
      await scoped.insert(platformKnowledgeInstitutionVisibility).values({
        id: id('kv'),
        tenantId: actor.tenantId,
        knowledgeDocumentId: knowledgeId,
        institutionId: actor.institutionId,
      });
      await scoped.insert(knowledgeDocumentFiles).values({
        id: fileId,
        tenantId: actor.tenantId,
        knowledgeDocumentId: knowledgeId,
        originalFilename: fileName,
        storageKey: saved.storageKey,
        mimeType: input.mimeType,
        sizeBytes: saved.sizeBytes,
        sha256: saved.sha256,
        status: 'active',
        uploadedByUserId: actor.accountId,
        createdAt: now,
        updatedAt: now,
      });
      await scoped.insert(knowledgeDocumentFileParses).values({
        id: id('kp'),
        tenantId: actor.tenantId,
        knowledgeDocumentId: knowledgeId,
        fileId,
        parseStatus: 'succeeded',
        textContent: parsed.text,
        textLength: parsed.text.length,
        chunkCount: chunks.length,
        parserVersion: PLATFORM_KNOWLEDGE_PARSER_VERSION,
        createdAt: now,
        updatedAt: now,
      });
      await scoped.insert(knowledgeChunks).values(chunks.map((chunk) => ({
        id: id('kc'),
        tenantId: actor.tenantId,
        institutionId: actor.institutionId,
        workspaceId: actor.institutionId,
        documentId: knowledgeId,
        sourceKind: 'institution_upload' as const,
        status: 'pending' as const,
        readonlyStatus: 'blocked' as const,
        chunkLabel: `章节 ${chunk.chunkIndex + 1}`,
        chunkIndex: chunk.chunkIndex,
      })));
      await scoped.insert(knowledgeDocumentFileParseChunks).values(chunks.map((chunk) => ({
        id: id('kpc'),
        tenantId: actor.tenantId,
        knowledgeDocumentId: knowledgeId,
        fileId,
        chunkIndex: chunk.chunkIndex,
        textPreview: chunk.chunkText,
        charCount: chunk.charLength,
        createdAt: now,
        updatedAt: now,
      })));
      await scoped.insert(institutionKnowledgeUploadDrafts).values({
        id: uploadId,
        tenantId: actor.tenantId,
        institutionId: actor.institutionId,
        knowledgeDocumentId: knowledgeId,
        sourceId,
        fileId,
        state: 'parsed',
        title,
        category,
        fileDigest: saved.sha256,
        contentDigest: digest(parsed.text),
        parserType: parsed.parserType,
        warningCodes: parsed.warningCodes,
        revision: 1,
        createdBy: actor.accountId,
        createdAt: now,
        updatedAt: now,
      });
    });
  } catch {
    await storage.delete({ storageKey: saved.storageKey }).catch(() => undefined);
    return Object.freeze({ kind: 'unavailable', code: 'knowledge_upload_persistence_failed' });
  }

  return readyResult(database, actor, uploadId);
}

export async function readCurrentInstitutionKnowledgeUploadV1(
  uploadId: string,
): Promise<InstitutionKnowledgeUploadResultV1> {
  const actor = await authorize('update');
  if (actor === 'forbidden' || !actor) return authorizationFailure(actor);
  if (!uploadId || uploadId.length > 64 || INVALID_ID.test(uploadId)) {
    return Object.freeze({ kind: 'invalid', code: 'invalid_knowledge_upload_id' });
  }
  try {
    return await readyResult(getDatabase(), actor, uploadId);
  } catch {
    return Object.freeze({ kind: 'unavailable', code: 'knowledge_upload_read_failed' });
  }
}

export async function confirmCurrentInstitutionKnowledgeUploadV1(input: Readonly<{
  uploadId: string;
  expectedRevision: number;
  title: string;
  category: string;
}>): Promise<InstitutionKnowledgeUploadResultV1> {
  const actor = await authorize('update');
  if (actor === 'forbidden' || !actor) return authorizationFailure(actor);
  if (
    !input.uploadId || input.uploadId.length > 64 || INVALID_ID.test(input.uploadId)
    || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1
    || !validLabel(input.title, 200) || !validLabel(input.category, 160)
  ) {
    return Object.freeze({ kind: 'invalid', code: 'invalid_knowledge_confirmation' });
  }
  const database = getDatabase();
  try {
    const result = await database.transaction(async (transaction) => {
      const scoped = transaction as unknown as TenantDatabase;
      const [draft] = await scoped
        .update(institutionKnowledgeUploadDrafts)
        .set({
          state: 'confirmed',
          title: input.title.trim(),
          category: input.category.trim(),
          confirmedBy: actor.accountId,
          confirmedAt: new Date(),
          revision: input.expectedRevision + 1,
          updatedAt: new Date(),
        })
        .where(and(
          eq(institutionKnowledgeUploadDrafts.tenantId, actor.tenantId),
          eq(institutionKnowledgeUploadDrafts.institutionId, actor.institutionId),
          eq(institutionKnowledgeUploadDrafts.id, input.uploadId),
          eq(institutionKnowledgeUploadDrafts.state, 'parsed'),
          eq(institutionKnowledgeUploadDrafts.revision, input.expectedRevision),
        ))
        .returning();
      if (!draft) return null;
      await scoped.update(knowledgeDocuments).set({ title: draft.title, updatedAt: new Date() }).where(and(
        eq(knowledgeDocuments.tenantId, actor.tenantId),
        eq(knowledgeDocuments.id, draft.knowledgeDocumentId),
      ));
      await scoped.update(knowledgeSources).set({ sourceLabel: draft.category, updatedAt: new Date() }).where(and(
        eq(knowledgeSources.tenantId, actor.tenantId),
        eq(knowledgeSources.id, draft.sourceId),
      ));
      return draft;
    });
    if (!result) return Object.freeze({ kind: 'conflict', code: 'knowledge_confirmation_conflict' });
    return readyResult(database, actor, input.uploadId);
  } catch {
    return Object.freeze({ kind: 'unavailable', code: 'knowledge_confirmation_failed' });
  }
}

export async function publishCurrentInstitutionKnowledgeUploadV1(input: Readonly<{
  uploadId: string;
  expectedRevision: number;
}>): Promise<InstitutionKnowledgeUploadResultV1> {
  const actor = await authorize('approve');
  if (actor === 'forbidden' || !actor) return authorizationFailure(actor);
  if (
    !input.uploadId || input.uploadId.length > 64 || INVALID_ID.test(input.uploadId)
    || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1
  ) return Object.freeze({ kind: 'invalid', code: 'invalid_knowledge_publication' });

  const database = getDatabase();
  try {
    const published = await database.transaction(async (transaction) => {
      const scoped = transaction as unknown as TenantDatabase;
      await scoped.execute(sql`
        select pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtext('institution-knowledge-publish-v1'),
          pg_catalog.hashtext(${`${actor.tenantId}:${actor.institutionId}:${input.uploadId}`})
        )
      `);
      const row = await readScopedDraft(scoped, actor, input.uploadId);
      if (!row) return 'not_found' as const;
      if (row.draft.state === 'published') return 'published' as const;
      if (row.draft.state !== 'confirmed' || row.draft.revision !== input.expectedRevision) {
        return 'conflict' as const;
      }
      const now = new Date();
      const version = 1;
      await scoped.insert(knowledgeFormalSources).values({
        tenantId: actor.tenantId,
        institutionId: actor.institutionId,
        id: row.draft.sourceId,
        sourceLabel: row.draft.category,
        provenanceSource: 'institution_upload',
        provenanceReferenceDigest: row.draft.fileDigest,
        approvedBy: actor.accountId,
        approvedAt: now,
      });
      await scoped.insert(knowledgeFormalDocumentVersions).values({
        tenantId: actor.tenantId,
        institutionId: actor.institutionId,
        documentId: row.draft.knowledgeDocumentId,
        version,
        sourceId: row.draft.sourceId,
        title: row.draft.title,
        documentReferenceDigest: row.draft.contentDigest,
        publishedBy: actor.accountId,
        publishedAt: now,
      });
      await scoped.insert(knowledgeFormalDocumentPublications).values({
        tenantId: actor.tenantId,
        institutionId: actor.institutionId,
        documentId: row.draft.knowledgeDocumentId,
        currentVersion: version,
        status: 'published',
        revision: 1,
        updatedBy: actor.accountId,
        updatedAt: now,
      });
      await scoped.update(knowledgeDocuments).set({
        status: 'ready',
        readonlyStatus: 'readonly',
        version: `V${version}`,
        updatedAt: now,
      }).where(and(
        eq(knowledgeDocuments.tenantId, actor.tenantId),
        eq(knowledgeDocuments.id, row.draft.knowledgeDocumentId),
      ));
      await scoped.update(knowledgeSources).set({
        status: 'ready',
        readonlyStatus: 'readonly',
        updatedAt: now,
      }).where(and(
        eq(knowledgeSources.tenantId, actor.tenantId),
        eq(knowledgeSources.id, row.draft.sourceId),
      ));
      await scoped.update(knowledgeChunks).set({
        status: 'ready',
        readonlyStatus: 'readonly',
        updatedAt: now,
      }).where(and(
        eq(knowledgeChunks.tenantId, actor.tenantId),
        eq(knowledgeChunks.documentId, row.draft.knowledgeDocumentId),
      ));
      const [updated] = await scoped.update(institutionKnowledgeUploadDrafts).set({
        state: 'published',
        publishedBy: actor.accountId,
        publishedAt: now,
        publishedVersion: version,
        revision: row.draft.revision + 1,
        updatedAt: now,
      }).where(and(
        eq(institutionKnowledgeUploadDrafts.tenantId, actor.tenantId),
        eq(institutionKnowledgeUploadDrafts.institutionId, actor.institutionId),
        eq(institutionKnowledgeUploadDrafts.id, input.uploadId),
        eq(institutionKnowledgeUploadDrafts.state, 'confirmed'),
        eq(institutionKnowledgeUploadDrafts.revision, input.expectedRevision),
      )).returning({ id: institutionKnowledgeUploadDrafts.id });
      return updated ? 'published' as const : 'conflict' as const;
    });
    if (published === 'not_found') return Object.freeze({ kind: 'invalid', code: 'knowledge_upload_not_found' });
    if (published === 'conflict') return Object.freeze({ kind: 'conflict', code: 'knowledge_publication_conflict' });
    return readyResult(database, actor, input.uploadId);
  } catch {
    return Object.freeze({ kind: 'unavailable', code: 'knowledge_publication_failed' });
  }
}
