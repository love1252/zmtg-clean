import { describe, expect, it } from 'vitest';

import {
  DEMO_INSTITUTION_ID,
  DEMO_SEED_ENV_FLAG,
  DEMO_SEED_KEY,
  DEMO_TENANT_ID,
  assertLowSensitiveSeed,
  assertWriteGuards,
  buildDemoSeedRecords,
  checkSafeDatabaseUrl,
  getCleanupPlan,
  parseCliArgs,
  summarizeSeedRecords,
} from './seed-v06-low-sensitive-demo';

describe('V0.6 low sensitive demo seed', () => {
  it('默认 dry-run，只有显式 --apply 或 --cleanup 才进入写入模式', () => {
    expect(parseCliArgs([])).toEqual({ mode: 'dry-run' });
    expect(parseCliArgs(['--dry-run'])).toEqual({ mode: 'dry-run' });
    expect(parseCliArgs(['--apply'])).toEqual({ mode: 'apply' });
    expect(parseCliArgs(['--cleanup'])).toEqual({ mode: 'cleanup' });
    expect(() => parseCliArgs(['--apply', '--cleanup'])).toThrow(/不能同时传入/);
  });

  it('默认 dry-run 只生成低敏计划，不需要数据库连接', () => {
    const options = parseCliArgs([]);
    const records = buildDemoSeedRecords();
    const summary = summarizeSeedRecords(records);

    expect(options.mode).toBe('dry-run');
    expect(summary.customers).toBe(4);
    expect(() => assertLowSensitiveSeed(records)).not.toThrow();
  });

  it('写入和清理必须同时满足环境变量与安全数据库 host', () => {
    expect(() => assertWriteGuards({ DATABASE_URL: 'postgres://localhost:5432/zmtg' })).toThrow(
      `${DEMO_SEED_ENV_FLAG}=1`,
    );
    expect(() =>
      assertWriteGuards({
        [DEMO_SEED_ENV_FLAG]: '1',
        DATABASE_URL: 'postgres://prod.example.com:5432/zmtg',
      }),
    ).toThrow(/unsafe_host/);
    expect(() =>
      assertWriteGuards({
        [DEMO_SEED_ENV_FLAG]: '1',
        DATABASE_URL: 'postgres://localhost:5432/zmtg_local',
      }),
    ).not.toThrow();
    expect(() =>
      assertWriteGuards({
        [DEMO_SEED_ENV_FLAG]: '1',
        DATABASE_URL: 'postgres://demo-db.internal:5432/zmtg_demo',
      }),
    ).not.toThrow();
  });

  it('数据库 URL 校验只允许 localhost / 127.0.0.1 / demo 标识，且测试只使用 mock 字符串', () => {
    expect(checkSafeDatabaseUrl(undefined)).toMatchObject({ allowed: false, reason: 'missing_database_url' });
    expect(checkSafeDatabaseUrl('not-a-url')).toMatchObject({ allowed: false, reason: 'invalid_database_url' });
    expect(checkSafeDatabaseUrl('postgres://127.0.0.1:5432/zmtg')).toMatchObject({ allowed: true, reason: 'localhost' });
    expect(checkSafeDatabaseUrl('postgres://localhost:5432/zmtg')).toMatchObject({ allowed: true, reason: 'localhost' });
    expect(checkSafeDatabaseUrl('postgres://demo-db.internal:5432/zmtg')).toMatchObject({ allowed: true, reason: 'demo_marker' });
    expect(checkSafeDatabaseUrl('postgres://db.internal:5432/zmtg')).toMatchObject({ allowed: false, reason: 'unsafe_host' });
  });

  it('seed 使用固定 demoSeedKey，且全部核心记录可追踪到该 seedKey', () => {
    const records = buildDemoSeedRecords();

    expect(DEMO_SEED_KEY).toBe('v06_demo_low_sensitive_01');
    expect(records.customers.every((customer) => customer.tags.includes(`demoSeedKey:${DEMO_SEED_KEY}`))).toBe(true);
    expect(records.treatmentSummaries.every((summary) => summary.tags.includes(`demoSeedKey:${DEMO_SEED_KEY}`))).toBe(true);
    expect(records.followUpPathEnrollments.every((enrollment) => enrollment.metadataJson.demoSeedKey === DEMO_SEED_KEY)).toBe(true);
    expect(records.followUpMessageDrafts.every((draft) => draft.metadataJson.demoSeedKey === DEMO_SEED_KEY)).toBe(true);
    expect(records.followUpCustomerTimelineEvents.every((event) => event.metadataJson.demoSeedKey === DEMO_SEED_KEY)).toBe(true);
    expect(records.knowledgeDocuments.every((document) => document.version === DEMO_SEED_KEY)).toBe(true);
  });

  it('seed 数据保持低敏字段，不包含手机号、身份证、病历号、地址、secret、连接串或供应商计量字段', () => {
    const records = buildDemoSeedRecords();
    expect(() => assertLowSensitiveSeed(records)).not.toThrow();

    for (const customer of records.customers) {
      expect(customer.displayName).toMatch(/^演示客户[A-D]$/u);
      expect(customer.maskedPhone).toBe('未采集');
      expect(customer.maskedMedicalRecordNo).toBe('未采集');
      expect(customer.tags).toContain(`demoSeedKey:${DEMO_SEED_KEY}`);
      expect(customer.notes).toContain('年龄段');
    }

    const serialized = JSON.stringify(records);
    expect(serialized).not.toMatch(/1[3-9]\d{9}/u);
    expect(serialized).not.toMatch(/\d{6}(?:19|20)\d{2}\d{2}\d{2}\d{3}[\dXx]/u);
    expect(serialized).not.toMatch(/\bMR[-_A-Z0-9]{3,}\b/iu);
    expect(serialized).not.toMatch(/(?:省|市|区|县).{0,20}(?:路|街|号楼|单元)/u);
    expect(serialized).not.toMatch(/postgres:\/\//iu);
    expect(serialized).not.toMatch(/api[_\s-]?key|secret/iu);
    expect(serialized).not.toMatch(/provider|token|cost|vendor/iu);
  });

  it('水光、光电和双眼皮摘要命中预期随访路径', () => {
    const records = buildDemoSeedRecords();
    const pathByCategory = Object.fromEntries(
      records.treatmentSummaries.map((summary) => {
        const enrollment = records.followUpPathEnrollments.find(
          (item) => item.treatmentSummaryId === summary.id,
        );
        return [summary.treatmentCategory, enrollment?.templateKey];
      }),
    );

    expect(pathByCategory.injection_review).toBe('hydro_injection_care');
    expect(pathByCategory.laser_repair).toBe('photoelectric_care');
    expect(pathByCategory.skin_repair).toBe('post_surgery_repair');
    expect(pathByCategory.skin_check).toBe('skin_management');
  });

  it('覆盖演示链路所需租户、机构、客户、SOP、路径、任务、草稿、时间线和看板数据', () => {
    const records = buildDemoSeedRecords();
    const summary = summarizeSeedRecords(records);

    expect(records.tenants).toEqual([{ id: DEMO_TENANT_ID, name: '智美天工 V0.6 演示租户', status: 'active' }]);
    expect(records.followUpPathEnrollments.every((item) => item.institutionId === DEMO_INSTITUTION_ID)).toBe(true);
    expect(summary.customers).toBe(4);
    expect(summary.treatmentSummaries).toBe(4);
    expect(summary.knowledgeDocuments).toBe(6);
    expect(summary.followUpPathEnrollments).toBe(4);
    expect(summary.followUpPathStages).toBe(12);
    expect(summary.followUpTasks).toBe(12);
    expect(summary.followUpMessageDrafts).toBe(4);
    expect(summary.followUpCustomerTimelineEvents).toBeGreaterThanOrEqual(16);

    expect(records.followUpPathStages.map((stage) => stage.stageKey)).toEqual(
      expect.arrayContaining(['D1', 'D3', 'D7']),
    );
    expect(records.followUpMessageDrafts.every((draft) => draft.channelType === 'manual')).toBe(true);
    expect(records.followUpMessageTemplates.every((template) => template.forbidAutoSend)).toBe(true);
  });

  it('不真实出网、不调用真实 AI、不发送真实消息', () => {
    const records = buildDemoSeedRecords();

    expect(records.followUpMessageDrafts.every((draft) => draft.channelType === 'manual')).toBe(true);
    expect(records.followUpMessageDrafts.every((draft) => draft.metadataJson.manualOnly)).toBe(true);
    expect(records.followUpMessageTemplates.every((template) => template.requiresHumanApproval)).toBe(true);
    expect(records.followUpMessageTemplates.every((template) => template.forbidAutoSend)).toBe(true);

    const serialized = JSON.stringify(records);
    expect(serialized).not.toMatch(/https?:\/\//iu);
    expect(serialized).not.toMatch(/webhook|callbackUrl|fetch\(|axios|openai|anthropic/iu);
    expect(serialized).not.toMatch(/真实发送|企业微信发送|短信发送/iu);
  });

  it('使用确定性主键和 on-conflict 友好的唯一来源键，重复 seed 不会生成重复记录', () => {
    const first = buildDemoSeedRecords();
    const second = buildDemoSeedRecords();

    expect(first).toEqual(second);

    const taskSourceKeys = first.followUpTasks.map(
      (task) => `${task.tenantId}:${task.sourceTreatmentSummaryId}:${task.sourceSuggestionKey}`,
    );
    expect(new Set(taskSourceKeys).size).toBe(taskSourceKeys.length);

    const activeEnrollmentSourceKeys = first.followUpPathEnrollments.map(
      (enrollment) => `${enrollment.tenantId}:${enrollment.sourceType}:${enrollment.sourceId}:${enrollment.templateKey}`,
    );
    expect(new Set(activeEnrollmentSourceKeys).size).toBe(activeEnrollmentSourceKeys.length);
  });

  it('所有 planned row id 都满足 varchar(64) 长度边界', () => {
    const records = buildDemoSeedRecords();
    const rowsWithId = Object.entries(records).flatMap(([groupName, rows]) =>
      rows.map((row) => ({ groupName, id: row.id })),
    );

    expect(rowsWithId.length).toBeGreaterThan(0);
    expect(rowsWithId.filter(({ id }) => id.length > 64)).toEqual([]);
    expect(records.followUpCustomerTimelineEvents.every((event) => event.id.length <= 64)).toBe(true);
    expect(records.followUpPathEnrollments.every((enrollment) => enrollment.id.length <= 64)).toBe(true);
    expect(records.followUpPathStages.every((stage) => stage.id.length <= 64)).toBe(true);
    expect(records.followUpTasks.every((task) => task.id.length <= 64)).toBe(true);
    expect(records.followUpMessageDrafts.every((draft) => draft.id.length <= 64)).toBe(true);
    expect(records.knowledgeSources.every((source) => source.id.length <= 64)).toBe(true);
    expect(records.knowledgeDocuments.every((document) => document.id.length <= 64)).toBe(true);
    expect(records.knowledgeChunks.every((chunk) => chunk.id.length <= 64)).toBe(true);
    expect(records.knowledgeIndexJobs.every((job) => job.id.length <= 64)).toBe(true);
  });

  it('cleanup 只选择本 seed 的确定性主键，不包含外部记录范围', () => {
    const records = buildDemoSeedRecords();
    const cleanupPlan = getCleanupPlan(records);

    expect(cleanupPlan.tenants).toEqual([DEMO_TENANT_ID]);
    expect(cleanupPlan.customers).toEqual(records.customers.map((customer) => customer.id));
    expect(cleanupPlan.followUpTasks).toEqual(records.followUpTasks.map((task) => task.id));
    expect(cleanupPlan.followUpCustomerTimelineEvents).toEqual(
      records.followUpCustomerTimelineEvents.map((event) => event.id),
    );

    for (const recordIds of Object.values(cleanupPlan)) {
      expect(recordIds.length).toBeGreaterThan(0);
      expect(recordIds.every((id) => id.startsWith('v06-demo-low-sensitive-01'))).toBe(true);
    }
  });
});
