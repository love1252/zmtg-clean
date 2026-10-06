import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { isLowSensitiveCustomerText } from '@/modules/customer-center/domain/customer-query';
import type { CustomerProfileReadDto, CustomerProfileSuggestionDto } from '@/modules/customers/application/customer-profile-suggestion';
import { createCustomerProfileSuggestionRepository, type ProfileSuggestionRow } from '@/modules/customers/server/customer-profile-suggestion-repository';
import { getDatabase, type TenantDatabase } from '@/server/db/client';
import { authorizeInstitutionCustomerControlledWriteV1 } from './institution-customer-controlled-write-runtime';
import { authorizeInstitutionAppointmentControlledV1 } from './institution-appointment-controlled-write-runtime';
import { resolveInstitutionAuditWriterVerifiedAttributionV1 } from './institution-audit-writer-scope';
import { recordInstitutionHumanDecisionAudit } from './institution-human-decision-audit';

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u);
const instant = z.string().refine(value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
const generateSchema = z.object({ appointmentId: id, expectedCustomerUpdatedAt: instant, expectedSourceUpdatedAt: instant }).strict();
const decisionSchema = z.object({ command: z.enum(['accept', 'reject']), expectedRevision: z.literal(1) }).strict();
const failure = (kind: 'forbidden' | 'unavailable' | 'not_found' | 'invalid' | 'conflict') => ({ kind } as const);
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
type Source = NonNullable<Awaited<ReturnType<ReturnType<typeof createCustomerProfileSuggestionRepository>['source']>>>;
const safeProject = (value: string) => value === value.trim() && [...value].length <= 120 && !/[\u0000-\u001f\u007f]/u.test(value) && isLowSensitiveCustomerText(value);
const sourceVersion = (scope: { tenantId: string; institutionId: string; customerId: string }, source: Source) => hash([scope.tenantId, scope.institutionId, scope.customerId, source.id, source.project, source.status, source.scheduledAt.toISOString(), source.updatedAt.toISOString()]);
function toDto(row: ProfileSuggestionRow, now = new Date()): CustomerProfileSuggestionDto {
  if (!safeProject(row.proposedValue) || row.fieldName !== 'projectInterest' || row.sourceStatus !== 'confirmed') throw new Error('invalid_profile_suggestion');
  return {
    id: row.id, customerId: row.customerId, fieldName: 'projectInterest', beforeValue: row.beforeValue, proposedValue: row.proposedValue,
    state: row.state === 'pending' && row.expiresAt <= now ? 'expired' : row.state, revision: row.revision, ruleVersion: row.ruleVersion,
    createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString(), decidedAt: row.decidedAt?.toISOString() ?? null, reasonCode: row.reasonCode,
    source: { appointmentId: row.sourceAppointmentId, project: row.sourceProject, status: 'confirmed', scheduledAt: row.sourceScheduledAt.toISOString(), updatedAt: row.sourceUpdatedAt.toISOString() },
  };
}
async function authorize() {
  const [customer, appointment] = await Promise.all([authorizeInstitutionCustomerControlledWriteV1(false), authorizeInstitutionAppointmentControlledV1(false)]);
  if (customer.kind !== 'allowed') return customer;
  if (appointment.kind !== 'allowed') return appointment;
  if (['accountId', 'tenantId', 'institutionId', 'role'].some(key => customer.actor[key as keyof typeof customer.actor] !== appointment.actor[key as keyof typeof appointment.actor])) return failure('forbidden');
  return customer;
}
function page(params: URLSearchParams, name: string) {
  const value = params.get(name) ?? '1';
  return /^[1-9][0-9]*$/u.test(value) && Number(value) <= 100 ? Number(value) : null;
}

export async function readCurrentInstitutionCustomerProfile(customerId: string, params = new URLSearchParams()) {
  try {
    const auth = await authorize(); if (auth.kind !== 'allowed') return failure(auth.kind);
    if (!id.safeParse(customerId).success) return failure('not_found');
    const suggestionPage = page(params, 'suggestionPage'), sourcePage = page(params, 'sourcePage');
    if (!suggestionPage || !sourcePage || [...params.keys()].some(key => !['suggestionPage', 'sourcePage'].includes(key) || params.getAll(key).length !== 1)) return failure('invalid');
    const scope = { ...auth.actor, customerId };
    return await getDatabase().transaction(async transaction => {
      const repo = createCustomerProfileSuggestionRepository(transaction as unknown as TenantDatabase);
      const customer = await repo.customer(scope); if (!customer) return failure('not_found');
      const records = await repo.list(scope, suggestionPage);
      const sources = customer.projectInterest === '' ? await repo.sources(scope, sourcePage) : [];
      const result: CustomerProfileReadDto = {
        kind: 'ready', customerId, projectInterest: customer.projectInterest, customerUpdatedAt: customer.updatedAt.toISOString(),
        records: records.slice(0, 20).map(row => toDto(row)), sources: sources.slice(0, 20).filter(row => safeProject(row.project)).map(row => ({ appointmentId: row.id, project: row.project, scheduledAt: row.scheduledAt.toISOString(), updatedAt: row.updatedAt.toISOString() })),
        suggestionPage, sourcePage, hasMoreSuggestions: records.length > 20, hasMoreSources: sources.length > 20,
      };
      return result;
    }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
  } catch { return failure('unavailable'); }
}

export async function generateCurrentInstitutionCustomerProfile(customerId: string, value: unknown) {
  try {
    const auth = await authorize(); if (auth.kind !== 'allowed') return failure(auth.kind);
    const parsed = generateSchema.safeParse(value);
    if (!id.safeParse(customerId).success || !parsed.success) return failure('invalid');
    const actor = auth.actor, scope = { ...actor, customerId }, input = parsed.data;
    const attribution = await resolveInstitutionAuditWriterVerifiedAttributionV1(actor); if (!attribution) return failure('unavailable');
    return await getDatabase().transaction(async transaction => {
      const db = transaction as unknown as TenantDatabase, repo = createCustomerProfileSuggestionRepository(db);
      const customer = await repo.customer(scope, true); if (!customer) return failure('not_found');
      const source = await repo.source(scope, input.appointmentId, true); if (!source) return failure('not_found');
      const version = sourceVersion(scope, source);
      const fingerprint = hash(['appointment-project.v1', version, input.expectedCustomerUpdatedAt, 'projectInterest']);
      const existing = await repo.byFingerprint(scope, fingerprint);
      if (existing) return { kind: 'ready' as const, record: toDto(existing), idempotent: true };
      if (customer.projectInterest !== '' || customer.updatedAt.toISOString() !== input.expectedCustomerUpdatedAt || source.updatedAt.toISOString() !== input.expectedSourceUpdatedAt || source.status !== 'confirmed') return failure('conflict');
      if (!safeProject(source.project)) return failure('invalid');
      const now = new Date();
      const creationAuditEventId = await recordInstitutionHumanDecisionAudit(db, actor, attribution, { resource: 'customer', resourceId: customerId, reason: 'customer_profile_suggestion_created', occurredAt: now });
      const row = await repo.create({ id: randomUUID(), tenantId: actor.tenantId, institutionId: actor.institutionId, customerId, fieldName: 'projectInterest', beforeValue: '', proposedValue: source.project,
        sourceAppointmentId: source.id, sourceProject: source.project, sourceStatus: 'confirmed', sourceScheduledAt: source.scheduledAt, sourceUpdatedAt: source.updatedAt, sourceVersion: version,
        customerUpdatedAt: customer.updatedAt, ruleVersion: 'appointment-project.v1', fingerprint, createdBy: actor.accountId, createdAt: now, expiresAt: new Date(now.getTime() + 7 * 86400000), creationAuditEventId });
      if (!row) throw new Error('profile_create_failed');
      return { kind: 'ready' as const, record: toDto(row) };
    });
  } catch { return failure('unavailable'); }
}

export async function decideCurrentInstitutionCustomerProfile(customerId: string, suggestionId: string, value: unknown) {
  try {
    const auth = await authorize(); if (auth.kind !== 'allowed') return failure(auth.kind);
    const parsed = decisionSchema.safeParse(value);
    if (!id.safeParse(customerId).success || !id.safeParse(suggestionId).success || !parsed.success) return failure('invalid');
    const actor = auth.actor, scope = { ...actor, customerId }, input = parsed.data;
    const attribution = await resolveInstitutionAuditWriterVerifiedAttributionV1(actor); if (!attribution) return failure('unavailable');
    return await getDatabase().transaction(async transaction => {
      const db = transaction as unknown as TenantDatabase, repo = createCustomerProfileSuggestionRepository(db);
      const customer = await repo.customer(scope, true); if (!customer) return failure('not_found');
      const initial = await repo.get(scope, suggestionId); if (!initial) return failure('not_found');
      // All commands acquire locks in customer -> appointment -> suggestion order.
      const source = await repo.source(scope, initial.sourceAppointmentId, true);
      const current = await repo.get(scope, suggestionId, true); if (!current) return failure('not_found');
      const wanted = input.command === 'accept' ? 'applied' : 'rejected';
      if (current.state !== 'pending') return current.state === wanted || current.state === 'expired'
        ? { kind: 'ready' as const, record: toDto(current), idempotent: true } : failure('conflict');
      if (current.revision !== input.expectedRevision) return failure('conflict');
      const now = new Date(Math.max(Date.now(), current.createdAt.getTime()));
      const stale = !source || source.status !== 'confirmed' || sourceVersion(scope, source) !== current.sourceVersion
        || customer.projectInterest !== current.beforeValue || customer.updatedAt.getTime() !== current.customerUpdatedAt.getTime();
      const state = current.expiresAt <= now || (input.command === 'accept' && stale) ? 'expired' : wanted;
      if (state === 'applied' && !safeProject(current.proposedValue)) throw new Error('invalid_profile_project');
      const appliedCustomerUpdatedAt = state === 'applied' ? await repo.applyProject(scope, current.customerUpdatedAt, current.proposedValue) : null;
      const reason = state === 'applied' ? 'customer_profile_suggestion_applied' : state === 'rejected' ? 'customer_profile_suggestion_rejected' : 'customer_profile_suggestion_expired';
      const decisionAuditEventId = await recordInstitutionHumanDecisionAudit(db, actor, attribution, { resource: 'customer', resourceId: customerId, reason, occurredAt: now });
      const row = await repo.decide(scope, suggestionId, { state, revision: 2, decidedBy: actor.accountId, decidedRole: actor.role, decidedAt: now, decisionAuditEventId, appliedCustomerUpdatedAt,
        reasonCode: state === 'expired' ? (current.expiresAt <= now ? 'expired' : 'source_or_customer_changed') : input.command });
      return { kind: 'ready' as const, record: toDto(row) };
    });
  } catch { return failure('unavailable'); }
}
