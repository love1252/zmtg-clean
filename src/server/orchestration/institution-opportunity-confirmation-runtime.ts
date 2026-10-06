import { createHash, randomUUID } from 'node:crypto';
import { opportunityConfirmationInputSchema, opportunityConfirmationSchema, type OpportunityConfirmationReadDto } from '@/modules/opportunities/application/opportunity-confirmation';
import { OPPORTUNITY_DEFINITIONS, OPPORTUNITY_RULE_VERSION, opportunityTypeForLifecycle, validOpportunitySource } from '@/modules/opportunities/domain/opportunity-candidate';
import { createOpportunityConfirmationRepository, type OpportunityConfirmationRow } from '@/modules/opportunities/server/opportunity-confirmation-repository';
import { getDatabase, type TenantDatabase } from '@/server/db/client';
import type { InstitutionCareWriteAuthorizationConsumptionV1 } from './institution-care-write-authorization';
import { authorizeInstitutionCustomerControlledWriteV1 } from './institution-customer-controlled-write-runtime';
import { authorizeInstitutionFormalFollowUpV1, createFormalFollowUpInTransactionV1, parseFormalFollowUpCreateV1, readFormalFollowUpForAuthorizedActorV1, resolveFormalFollowUpCreateAssignmentV1 } from './institution-formal-follow-up-runtime';
import { opportunitySourceVersionV1 } from './institution-opportunity-reader';
import { resolveInstitutionAuditWriterVerifiedAttributionV1 } from './institution-audit-writer-scope';
import { recordInstitutionHumanDecisionAudit } from './institution-human-decision-audit';

const failure = (kind: 'forbidden' | 'unavailable' | 'not_found' | 'invalid' | 'conflict') => ({ kind } as const);
const management = (actor: InstitutionCareWriteAuthorizationConsumptionV1) => actor.role === 'tenant_admin' || actor.role === 'tenant_operator';
const sameActor = (a: InstitutionCareWriteAuthorizationConsumptionV1, b: InstitutionCareWriteAuthorizationConsumptionV1) => a.accountId === b.accountId && a.role === b.role && a.tenantId === b.tenantId && a.institutionId === b.institutionId;
async function authorize(create: boolean) {
  const [customer, care] = await Promise.all([authorizeInstitutionCustomerControlledWriteV1(false), authorizeInstitutionFormalFollowUpV1(create)]);
  if (customer.kind !== 'allowed') return customer;
  if (care.kind !== 'allowed') return care;
  return sameActor(customer.actor, care.actor) ? care : failure('forbidden');
}
async function recordDto(database: TenantDatabase, actor: InstitutionCareWriteAuthorizationConsumptionV1, row: OpportunityConfirmationRow) {
  const task = await readFormalFollowUpForAuthorizedActorV1(database, actor, row.followUpTaskId);
  if (!task) return null;
  if (task.customer.customerId !== row.customerId) throw new Error('opportunity_task_customer_mismatch');
  return opportunityConfirmationSchema.parse({ id: row.id, customerId: row.customerId, opportunityType: row.opportunityType,
    label: OPPORTUNITY_DEFINITIONS[row.opportunityType].label, confirmedAt: row.confirmedAt.toISOString(), sourceUpdatedAt: row.sourceUpdatedAt.toISOString(), ruleVersion: row.ruleVersion,
    task: { taskId: task.taskId, state: task.state, revision: task.revision, dueAt: task.dueAt, updatedAt: task.updatedAt, completionCode: task.completionCode, cancellationReason: task.cancellationReason } });
}
async function replay(database: TenantDatabase, actor: InstitutionCareWriteAuthorizationConsumptionV1, row: OpportunityConfirmationRow, digest: string) {
  if (row.requestDigest !== digest) return failure('conflict');
  const record = await recordDto(database, actor, row);
  return record ? { kind: 'ready' as const, record, idempotent: true } : failure('not_found');
}

