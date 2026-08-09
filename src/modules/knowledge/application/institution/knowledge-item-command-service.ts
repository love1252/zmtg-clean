export type KnowledgeItemCommandAttribution = Readonly<{ tenantId: string; institutionId: string }>;
export type CreateInstitutionKnowledgeItemCommand = Readonly<{ attribution: KnowledgeItemCommandAttribution; title: string; category?: string | null; description?: string | null }>;
export type UpdateInstitutionKnowledgeItemCommand = Readonly<{ attribution: KnowledgeItemCommandAttribution; knowledgeId: string; expectedUpdatedAt: string; title: string; category?: string | null; description?: string | null }>;
export type ArchiveInstitutionKnowledgeItemCommand = Readonly<{ attribution: KnowledgeItemCommandAttribution; knowledgeId: string; expectedUpdatedAt: string }>;
export type CreateInstitutionKnowledgeItemResult =
  | Readonly<{ kind: 'created'; sourceId: string; knowledgeId: string }>
  | Readonly<{ kind: 'invalid_reference'; reason: 'institution_not_found_or_inactive' }>;
export type UpdateInstitutionKnowledgeItemResult =
  | Readonly<{ kind: 'updated'; knowledgeId: string; updatedAt: string }>
  | Readonly<{ kind: 'not_found_or_not_owned' }>
  | Readonly<{ kind: 'conflict'; knowledgeId: string; reason: 'stale_update' }>;
export type ArchiveInstitutionKnowledgeItemResult =
  | Readonly<{ kind: 'archived'; knowledgeId: string; updatedAt: string }>
  | Readonly<{ kind: 'not_found_or_not_owned' }>
  | Readonly<{ kind: 'conflict'; knowledgeId: string; reason: 'stale_update' | 'invalid_state' }>;
export interface InstitutionKnowledgeCommandRepository {
  createItem(input: KnowledgeItemCommandAttribution & Readonly<{ title: string; category: string; description: string }>): Promise<CreateInstitutionKnowledgeItemResult>;
  updateItem(input: KnowledgeItemCommandAttribution & Readonly<{ knowledgeId: string; expectedUpdatedAt: string; title: string; category: string; description: string }>): Promise<UpdateInstitutionKnowledgeItemResult>;
  archiveItem(input: KnowledgeItemCommandAttribution & Readonly<{ knowledgeId: string; expectedUpdatedAt: string }>): Promise<ArchiveInstitutionKnowledgeItemResult>;
}
export class KnowledgeItemCommandInputError extends Error { constructor(message: string){ super(message); this.name='KnowledgeItemCommandInputError'; } }
function requireExactIdentifier(value: unknown, field: string){ if(typeof value!=='string'||value.length===0||value.trim()!==value) throw new KnowledgeItemCommandInputError(`invalid_${field}`); return value; }
function normalizeRequiredText(value: unknown, field: string, maxLength: number){ if(typeof value!=='string') throw new KnowledgeItemCommandInputError(`invalid_${field}`); const v=value.trim(); if(v.length===0||v.length>maxLength) throw new KnowledgeItemCommandInputError(`invalid_${field}`); return v; }
function normalizeOptionalText(value: unknown, field: string, maxLength: number, fallback: string){ if(value===null||value===undefined) return fallback; if(typeof value!=='string') throw new KnowledgeItemCommandInputError(`invalid_${field}`); const v=value.trim(); if(v.length===0) return fallback; if(v.length>maxLength) throw new KnowledgeItemCommandInputError(`invalid_${field}`); return v; }
function requireCanonicalIsoTimestamp(value: unknown){ if(typeof value!=='string'||value.length===0||value.trim()!==value) throw new KnowledgeItemCommandInputError('invalid_expected_updated_at'); const d=new Date(value); if(Number.isNaN(d.getTime())||d.toISOString()!==value) throw new KnowledgeItemCommandInputError('invalid_expected_updated_at'); return value; }
function normalizeAttribution(a: KnowledgeItemCommandAttribution): KnowledgeItemCommandAttribution { return { tenantId: requireExactIdentifier(a?.tenantId,'tenant_id'), institutionId: requireExactIdentifier(a?.institutionId,'institution_id') }; }
export function createKnowledgeItemCommandService(repository: InstitutionKnowledgeCommandRepository){ return Object.freeze({
  async createInstitutionKnowledgeItem(input: CreateInstitutionKnowledgeItemCommand){ return repository.createItem({ ...normalizeAttribution(input.attribution), title: normalizeRequiredText(input.title,'title',200), category: normalizeOptionalText(input.category,'category',160,'未分类'), description: normalizeOptionalText(input.description,'description',64,'v1') }); },
  async updateInstitutionKnowledgeItem(input: UpdateInstitutionKnowledgeItemCommand){ return repository.updateItem({ ...normalizeAttribution(input.attribution), knowledgeId: requireExactIdentifier(input.knowledgeId,'knowledge_id'), expectedUpdatedAt: requireCanonicalIsoTimestamp(input.expectedUpdatedAt), title: normalizeRequiredText(input.title,'title',200), category: normalizeOptionalText(input.category,'category',160,'未分类'), description: normalizeOptionalText(input.description,'description',64,'v1') }); },
  async archiveInstitutionKnowledgeItem(input: ArchiveInstitutionKnowledgeItemCommand){ return repository.archiveItem({ ...normalizeAttribution(input.attribution), knowledgeId: requireExactIdentifier(input.knowledgeId,'knowledge_id'), expectedUpdatedAt: requireCanonicalIsoTimestamp(input.expectedUpdatedAt) }); },
}); }
