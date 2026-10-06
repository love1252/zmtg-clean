import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

// Explicitly provision an empty, disposable instance before running this script.
async function main() {
const input = process.argv[2];
const target = input ? new URL(input) : null;
if (!target || target.hostname !== '127.0.0.1' || target.port !== '55486'
  || target.pathname !== '/zmtg_third_batch_isolated_test' || target.search || target.password) {
  throw new Error('isolated_test_target_required');
}
const sql = postgres(input!, { max: 2, prepare: false, onnotice: () => {} });
let checks = 0;
try {
  const marker = await sql`select hash from drizzle.__drizzle_migrations where created_at = 1788162722000`;
  assert.equal(marker.length, 1);
  assert.equal(marker[0].hash, 'isolated-synthetic-baseline');
  const migration = await readFile('drizzle/0053_third_batch_human_decisions.sql', 'utf8');
  await assert.rejects(sql.begin(tx => tx.unsafe(migration)), /THIRD_BATCH_0053_TARGET_EXISTS/); checks++;
  const rollback = new Error('rollback_synthetic_fixture');
  try {
    await sql.begin(async tx => {
      await tx`insert into tenants(id,name) values ('third-test-tenant','Synthetic')`;
      await tx`insert into customers(id,tenant_id,institution_id,display_name,lifecycle,priority,owner_user_id,project_interest,masked_phone,masked_medical_record_no,last_touch_summary,next_action)
        values ('third-test-customer','third-test-tenant','third-test-institution','Synthetic','post_care','high','actor','','','','','')`;
      await tx`insert into appointments(id,tenant_id,institution_id,customer_id,customer_display_name,project,scheduled_at,consultant_user_id,status,note)
        values ('third-test-appointment','third-test-tenant','third-test-institution','third-test-customer','Synthetic','Project','2026-10-06','actor','confirmed','')`;
      const row = {
        id: 'third-test-suggestion', tenant_id: 'third-test-tenant', institution_id: 'third-test-institution', customer_id: 'third-test-customer',
        field_name: 'projectInterest', before_value: '', proposed_value: 'Project', source_appointment_id: 'third-test-appointment',
        source_project: 'Project', source_status: 'confirmed', source_scheduled_at: '2026-10-06', source_updated_at: '2026-10-06',
        source_version: 'a'.repeat(64), customer_updated_at: '2026-10-06', rule_version: 'appointment-project.v1', fingerprint: 'b'.repeat(64),
        created_by: 'actor', created_at: '2026-10-06', expires_at: '2026-10-13', creation_audit_event_id: 'synthetic-audit',
      };
      await tx`insert into customer_profile_suggestions ${tx(row)}`; checks++;
      for (const patch of [
        { id: 'duplicate' },
        { id: 'other-scope', institution_id: 'other', fingerprint: 'c'.repeat(64) },
        { id: 'bad-rule', proposed_value: 'Different', fingerprint: 'd'.repeat(64) },
        { id: 'bad-state', state: 'applied', fingerprint: 'e'.repeat(64) },
        { id: 'bad-expiry', expires_at: '2026-10-05', fingerprint: 'f'.repeat(64) },
      ]) {
        await assert.rejects(tx.savepoint(sp => sp`insert into customer_profile_suggestions ${sp({ ...row, ...patch })}`)); checks++;
      }
      await assert.rejects(tx.savepoint(sp => sp`update customer_profile_suggestions set state='applied', revision=2, decided_by='actor', decided_role='tenant_admin', decided_at='2026-10-06', decision_audit_event_id='decision', reason_code='accepted' where id='third-test-suggestion'`)); checks++;
      await assert.rejects(tx.savepoint(sp => sp`update customer_profile_suggestions set state='rejected', revision=2, decided_by='actor', decided_role='tenant_admin', decision_audit_event_id='decision', reason_code='rejected' where id='third-test-suggestion'`)); checks++;
      await tx`update customer_profile_suggestions set state='rejected',revision=2,decided_by='actor',decided_role='tenant_admin',decided_at='2026-10-06',decision_audit_event_id='decision',reason_code='rejected' where id='third-test-suggestion'`; checks++;
      await tx`insert into institution_scopes(tenant_id,institution_id,status,revision,provisioning_source,provisioning_reference_digest,approved_by,approved_at)
        values ('third-test-tenant','third-test-institution','active',1,'approved_migration_manifest',${'a'.repeat(64)},'actor','2026-10-06')`;
      await tx`insert into care_formal_follow_up_tasks(tenant_id,institution_id,id,customer_id,customer_display_name,stage_code,action_code,due_at,assignee_kind,assignee_role,idempotency_key,request_digest,created_by,updated_by)
        values ('third-test-tenant','third-test-institution','third-test-task','third-test-customer','Synthetic','manual_followup','manual_contact','2026-10-07','role_pool','consultant','synthetic-task-key',${'a'.repeat(64)},'actor','actor')`;
      const confirmation = {
        id: 'third-test-confirmation', tenant_id: 'third-test-tenant', institution_id: 'third-test-institution', customer_id: 'third-test-customer',
        opportunity_type: 'revisit', rule_version: 'customer-lifecycle.v1', source_version: 'opp-src-v1:' + 'a'.repeat(64),
        source_updated_at: '2026-10-06', source_lifecycle: 'post_care', source_priority: 'high', idempotency_key: 'synthetic-confirmation-key',
        request_digest: 'b'.repeat(64), confirmed_by: 'actor', confirmed_role: 'tenant_admin', confirmed_at: '2026-10-06',
        follow_up_task_id: 'third-test-task', audit_event_id: 'synthetic-audit',
      };
      await tx`insert into institution_opportunity_confirmations ${tx(confirmation)}`; checks++;
      for (const patch of [
        { id: 'duplicate-key' },
        { id: 'duplicate-candidate', idempotency_key: 'another-key' },
        { id: 'wrong-type', opportunity_type: 'repurchase' },
        { id: 'wrong-scope', institution_id: 'other-institution' },
        { id: 'missing-task', follow_up_task_id: 'missing-task' },
        { id: 'wrong-role', confirmed_role: 'consultant' },
      ]) {
        await assert.rejects(tx.savepoint(async sp => {
          if (!patch.id.startsWith('duplicate')) await sp`delete from institution_opportunity_confirmations where id='third-test-confirmation'`;
          await sp`insert into institution_opportunity_confirmations ${sp({ ...confirmation, ...patch })}`;
        })); checks++;
      }
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  assert.equal((await sql`select count(*)::int as n from customer_profile_suggestions`)[0].n, 0); checks++;
  assert.equal((await sql`select count(*)::int as n from institution_opportunity_confirmations`)[0].n, 0); checks++;
  console.log(`隔离 PostgreSQL 结构验证通过：${checks} 项；合成写入已回滚。`);
} finally { await sql.end(); }

}
void main().catch(() => { console.error("isolated_schema_validation_failed"); process.exitCode = 1; });