export async function readCurrentInstitutionOpportunityConfirmations(params: URLSearchParams) {
  try {
    const auth = await authorize(false); if (auth.kind !== 'allowed') return failure(auth.kind);
    const customerId = params.get('customerId');
    if (!customerId || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u.test(customerId) || [...params.keys()].some(key => key !== 'customerId' || params.getAll(key).length !== 1)) return failure('invalid');
    const actor = auth.actor;
    const createAuth = management(actor) ? await authorizeInstitutionFormalFollowUpV1(true) : null;
    const canConfirm = createAuth?.kind === 'allowed' && sameActor(actor, createAuth.actor);
    return await getDatabase().transaction(async transaction => {
      const db = transaction as unknown as TenantDatabase, repo = createOpportunityConfirmationRepository(db);
      const customer = await repo.customer(actor, customerId); if (!customer) return failure('not_found');
      const history = await repo.history(actor, customerId);
      const records = (await Promise.all(history.map(row => recordDto(db, actor, row)))).filter(row => row !== null);
      const type = opportunityTypeForLifecycle(customer.lifecycle);
      const candidate = type && !history.some(row => row.opportunityType === type) && validOpportunitySource(customer, actor, { page: 1, pageSize: 20, type: 'all', priority: null })
        ? { opportunityType: type, label: OPPORTUNITY_DEFINITIONS[type].label, basis: OPPORTUNITY_DEFINITIONS[type].basis, sourceVersion: opportunitySourceVersionV1(actor, customer), sourceUpdatedAt: customer.updatedAt.toISOString() } : null;
      const result: OpportunityConfirmationReadDto = { kind: 'ready', customerId, canConfirm, candidate, records };
      return result;
    }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
  } catch { return failure('unavailable'); }
}

export async function confirmCurrentInstitutionOpportunity(value: unknown) {
  try {
    const auth = await authorize(true); if (auth.kind !== 'allowed') return failure(auth.kind);
    const actor = auth.actor; if (!management(actor)) return failure('forbidden');
    const parsed = opportunityConfirmationInputSchema.safeParse(value); if (!parsed.success) return failure('invalid');
    const input = parsed.data;
    const command = parseFormalFollowUpCreateV1({ idempotencyKey: input.idempotencyKey, customerId: input.customerId, stageCode: 'manual_followup', actionCode: 'manual_contact', dueAt: input.dueAt, assignment: input.assignment });
    if (!command) return failure('invalid');
    const digest = createHash('sha256').update(JSON.stringify([OPPORTUNITY_RULE_VERSION, input.customerId, input.opportunityType, input.expectedSourceVersion, command.dueAt, command.assignment])).digest('hex');
    const database = getDatabase(), repo = createOpportunityConfirmationRepository(database);
    const existing = await repo.byKey(actor, input.idempotencyKey);
    if (existing) return await replay(database, actor, existing, digest);
    const assignment = await resolveFormalFollowUpCreateAssignmentV1(actor, command.assignment); if (!assignment) return failure('invalid');
    const attribution = await resolveInstitutionAuditWriterVerifiedAttributionV1(actor); if (!attribution) return failure('unavailable');
    try {
      return await database.transaction(async transaction => {
        const db = transaction as unknown as TenantDatabase, store = createOpportunityConfirmationRepository(db);
        // Serialize all confirmations for a customer before creating any task or audit.
        const customer = await store.customer(actor, input.customerId, true); if (!customer) return failure('not_found');
        const previous = await store.byKey(actor, input.idempotencyKey); if (previous) return replay(db, actor, previous, digest);
        if (await store.candidate(actor, input.customerId, input.opportunityType)) return failure('conflict');
        if (!validOpportunitySource(customer, actor, { page: 1, pageSize: 20, type: input.opportunityType, priority: null }) || opportunitySourceVersionV1(actor, customer) !== input.expectedSourceVersion) return failure('conflict');
        const confirmationId = randomUUID(), now = new Date();
        const task = await createFormalFollowUpInTransactionV1(db, actor, { ...command, idempotencyKey: `opp-confirm:${confirmationId}` }, { contractVersion: 'v1', customerId: customer.customerId, displayName: customer.displayName, maskedReference: null }, assignment, attribution);
        if (task.kind !== 'ready' || task.idempotent) throw new Error('opportunity_task_create_failed');
        const auditEventId = await recordInstitutionHumanDecisionAudit(db, actor, attribution, { resource: 'customer', resourceId: customer.customerId, reason: 'opportunity_confirmed', occurredAt: now });
        const row = await store.create({ id: confirmationId, tenantId: actor.tenantId, institutionId: actor.institutionId, customerId: customer.customerId,
          opportunityType: input.opportunityType, ruleVersion: OPPORTUNITY_RULE_VERSION, sourceVersion: input.expectedSourceVersion, sourceUpdatedAt: customer.updatedAt, sourceLifecycle: customer.lifecycle, sourcePriority: customer.priority,
          idempotencyKey: input.idempotencyKey, requestDigest: digest, confirmedBy: actor.accountId, confirmedRole: actor.role as 'tenant_admin' | 'tenant_operator', confirmedAt: now, followUpTaskId: task.record.taskId, auditEventId });
        const record = await recordDto(db, actor, row); if (!record) throw new Error('opportunity_task_not_visible');
        return { kind: 'ready' as const, record };
      });
    } catch {
      // A uniqueness race must roll back the losing task, event and audits before replay.
      const winner = await repo.byKey(actor, input.idempotencyKey);
      if (winner) return await replay(database, actor, winner, digest);
      if (await repo.candidate(actor, input.customerId, input.opportunityType)) return failure('conflict');
      return failure('unavailable');
    }
  } catch { return failure('unavailable'); }
}
