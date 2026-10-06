import assert from 'node:assert/strict';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../../src/server/db/schema';
import { mintVerifiedInstitutionAuditAttributionForOrchestrationV1 } from '../../src/modules/audit/domain/audit-events';

export const actor = { accountId: 'synthetic-actor', displayName: 'Synthetic', role: 'tenant_admin' as const, tenantId: 'test-tenant', institutionId: 'test-institution', observedAt: '2026-10-06T00:00:00.000Z' };
export function isolatedFixture() {
  if (process.env.ZMTG_THIRD_BATCH_ISOLATED_TEST !== '1') throw new Error('explicit_isolated_test_required');
  const sql = postgres('postgresql://postgres@127.0.0.1:55486/zmtg_third_batch_isolated_test', { max: 6, prepare: false, onnotice: () => {} });
  const database = drizzle(sql, { schema });
  const attribution = () => mintVerifiedInstitutionAuditAttributionForOrchestrationV1({ formalPair: actor, businessPair: actor });
  async function seed() {
    const marker = await sql`select hash from drizzle.__drizzle_migrations where created_at=1788162722000`;
    assert.equal(marker[0]?.hash, 'isolated-synthetic-baseline');
    await sql`alter table audit_events drop constraint if exists synthetic_fail_audit`;
    await sql`truncate customer_profile_suggestions, institution_opportunity_confirmations, care_formal_follow_up_events, care_formal_follow_up_tasks, audit_events, appointments, customers, institution_scopes, tenants cascade`;
    await sql`insert into tenants(id,name) values ('test-tenant','Synthetic')`;
    await sql`insert into institution_scopes(tenant_id,institution_id,status,revision,provisioning_source,provisioning_reference_digest,approved_by,approved_at)
      values ('test-tenant','test-institution','active',1,'approved_migration_manifest',${'a'.repeat(64)},'synthetic-actor','2026-10-06')`;
    await sql`insert into customers(id,tenant_id,institution_id,display_name,lifecycle,priority,owner_user_id,project_interest,masked_phone,masked_medical_record_no,last_touch_summary,next_action,updated_at)
      values ('test-customer','test-tenant','test-institution','Synthetic','post_care','high','synthetic-actor','','','','','','2026-10-06T00:00:00.0004Z')`;
    await sql`insert into appointments(id,tenant_id,institution_id,customer_id,customer_display_name,project,scheduled_at,consultant_user_id,status,note,updated_at)
      values ('test-appointment','test-tenant','test-institution','test-customer','Synthetic','Skin care','2026-10-07','synthetic-actor','confirmed','','2026-10-06')`;
  }
  return { sql, database, attribution, seed };
}
