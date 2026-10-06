import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { actor, isolatedFixture } from './third-batch-postgres-fixture';
const mocks = vi.hoisted(() => ({ customerAuth: vi.fn(), appointmentAuth: vi.fn(), database: vi.fn(), attribution: vi.fn() }));
vi.mock('@/server/orchestration/institution-customer-controlled-write-runtime', () => ({ authorizeInstitutionCustomerControlledWriteV1: mocks.customerAuth }));
vi.mock('@/server/orchestration/institution-appointment-controlled-write-runtime', () => ({ authorizeInstitutionAppointmentControlledV1: mocks.appointmentAuth }));
vi.mock('@/server/db/client', () => ({ getDatabase: mocks.database }));
vi.mock('@/server/orchestration/institution-audit-writer-scope', () => ({ resolveInstitutionAuditWriterVerifiedAttributionV1: mocks.attribution }));
import { readCurrentInstitutionCustomerProfile as read, generateCurrentInstitutionCustomerProfile as generate, decideCurrentInstitutionCustomerProfile as decide } from '@/server/orchestration/institution-customer-profile-runtime';

const fixture = isolatedFixture();
const input = { appointmentId: 'test-appointment', expectedCustomerUpdatedAt: '2026-10-06T00:00:00.000Z', expectedSourceUpdatedAt: '2026-10-06T00:00:00.000Z' };
const decision = (command = 'accept') => ({ command, expectedRevision: 1 });
async function create() { const result = await generate('test-customer', input); expect(result.kind).toBe('ready'); if (!('record' in result)) throw new Error('missing_record'); return result.record; }
beforeEach(async () => {
  vi.resetAllMocks(); await fixture.seed();
  mocks.customerAuth.mockResolvedValue({ kind: 'allowed', actor }); mocks.appointmentAuth.mockResolvedValue({ kind: 'allowed', actor });
  mocks.database.mockReturnValue(fixture.database); mocks.attribution.mockImplementation(fixture.attribution);
});
afterAll(async () => { await fixture.seed(); await fixture.sql.end(); });
describe('画像建议隔离 PostgreSQL 闭环', () => {
  it('来源查询、生成、接受更新及历史读取，兼容数据库微秒版本', async () => {
    const before = await read('test-customer'); expect(before).toMatchObject({ kind: 'ready', sources: [{ project: 'Skin care' }], records: [] });
    const row = await create(); expect(await decide('test-customer', row.id, decision())).toMatchObject({ kind: 'ready', record: { state: 'applied', revision: 2 } });
    const [customer] = await fixture.sql`select project_interest, updated_at from customers where id='test-customer'`;
    expect(customer.project_interest).toBe('Skin care'); expect(new Date(customer.updated_at).getTime()).toBeGreaterThan(Date.parse(input.expectedCustomerUpdatedAt));
    expect(await read('test-customer')).toMatchObject({ projectInterest: 'Skin care', sources: [], records: [{ state: 'applied' }] });
    expect((await fixture.sql`select * from audit_events`).length).toBe(2);
  });
  it('拒绝及重复生成保留原建议，不更新客户', async () => {
    const row = await create(); await decide('test-customer', row.id, decision('reject'));
    expect(await generate('test-customer', input)).toMatchObject({ idempotent: true, record: { id: row.id, state: 'rejected' } });
    expect((await fixture.sql`select project_interest from customers`)[0].project_interest).toBe('');
    expect((await fixture.sql`select * from customer_profile_suggestions`).length).toBe(1);
  });
  it.each(['project', 'status', 'scheduled', 'customer'])('%s变化使接受失效', async change => {
    const row = await create();
    if (change === 'project') await fixture.sql`update appointments set project='Changed'`;
    if (change === 'status') await fixture.sql`update appointments set status='pending_confirmation'`;
    if (change === 'scheduled') await fixture.sql`update appointments set scheduled_at=scheduled_at+interval '1 day'`;
    if (change === 'customer') await fixture.sql`update customers set project_interest='Manual'`;
    expect(await decide('test-customer', row.id, decision())).toMatchObject({ kind: 'ready', record: { state: 'expired', reasonCode: 'source_or_customer_changed' } });
    expect((await fixture.sql`select project_interest from customers`)[0].project_interest).not.toBe('Skin care');
  });
  it('过期GET不写库，决定保存失效；同来源不自动续期', async () => {
    const row = await create(); await fixture.sql`update customer_profile_suggestions set created_at=now()-interval '9 days', expires_at=now()-interval '2 days'`;
    expect(await read('test-customer')).toMatchObject({ records: [{ state: 'expired' }] });
    expect((await fixture.sql`select state from customer_profile_suggestions`)[0].state).toBe('pending');
    expect(await generate('test-customer', input)).toMatchObject({ idempotent: true, record: { id: row.id, state: 'expired' } });
    expect(await decide('test-customer', row.id, decision())).toMatchObject({ record: { state: 'expired', revision: 2 } });
  });
  it('并发生成只创建一个建议和一条审计', async () => {
    const results = await Promise.all([generate('test-customer', input), generate('test-customer', input)]);
    expect(results.every(result => result.kind === 'ready')).toBe(true);
    expect((await fixture.sql`select * from customer_profile_suggestions`).length).toBe(1); expect((await fixture.sql`select * from audit_events`).length).toBe(1);
  });
  it('并发接受只应用一次，重复同向决定不追加审计，相反决定冲突', async () => {
    const row = await create(); const results = await Promise.all([decide('test-customer', row.id, decision()), decide('test-customer', row.id, decision())]);
    expect(results.every(result => result.kind === 'ready')).toBe(true); expect(results.filter(result => 'idempotent' in result)).toHaveLength(1);
    expect(await decide('test-customer', row.id, decision('reject'))).toEqual({ kind: 'conflict' });
    expect((await fixture.sql`select * from audit_events`).length).toBe(2);
  });
  it('并发接受和拒绝仅一方成功', async () => {
    const row = await create(); const results = await Promise.all([decide('test-customer', row.id, decision()), decide('test-customer', row.id, decision('reject'))]);
    expect(results.map(result => result.kind).sort()).toEqual(['conflict', 'ready']);
    expect((await fixture.sql`select * from audit_events`).length).toBe(2);
  });
  it('审计故障回滚客户更新和建议决定', async () => {
    const row = await create(); await fixture.sql`alter table audit_events add constraint synthetic_fail_audit check (reason <> 'customer_profile_suggestion_applied')`;
    expect(await decide('test-customer', row.id, decision())).toEqual({ kind: 'unavailable' });
    expect((await fixture.sql`select project_interest from customers`)[0].project_interest).toBe('');
    expect((await fixture.sql`select state, revision from customer_profile_suggestions`)[0]).toMatchObject({ state: 'pending', revision: 1 });
    expect((await fixture.sql`select * from audit_events`).length).toBe(1);
  });
  it.each(['institution', 'customer'])('跨%s预约拒绝', async change => {
    if (change === 'institution') await fixture.sql`update appointments set institution_id='other-institution'`;
    else await fixture.sql`update appointments set customer_id='other-customer'`.catch(async () => {
      await fixture.sql`insert into customers select 'other-customer',tenant_id,institution_id,display_name,lifecycle,priority,owner_user_id,project_interest,masked_phone,masked_medical_record_no,last_touch_summary,next_action,tags,gender,birth_date,referral_source,notes,created_at,updated_at from customers where id='test-customer'`;
      await fixture.sql`update appointments set customer_id='other-customer'`;
    });
    expect(await generate('test-customer', input)).toEqual({ kind: 'not_found' });
  });
  it.each(['role', 'accountId', 'tenantId', 'institutionId'])('双授权%s不一致时零数据库读取', async key => {
    mocks.appointmentAuth.mockResolvedValue({ kind: 'allowed', actor: { ...actor, [key]: 'other' } });
    expect(await read('test-customer')).toEqual({ kind: 'forbidden' }); expect(mocks.database).not.toHaveBeenCalled();
  });
  it.each(['forbidden', 'unavailable'])('授权%s时不读取业务对象', async kind => {
    mocks.customerAuth.mockResolvedValue({ kind }); expect(await generate('test-customer', input)).toEqual({ kind }); expect(mocks.database).not.toHaveBeenCalled();
  });
  it('超长或敏感来源不生成；伪造字段及版本拒绝', async () => {
    await fixture.sql`update appointments set project=${'x'.repeat(121)}`; expect(await generate('test-customer', input)).toEqual({ kind: 'invalid' });
    await fixture.sql`update appointments set project='13800138000'`; expect(await generate('test-customer', input)).toEqual({ kind: 'invalid' });
    expect(await generate('test-customer', { ...input, tenantId: 'forged' })).toEqual({ kind: 'invalid' });
    expect(await generate('test-customer', { ...input, expectedCustomerUpdatedAt: '2026-10-05T00:00:00.000Z' })).toEqual({ kind: 'conflict' });
  });
});
