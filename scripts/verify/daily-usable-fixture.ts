import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { createMembershipCommandId, createMembershipCommandService } from '../../src/modules/access-control/application/membership-command-service';
import { createMembershipCommandTransactionPort } from '../../src/modules/access-control/server/membership-command-repository';
import { hashPasswordScrypt } from '../../src/modules/auth/server/password-hash';
import { createTransactionBoundInstitutionScopeAssertion } from '../../src/modules/tenancy/server/transaction-bound-institution-scope';
import * as schema from '../../src/server/db/schema';
import { databaseUrl, readState, verifyContainer, type DailyUsableEnvironment } from './daily-usable-environment.mjs';

const accounts = [
  { key: 'admin', role: 'tenant_admin', suffix: 'a', name: '验收机构甲管理员' },
  { key: 'operator', role: 'tenant_operator', suffix: 'a', name: '验收机构甲运营' },
  { key: 'consultant', role: 'consultant', suffix: 'a', name: '验收机构甲顾问' },
  { key: 'service', role: 'customer_service', suffix: 'a', name: '验收机构甲客服' },
  { key: 'other', role: 'tenant_admin', suffix: 'b', name: '验收机构乙管理员' },
] as const;

const digest = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');

async function setup(state: DailyUsableEnvironment, directory: string) {
  const client = postgres(databaseUrl(state), { max: 1, prepare: false, connect_timeout: 10, onnotice: () => {} });
  try {
    // create 返回后 PostgreSQL 可能仍在初始化；只等待已经核对归属的本任务实例。
    for (let attempt = 0; ; attempt += 1) {
      try { await client`select 1`; break; }
      catch (error) {
        if (attempt >= 20) throw error;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    const [{ version }] = await client`select current_setting('server_version_num')::int as version`;
    assert(version >= 160000 && version < 170000, '仅验收 PostgreSQL 16');
    const baselinePath = 'drizzle/baselines/sys01-local-dev-current-schema-0045-v1.sql';
    const baseline = await readFile(baselinePath);
    const manifest = JSON.parse(await readFile(baselinePath.replace('.sql', '.json'), 'utf8'));
    assert.equal(digest(baseline), manifest.artifactSha256, '结构基线文件校验失败');
    const journal: { entries: { idx: number; tag: string; when: number }[] } = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8'));
    const forward = journal.entries.filter(entry => entry.idx > 45);
    assert.equal(forward[0].idx, 46);
    assert.equal(forward.at(-1)?.idx, 53, '新增 migration 后先复核验收脚本范围');
    await client.begin(async transaction => {
      const [existing] = await transaction`select
        (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname not like 'pg_%' and n.nspname <> 'information_schema')
        + (select count(*)::int from pg_enum)
        + (select count(*)::int from pg_namespace where nspname not like 'pg_%' and nspname not in ('public','information_schema')) as objects`;
      assert.equal(existing.objects, 0, '隔离库必须为空；禁止复用或清空已有数据库');
      await transaction.unsafe(baseline.toString('utf8'));
      await transaction`create schema drizzle`;
      await transaction`create table drizzle.__drizzle_migrations(id serial primary key, hash text not null, created_at bigint)`;
      await transaction`insert into drizzle.__drizzle_migrations(hash,created_at) values (${digest(baseline)},${journal.entries[45].when})`;
      for (const entry of forward) {
        const source = await readFile(`drizzle/${entry.tag}.sql`, 'utf8');
        await transaction.unsafe(source);
        await transaction`insert into drizzle.__drizzle_migrations(hash,created_at) values (${digest(source)},${entry.when})`;
      }
      await transaction`create table public.daily_usable_environment(run_id text primary key, baseline_kind text not null)`;
      await transaction`insert into public.daily_usable_environment values (${state.runId},'schema-only-0045-plus-real-0046-0053')`;
    });

    const database = drizzle(client, { schema });
    const now = new Date();
    const occurredAt = new Date(now.getTime() - 60_000);
    await database.insert(schema.tenants).values(['a', 'b'].map(suffix => ({ id: `daily-tenant-${suffix}`, name: `合成验收机构 ${suffix}` })));
    await database.insert(schema.institutionScopes).values(['a', 'b'].map(suffix => ({
      tenantId: `daily-tenant-${suffix}`, institutionId: `daily-institution-${suffix}`,
      status: 'active' as const, revision: 1, provisioningSource: 'formal_onboarding' as const,
      provisioningReferenceDigest: digest(`${state.runId}-${suffix}`), approvedBy: 'daily-isolated-fixture', approvedAt: occurredAt,
    })));
    await database.insert(schema.institutionOperatingContextVersions).values(['a', 'b'].map(suffix => ({
      tenantId: `daily-tenant-${suffix}`, institutionId: `daily-institution-${suffix}`, version: 1,
      timezone: 'Asia/Shanghai', currency: 'CNY', effectiveFromBusinessDate: '2026-01-01',
      effectiveAt: occurredAt, source: 'institution_config' as const, createdBy: 'daily-isolated-fixture',
    })));
    await database.insert(schema.institutionOperatingContexts).values(['a', 'b'].map(suffix => ({
      tenantId: `daily-tenant-${suffix}`, institutionId: `daily-institution-${suffix}`,
      revision: 1, latestVersion: 1, updatedBy: 'daily-isolated-fixture',
    })));
    const passwordHash = await hashPasswordScrypt(state.loginPassword);
    const membership = createMembershipCommandService({ transactionPort: createMembershipCommandTransactionPort(database, {
      createScopeAssertion: createTransactionBoundInstitutionScopeAssertion,
    }) });
    for (const account of accounts) {
      const id = `daily-user-${account.key}`;
      await database.insert(schema.authUsers).values({ id, username: `daily_${account.key}`, displayName: account.name,
        passwordHash, passwordUpdatedAt: occurredAt, passwordResetRequired: false, status: 'active',
        createdBy: 'daily-isolated-fixture', updatedBy: 'daily-isolated-fixture', createdAt: now, updatedAt: now });
      const result = await membership.execute({ kind: 'create', commandId: createMembershipCommandId(),
        membershipId: `daily-member-${account.key}`, userId: id, tenantId: `daily-tenant-${account.suffix}`,
        actorId: 'daily-isolated-fixture', reasonCode: 'formal_onboarding', occurredAt: occurredAt.toISOString(),
        role: account.role, displayName: account.name, source: 'formal_onboarding', expectedRevision: null,
        binding: { bindingId: `daily-binding-${account.key}`, institutionId: `daily-institution-${account.suffix}`, source: 'system', expiresAt: null },
      });
      assert.equal(result.status, 'applied', '合成身份必须由真实 Membership/Binding command 建立');
    }
    await database.insert(schema.customers).values(['a', 'b'].map(suffix => ({ id: `daily-customer-${suffix}`,
      tenantId: `daily-tenant-${suffix}`, institutionId: `daily-institution-${suffix}`, displayName: `合成客户 ${suffix}`,
      lifecycle: 'post_care' as const, priority: 'high' as const, ownerUserId: suffix === 'a' ? 'daily-user-consultant' : 'daily-user-other',
      projectInterest: '合成预约项目', maskedPhone: '未采集', maskedMedicalRecordNo: '未采集', lastTouchSummary: '仅用于本任务隔离验收', nextAction: '人工随访',
    })));
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    for (const suffix of ['a', 'b']) {
      const count = suffix === 'a' ? 135 : 3;
      await database.insert(schema.appointments).values(Array.from({ length: count }, (_, index) => ({
        id: `daily-appointment-${suffix}-${String(index + 1).padStart(3, '0')}`,
        tenantId: `daily-tenant-${suffix}`, institutionId: `daily-institution-${suffix}`, customerId: `daily-customer-${suffix}`,
        customerDisplayName: `合成客户 ${suffix}`, project: `合成预约项目 ${index + 1}`, scheduledAt: tomorrow,
        consultantUserId: suffix === 'a' ? 'daily-user-consultant' : 'daily-user-other', status: 'pending_confirmation' as const, note: '隔离测试数据',
      })));
      await database.insert(schema.careFormalFollowUpTasks).values(Array.from({ length: count }, (_, index) => ({
        id: `daily-task-${suffix}-${String(index + 1).padStart(3, '0')}`,
        tenantId: `daily-tenant-${suffix}`, institutionId: `daily-institution-${suffix}`, customerId: `daily-customer-${suffix}`,
        customerDisplayName: `合成客户 ${suffix}`, stageCode: 'manual_followup', actionCode: 'manual_contact',
        dueAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        assigneeKind: 'role_pool' as const, assigneeRole: 'consultant' as const,
        idempotencyKey: `daily-${suffix}-${index + 1}`, requestDigest: digest(`daily-${suffix}-${index + 1}`),
        createdBy: 'daily-user-admin', updatedBy: 'daily-user-admin',
      })));
    }
    await writeFile(path.join(directory, 'synthetic-accounts.json'), JSON.stringify({
      note: '仅本任务新建隔离环境的合成账号，不是真实凭证；禁止用于其他环境。',
      baseUrl: `http://127.0.0.1:${state.appPort}`, password: state.loginPassword,
      accounts: accounts.map(account => ({ username: `daily_${account.key}`, role: account.role, institutionId: `daily-institution-${account.suffix}` })),
      customerA: 'daily-customer-a', customerB: 'daily-customer-b', tomorrow: tomorrow.toISOString(),
    }, null, 2), { mode: 0o600 });
    console.log('隔离库完成：0045 纯结构基线、0046–0053 实际迁移；5 个正式身份、138 条预约、138 条随访。合成账号保存在同目录 synthetic-accounts.json。');
  } finally { await client.end(); }
}

async function verify(state: DailyUsableEnvironment, directory: string, integrated: boolean) {
  const base = `http://127.0.0.1:${state.appPort}`;
  const checks: { name: string; passed: true }[] = [];
  const check = (name: string, value: unknown) => { assert(value, name); checks.push({ name, passed: true }); };
  const client = postgres(databaseUrl(state), { max: 1, prepare: false, onnotice: () => {} });
  try {
    const marker = await client`select run_id from daily_usable_environment`;
    check('当前数据库属于本任务创建的合成环境', marker.length === 1 && marker[0].run_id === state.runId);
    const anonymous = await fetch(`${base}/api/v1/institution/appointments`);
    check('未登录预约访问被拒绝', [401, 403, 503].includes(anonymous.status));
    for (const account of accounts) {
      const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: `daily_${account.key}`, password: state.loginPassword, scope: 'institution' }) });
      check(`${account.key} 真实密码登录成功`, response.status === 200);
      const cookie = response.headers.getSetCookie().find(value => value.startsWith('zmtg_server_session_v1='))?.split(';')[0];
      check(`${account.key} 签发正式会话`, Boolean(cookie));
      const headers = { cookie: cookie! };
      const sessionResponse = await fetch(`${base}/api/auth/session`, { headers });
      const session = await sessionResponse.json();
      check(`${account.key} 会话机构与角色正确`, sessionResponse.status === 200 && session.authenticated
        && session.user.role === account.role && session.user.institutionId === `daily-institution-${account.suffix}`);
      for (const endpoint of ['appointments', 'followups']) {
        const first = await fetch(`${base}/api/v1/institution/${endpoint}?page=1&pageSize=100`, { headers });
        const body = await first.json();
        check(`${account.key} ${endpoint} 正式接口可读`, first.status === 200);
        const count = endpoint === 'followups' && account.role === 'customer_service' ? 0 : account.suffix === 'a' ? 135 : 3;
        check(`${account.key} ${endpoint} 机构范围与总数正确`, body.pageInfo.total === count && body.records.length === Math.min(count, 100));
        if (count > 100) {
          const second = await fetch(`${base}/api/v1/institution/${endpoint}?page=2&pageSize=100`, { headers });
          const page = await second.json();
          check(`${account.key} ${endpoint} 超过 100 条无遗漏`, second.status === 200 && page.records.length === 35);
        }
        check(`${account.key} ${endpoint} 无另一机构记录`, body.records.every((row: { appointmentId?: string; customer?: { customerId?: string } }) =>
          endpoint === 'appointments' ? row.appointmentId?.startsWith(`daily-appointment-${account.suffix}-`)
            : row.customer?.customerId === `daily-customer-${account.suffix}`));
        if (endpoint === 'appointments') {
          const date = new Date(Date.parse(body.records[0].scheduledAt) + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
          const filtered = await fetch(`${base}/api/v1/institution/appointments?pageSize=100&startDate=${date}&endDate=${date}`, { headers });
          const filteredBody = await filtered.json();
          check(`${account.key} 未来预约日期筛选返回完整总数`, filtered.status === 200 && filteredBody.pageInfo.total === count);
        }
      }
      const wrongCustomer = account.suffix === 'a' ? 'daily-customer-b' : 'daily-customer-a';
      const cross = await fetch(`${base}/api/v1/institution/customers/${wrongCustomer}`, { headers });
      check(`${account.key} 跨机构客户详情拒绝`, [403, 404].includes(cross.status));
      const invalid = await fetch(`${base}/api/v1/institution/followups?pageSize=101`, { headers });
      check(`${account.key} 无效分页被拒绝`, invalid.status === 400);
      if (integrated) {
        const workbench = await fetch(`${base}/hospital`, { headers, redirect: 'manual' });
        const workbenchHtml = await workbench.text();
        const pendingSection = workbenchHtml.match(/<section\b[^>]*aria-label="待确认预约"[^>]*>([\s\S]*?)<\/section>/)?.[1] ?? '';
        const pendingText = pendingSection.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '');
        const expectedPending = account.suffix === 'a' ? 135 : 3;
        check(`${account.key} 工作台待确认预约显示全量 ${expectedPending} 项`, workbench.status === 200
          && pendingText.includes(`待确认预约 ${expectedPending} 项`) && pendingSection.includes('status=pending_confirmation'));
        const customerId = `daily-customer-${account.suffix}`;
        const expected = account.role === 'customer_service' ? 0 : account.suffix === 'a' ? 135 : 3;
        const relatedUrl = `${base}/api/v1/institution/customers/${customerId}/followups`;
        const related = await fetch(`${relatedUrl}?page=1&pageSize=20`, { headers });
        const relatedBody = await related.json();
        check(`${account.key} 客户关联随访总数与权限一致`, related.status === 200 && relatedBody.customerId === customerId
          && relatedBody.pageInfo.total === expected && relatedBody.summary.total === expected && relatedBody.records.length === Math.min(20, expected));
        if (expected > 100) {
          const ids = new Set<string>();
          for (let pageNumber = 1; pageNumber <= 7; pageNumber += 1) {
            const pageResponse = await fetch(`${relatedUrl}?page=${pageNumber}&pageSize=20`, { headers });
            const page = await pageResponse.json();
            assert.equal(pageResponse.status, 200, '关联随访分页请求成功');
            for (const task of page.records) {
              assert.equal(task.customer.customerId, customerId, '关联随访不得混入其他客户');
              assert(!ids.has(task.taskId), '关联随访分页不得重复'); ids.add(task.taskId);
            }
          }
          check(`${account.key} 单客户 7 页 135 条随访无重复无遗漏`, ids.size === 135);
        }
        const crossRelated = await fetch(`${base}/api/v1/institution/customers/${wrongCustomer}/followups`, { headers });
        check(`${account.key} 跨机构关联随访被拒绝`, [403, 404].includes(crossRelated.status));
        const evidence = await fetch(`${base}/api/v1/institution/customers/${customerId}/source-evidence`, { headers });
        const evidenceBody = await evidence.json();
        check(`${account.key} 生产模式来源证据可只读访问`, evidence.status === 200 && evidenceBody.customerId === customerId
          && evidenceBody.evidence.status === 'not_recorded' && evidenceBody.evidence.importRecord === null);
        const crossEvidence = await fetch(`${base}/api/v1/institution/customers/${wrongCustomer}/source-evidence`, { headers });
        check(`${account.key} 跨机构来源证据被拒绝`, [403, 404].includes(crossEvidence.status));
        if (account.key === 'admin') {
          const fixture = JSON.parse(await readFile(path.join(directory, 'synthetic-accounts.json'), 'utf8'));
          const date = new Date(Date.parse(fixture.tomorrow) + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
          for (const view of ['day', 'week']) {
            const calendar = await fetch(`${base}/hospital/care/appointments?view=${view}&date=${date}`, { headers, redirect: 'manual' });
            const html = await calendar.text();
            check(`${view} 正式页面返回日历`, calendar.status === 200 && html.includes('aria-label="预约日历（上海时区）"'));
            const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '');
            check(`${view} 日历完整显示 135 条预约`, text.includes('当前日期范围共 135 条预约，已完整展示。') && text.includes('合成预约项目 135'));
          }
        }
      }
    }
    await writeFile(path.join(directory, integrated ? 'verification-integrated.json' : 'verification.json'), JSON.stringify({ checkedAt: new Date().toISOString(),
      basis: '真实 Next HTTP + PostgreSQL + 正式登录；仅合成数据。不是远程测试服或生产验收。', checks,
    }, null, 2), { mode: 0o600 });
    console.log(`真实会话与机构权限验收通过：${checks.length} 项。`);
  } finally { await client.end(); }
}

async function main() {
  const [command, file] = process.argv.slice(2);
  assert(file && ['setup', 'verify', 'verify-integrated'].includes(command), '缺少任务环境参数');
  const state = await readState(file);
  await verifyContainer(state);
  if (command === 'setup') await setup(state, path.dirname(file));
  else await verify(state, path.dirname(file), command === 'verify-integrated');
}
void main().catch(error => {
  const failure = error?.cause ?? error;
  const code = typeof failure?.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(failure.code) ? failure.code : 'unknown';
  const constraint = typeof failure?.constraint_name === 'string' && /^[a-z0-9_]{1,100}$/.test(failure.constraint_name) ? failure.constraint_name : '';
  console.error(error instanceof assert.AssertionError ? error.message.split('\n')[0] : `隔离验收失败 (${code} ${constraint})；未输出连接串、会话或密钥。`);
  process.exitCode = 1;
});
