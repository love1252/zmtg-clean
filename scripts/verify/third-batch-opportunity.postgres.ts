import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { actor, isolatedFixture } from './third-batch-postgres-fixture';
const mocks = vi.hoisted(() => ({ customer: vi.fn(), auth: vi.fn(), consume: vi.fn(), capability: vi.fn(), database: vi.fn(), attribution: vi.fn() }));
vi.mock('@/server/orchestration/institution-customer-controlled-write-runtime', () => ({ authorizeInstitutionCustomerControlledWriteV1: mocks.customer }));
vi.mock('@/server/orchestration/institution-care-write-authorization', () => ({ resolveInstitutionCareWriteAuthorizationV1: mocks.auth, consumeInstitutionCareWriteAuthorizationV1: mocks.consume }));
vi.mock('@/server/orchestration/institution-capability-authority', () => ({ resolveInstitutionCapabilityAuthorityStatusV1: mocks.capability }));
vi.mock('@/server/db/client', () => ({ getDatabase: mocks.database }));
vi.mock('@/server/orchestration/institution-audit-writer-scope', () => ({ resolveInstitutionAuditWriterVerifiedAttributionV1: mocks.attribution }));
import { confirmCurrentInstitutionOpportunity as confirm, readCurrentInstitutionOpportunityConfirmations as read } from '@/server/orchestration/institution-opportunity-confirmation-runtime';
import { mutateCurrentInstitutionFormalFollowUpV1 as mutate, createCurrentInstitutionFormalFollowUpV1 as createFollowUp } from '@/server/orchestration/institution-formal-follow-up-runtime';
import { mintVerifiedInstitutionAuditAttributionForOrchestrationV1 } from '@/modules/audit/domain/audit-events';

const fixture = isolatedFixture(), query = new URLSearchParams('customerId=test-customer');
function capability(create = true) {
  const keys = ['page_care_followups', ...(create ? ['action_care_followup_create'] : [])];
  return { contractVersion: 'v1', scope: actor, readiness: 'ready', failureCode: null,
    data: { capabilities: keys.map(key => ({ key, decision: 'operational', safeSummary: key === 'page_care_followups' ? '随访任务可用' : null, dimensions: { codeMaturity: 'verified', institutionAuthorization: 'authorized', connectionAvailability: 'not_required', dataReadiness: 'ready', productionRelease: 'pilot_released' } })) },
    partitions: keys.map(key => ({ key, readiness: 'ready', failureCode: null })) };
}
async function input(key = 'opportunity-key-1') {
  const result = await read(query); if (result.kind !== 'ready' || !('candidate' in result) || !result.candidate) throw new Error('missing_candidate');
  return { idempotencyKey: key, customerId: 'test-customer', opportunityType: result.candidate.opportunityType, expectedSourceVersion: result.candidate.sourceVersion,
    dueAt: '2026-10-08T00:00:00.000Z', assignment: { kind: 'role_pool', role: 'tenant_admin' } };
}
async function counts() { const [row] = await fixture.sql`select (select count(*)::int from institution_opportunity_confirmations) confirmations, (select count(*)::int from care_formal_follow_up_tasks) tasks, (select count(*)::int from care_formal_follow_up_events) events, (select count(*)::int from audit_events) audits`; return row; }
beforeEach(async () => {
  vi.resetAllMocks(); await fixture.seed();
  mocks.customer.mockResolvedValue({ kind: 'allowed', actor }); mocks.auth.mockResolvedValue({ kind: 'allowed', authorization: {} }); mocks.consume.mockReturnValue(actor);
  mocks.capability.mockResolvedValue(capability()); mocks.database.mockReturnValue(fixture.database); mocks.attribution.mockImplementation(fixture.attribution);
});
afterAll(async () => { await fixture.seed(); await fixture.sql.end(); });
describe('机会确认隔离 PostgreSQL 闭环', () => {
  it('创建确认、任务、事件和两条审计，并展示后续正式完成结果', async () => {
    const result = await confirm(await input()); expect(result.kind).toBe('ready'); if (!('record' in result)) throw new Error('missing_record');
    expect(await counts()).toEqual({ confirmations: 1, tasks: 1, events: 1, audits: 2 });
    const id = result.record.task.taskId;
    expect(await mutate(id, { command: 'claim', expectedRevision: 1 })).toMatchObject({ kind: 'ready', record: { revision: 2 } });
    expect(await mutate(id, { command: 'transition', expectedRevision: 2, targetState: 'in_progress' })).toMatchObject({ kind: 'ready', record: { revision: 3 } });
    expect(await mutate(id, { command: 'complete', expectedRevision: 3, code: 'contact_completed', feedback: null })).toMatchObject({ kind: 'ready', record: { state: 'completed' } });
    const history = await read(query); expect(history).toMatchObject({ candidate: null, records: [{ task: { state: 'completed', completionCode: 'contact_completed' } }] });
    for (const field of ['requestDigest', 'idempotencyKey', 'completionFeedback', 'confirmedBy', 'tenantId', 'institutionId']) expect(JSON.stringify(history)).not.toContain(field);
    expect((await fixture.sql`select lifecycle from customers`)[0].lifecycle).toBe('post_care');
  });
  it('机构运营可确认，普通员工只能读取可见任务且不能创建', async () => {
    const operator = { ...actor, role: 'tenant_operator' as const };
    mocks.customer.mockResolvedValue({ kind: 'allowed', actor: operator }); mocks.consume.mockReturnValue(operator);
    mocks.attribution.mockImplementation(() => mintVerifiedInstitutionAuditAttributionForOrchestrationV1({ formalPair: operator, businessPair: operator }));
    expect(await read(query)).toMatchObject({ canConfirm: true }); const body = await input(); expect(await confirm(body)).toMatchObject({ kind: 'ready' });
    const consultant = { ...actor, role: 'consultant' }; mocks.customer.mockResolvedValue({ kind: 'allowed', actor: consultant }); mocks.consume.mockReturnValue(consultant);
    expect(await read(query)).toMatchObject({ canConfirm: false, records: [] }); expect(await confirm(body)).toEqual({ kind: 'forbidden' });
  });
  it('关闭创建能力时保留只读，POST不写库', async () => {
    const body = await input(); mocks.capability.mockResolvedValue(capability(false));
    expect(await read(query)).toMatchObject({ canConfirm: false }); expect(await confirm(body)).toEqual({ kind: 'unavailable' }); expect((await counts()).tasks).toBe(0);
  });
  it('相同请求重放不依赖新来源或新审计归属，不重复建任务', async () => {
    const body = await input(), first = await confirm(body); await fixture.sql`update customers set lifecycle='consulting', updated_at=now()`; mocks.attribution.mockResolvedValue(null);
    const again = await confirm(body); expect(again).toMatchObject({ ...first, idempotent: true }); expect(await counts()).toEqual({ confirmations: 1, tasks: 1, events: 1, audits: 2 });
    expect(await confirm({ ...body, dueAt: '2026-10-09T00:00:00.000Z' })).toEqual({ kind: 'conflict' });
  });
  it.each(['same_key', 'different_key'])('并发%s只创建一次', async variant => {
    const body = await input(); const results = await Promise.all([confirm(body), confirm({ ...body, idempotencyKey: variant === 'same_key' ? body.idempotencyKey : 'opportunity-key-2' })]);
    expect(results.map(row => row.kind).sort()).toEqual(variant === 'same_key' ? ['ready', 'ready'] : ['conflict', 'ready']);
    expect(await counts()).toEqual({ confirmations: 1, tasks: 1, events: 1, audits: 2 });
  });
  it.each(['timestamp', 'lifecycle', 'priority'])('%s变化后旧候选禁止写入', async kind => {
    const body = await input();
    if (kind === 'timestamp') await fixture.sql`update customers set updated_at=updated_at+interval '1 second'`;
    if (kind === 'lifecycle') await fixture.sql`update customers set lifecycle='consulting'`;
    if (kind === 'priority') await fixture.sql`update customers set priority='medium'`;
    expect(await confirm(body)).toEqual({ kind: 'conflict' }); expect(await counts()).toEqual({ confirmations: 0, tasks: 0, events: 0, audits: 0 });
  });
  it('普通主档更新不产生新轮次，每客户每类型只确认一次', async () => {
    const body = await input(); await confirm(body); await fixture.sql`update customers set updated_at=now()`;
    expect(await read(query)).toMatchObject({ candidate: null }); expect(await confirm({ ...body, idempotencyKey: 'opportunity-key-2' })).toEqual({ kind: 'conflict' });
    await fixture.sql`update customers set lifecycle='repurchase_window'`;
    expect(await confirm(await input('opportunity-key-3'))).toMatchObject({ kind: 'ready', record: { opportunityType: 'repurchase' } });
    expect((await counts()).tasks).toBe(2);
  });
  it.each(['care_follow_up_created', 'opportunity_confirmed'])('%s审计故障回滚整笔写入', async reason => {
    const body = await input(); await fixture.sql.unsafe(`alter table audit_events add constraint synthetic_fail_audit check (reason <> '${reason}')`);
    expect(await confirm(body)).toEqual({ kind: 'unavailable' }); expect(await counts()).toEqual({ confirmations: 0, tasks: 0, events: 0, audits: 0 });
  });
  it('取消结果读取自正式随访', async () => {
    const result = await confirm(await input()); if (!('record' in result)) throw new Error('missing_record');
    expect(await mutate(result.record.task.taskId, { command: 'cancel', expectedRevision: 1, reason: 'customer_requested_stop' })).toMatchObject({ kind: 'ready' });
    expect(await read(query)).toMatchObject({ records: [{ task: { state: 'cancelled', cancellationReason: 'customer_requested_stop' } }] });
  });
  it.each(['accountId', 'role', 'institutionId', 'tenantId'])('双授权%s不一致时不读取数据库', async key => {
    mocks.customer.mockResolvedValue({ kind: 'allowed', actor: { ...actor, [key]: 'other' } });
    expect(await read(query)).toEqual({ kind: 'forbidden' }); expect(mocks.database).not.toHaveBeenCalled();
  });
  it('拒绝伪造字段、越界客户、损坏参数及不可分配角色', async () => {
    const body = await input(); expect(await confirm({ ...body, tenantId: 'forged' })).toEqual({ kind: 'invalid' });
    expect(await confirm({ ...body, customerId: 'other-customer' })).toEqual({ kind: 'not_found' });
    expect(await confirm({ ...body, assignment: { kind: 'role_pool', role: 'platform_admin' } })).toEqual({ kind: 'invalid' });
    expect(await read(new URLSearchParams('customerId=test-customer&customerId=other'))).toEqual({ kind: 'invalid' });
    expect((await counts()).tasks).toBe(0);
  });
  it('手工创建入口保持幂等重放，不因审计归属暂不可用而丢失成功结果', async () => {
    const body = { idempotencyKey: 'manual-create-1', customerId: 'test-customer', stageCode: 'manual_followup', actionCode: 'manual_contact', dueAt: '2026-10-08T00:00:00.000Z', assignment: { kind: 'role_pool', role: 'tenant_admin' } };
    const first = await createFollowUp(body); expect(first.kind).toBe('ready'); mocks.attribution.mockResolvedValue(null);
    expect(await createFollowUp(body)).toEqual({ ...first, idempotent: true }); expect((await counts()).tasks).toBe(1);
  });
  it('不同客户并发占用同一确认键，败方的任务与审计完整回滚', async () => {
    const first = await input();
    await fixture.sql`insert into customers select 'other-customer',tenant_id,institution_id,display_name,lifecycle,priority,owner_user_id,project_interest,masked_phone,masked_medical_record_no,last_touch_summary,next_action,tags,gender,birth_date,referral_source,notes,created_at,updated_at from customers where id='test-customer'`;
    const other = await read(new URLSearchParams('customerId=other-customer')); if (!('candidate' in other) || !other.candidate) throw new Error('missing_candidate');
    const results = await Promise.all([confirm(first), confirm({ ...first, customerId: 'other-customer', expectedSourceVersion: other.candidate.sourceVersion })]);
    expect(results.map(row => row.kind).sort()).toEqual(['conflict', 'ready']); expect(await counts()).toEqual({ confirmations: 1, tasks: 1, events: 1, audits: 2 });
  });
  it('机构边界隔离，不可读取或确认其他机构的客户', async () => {
    const body = await input(); await fixture.sql`insert into institution_scopes select tenant_id,'other-institution',status,revision,provisioning_source,provisioning_reference_digest,approved_by,approved_at,created_at,updated_at from institution_scopes`;
    await fixture.sql`update customers set institution_id='other-institution'`;
    expect(await read(query)).toEqual({ kind: 'not_found' }); expect(await confirm(body)).toEqual({ kind: 'not_found' }); expect((await counts()).tasks).toBe(0);
  });
});
