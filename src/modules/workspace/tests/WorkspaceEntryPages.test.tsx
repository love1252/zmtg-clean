import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HospitalPage from '@/app/hospital/page';
import OpenPlatformPage from '@/app/open-platform/page';

const customerRecord = {
  id: 'cust_phase5_closeout',
  tenantId: 'demo-tenant-001',
  displayName: 'Phase5 客户A',
  lifecycle: 'repurchase_window',
  priority: 'high',
  ownerUserId: 'consultant-phase5',
  projectInterest: 'Phase5 修复项目',
  maskedPhone: '138****1252',
  maskedMedicalRecordNo: 'MR****525',
  lastTouchSummary: 'Phase5 验收触达',
  nextAction: 'Phase5 收尾回访',
  tags: ['Phase5', '验收'],
};

const appointmentRecord = {
  id: 'appt_phase5_closeout',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_phase5_closeout',
  customerDisplayName: 'Phase5 客户A',
  project: 'Phase5 预约复诊',
  scheduledAt: '2026-06-01T10:30:00+08:00',
  consultantUserId: 'consultant-phase5',
  status: 'pending_confirmation',
  note: 'Phase5 验收预约',
};

const followUpRecord = {
  id: 'fu_phase5_closeout',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_phase5_closeout',
  customerDisplayName: 'Phase5 客户A',
  journeyId: 'journey_repurchase',
  stage: 'Phase5 D7 回访',
  status: 'due',
  dueAt: '2026-05-31T10:30:00+08:00',
  suggestedAction: 'Phase5 收尾人工回访',
  riskLevel: 'watch',
  updatedBy: null,
  updatedAt: null,
};

const postCareCustomerRecord = {
  ...customerRecord,
  id: 'cust_phase6_post_care',
  displayName: 'Phase6 客户B',
  lifecycle: 'post_care',
  priority: 'medium',
  projectInterest: 'Phase6 光电复诊',
  maskedPhone: '137****6606',
  maskedMedicalRecordNo: 'MR****606',
  lastTouchSummary: 'Phase6 术后反馈',
  nextAction: 'Phase6 客服回访',
  tags: ['Phase6', '术后'],
};

const rescheduleAppointmentRecord = {
  ...appointmentRecord,
  id: 'appt_phase6_reschedule',
  customerId: 'cust_phase6_post_care',
  customerDisplayName: 'Phase6 客户B',
  project: 'Phase6 改约复诊',
  scheduledAt: '2026-06-02T14:30:00+08:00',
  status: 'reschedule_requested',
  note: 'Phase6 需要协调档期',
};

const urgentFollowUpRecord = {
  ...followUpRecord,
  id: 'fu_phase6_urgent',
  customerId: 'cust_phase6_post_care',
  customerDisplayName: 'Phase6 客户B',
  stage: 'Phase6 D3 异常反馈',
  dueAt: '2026-05-31T09:30:00+08:00',
  suggestedAction: 'Phase6 客服优先回访',
  riskLevel: 'urgent',
};

const auditEventRecord = {
  id: 'audit_phase8_institution',
  tenantId: 'demo-tenant-001',
  resource: 'customer',
  resourceId: 'cust_phase5_closeout',
  action: 'update',
  result: 'allowed',
  reason: 'allowed_by_policy',
  actorId: 'demo-user-admin',
  actorRole: 'tenant_admin',
  occurredAt: '2026-05-31T09:00:00.000Z',
  sql: 'select * from audit_events',
  stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_phase8_should_not_render',
};

const platformAuditEventRecord = {
  id: 'audit_phase8_platform',
  tenantId: 'demo-tenant-001',
  resource: 'customer',
  resourceId: 'cust_phase5_closeout',
  action: 'update',
  result: 'allowed',
  reason: 'allowed_by_policy',
  actorId: 'demo-user-admin',
  actorRole: 'tenant_admin',
  occurredAt: '2026-05-31T09:00:00.000Z',
  requestBody: { phoneNumber: '13800001252' },
  metadata: { sql: 'select * from audit_events' },
  stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_phase8_platform_should_not_render',
  idNumber: '110101199001010011',
  medicalRecordNo: 'MR202605310001',
  treatmentRecord: '完整治疗记录正文不应展示',
  consultationTranscript: '咨询对话全文不应展示',
};

const platformTenantRecord = {
  tenantId: 'demo-tenant-001',
  tenantName: '智美天工演示机构',
  tenantStatus: 'active',
  createdAt: '2026-05-30T00:00:00.000Z',
  updatedAt: '2026-05-31T00:00:00.000Z',
  planName: '成长版',
  planCode: 'growth-care',
  planStatus: 'active',
  assignmentStatus: 'active',
  startedAt: '2026-05-31T00:00:00.000Z',
  expiresAt: null,
  maxCustomers: 5000,
  maxAppointments: 2000,
  maxFollowUps: 10000,
  maxAiCalls: 50000,
  currentCustomers: 24,
  currentAppointments: 12,
  currentFollowUps: 36,
  currentAiCalls: 0,
  snapshotAt: '2026-05-31T08:00:00.000Z',
  customers: [{ phoneNumber: '13800001252' }],
  appointments: [{ customerId: 'cust_phase5_closeout' }],
  followUpTasks: [{ customerId: 'cust_phase5_closeout' }],
  treatmentRecord: '完整治疗记录正文不应展示',
  consultationTranscript: '咨询对话全文不应展示',
  idNumber: '110101199001010011',
  medicalRecordNo: 'MR202605310001',
  sql: 'select * from tenant_plans',
  requestBody: { phoneNumber: '13800001252' },
  stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_phase9_platform_should_not_render',
  secret: 'phase9-raw-secret',
};

const customerTimelineResponse = {
  customer: {
    id: 'cust_phase5_closeout',
    displayName: 'Phase5 客户A',
    lifecycle: 'repurchase_window',
    priority: 'high',
    projectInterest: 'Phase5 修复项目',
    maskedPhone: '138****1252',
    maskedMedicalRecordNo: 'MR****525',
    ownerUserId: 'consultant-phase5',
    tags: ['Phase5', '验收'],
    lastTouchSummary: 'Phase5 验收触达',
    nextAction: 'Phase5 收尾回访',
    phoneNumber: '13800001252',
    idNumber: '110101199001010011',
    medicalRecordNo: 'MR202605310001',
  },
  appointments: [
    {
      id: 'appt_phase5_closeout',
      project: 'Phase5 预约复诊',
      scheduledAt: '2026-06-01T10:30:00+08:00',
      consultantUserId: 'consultant-phase5',
      status: 'pending_confirmation',
      note: 'Phase5 验收预约',
      treatmentRecord: '完整治疗记录正文不应展示',
    },
  ],
  followups: [
    {
      id: 'fu_phase5_closeout',
      journeyId: 'journey_repurchase',
      stage: 'Phase5 D7 回访',
      status: 'due',
      dueAt: '2026-05-31T10:30:00+08:00',
      suggestedAction: 'Phase5 收尾人工回访',
      riskLevel: 'watch',
      updatedBy: null,
      updatedAt: null,
      consultationTranscript: '咨询对话全文不应展示',
    },
  ],
  auditEvents: [
    {
      id: 'audit_phase7_smoke',
      action: 'read',
      result: 'allowed',
      reason: 'allowed_by_policy',
      actor: { id: 'demo-user-admin', role: 'tenant_admin' },
      occurredAt: '2026-06-03T09:00:00.000Z',
      resource: 'customer',
      resourceId: 'cust_phase5_closeout',
      sql: 'select * from audit_events',
      stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
      token: 'sk_test_phase7_should_not_render',
    },
  ],
  timeline: [
    {
      id: 'audit:audit_phase7_smoke',
      type: 'audit',
      occurredAt: '2026-06-03T09:00:00.000Z',
      title: '审计：read',
      summary: 'allowed / allowed_by_policy',
      status: 'allowed',
      source: 'customer',
      relatedRecordId: 'cust_phase5_closeout',
    },
    {
      id: 'appointment:appt_phase5_closeout',
      type: 'appointment',
      occurredAt: '2026-06-01T10:30:00+08:00',
      title: 'Phase5 预约复诊预约',
      summary: 'Phase5 验收预约',
      status: 'pending_confirmation',
      source: 'appointment',
      relatedRecordId: 'appt_phase5_closeout',
    },
    {
      id: 'follow_up:fu_phase5_closeout',
      type: 'follow_up',
      occurredAt: '2026-05-31T10:30:00+08:00',
      title: 'Phase5 D7 回访',
      summary: 'Phase5 收尾人工回访',
      status: 'due',
      source: 'follow_up',
      relatedRecordId: 'fu_phase5_closeout',
    },
  ],
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
}

function fetchPath(input: Parameters<typeof fetch>[0]) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

type WorkspaceFetchOptions = {
  role?: 'tenant_admin' | 'platform_admin';
  customers?: unknown[];
  appointments?: unknown[];
  followups?: unknown[];
  auditEvents?: unknown[];
  platformAuditEvents?: unknown[];
  platformTenants?: unknown[];
  platformTenantError?: {
    status: number;
    message: string;
  };
  timeline?: unknown;
  institutionError?: {
    path:
      | '/api/institution/customers'
      | '/api/institution/appointments'
      | '/api/institution/followups'
      | '/api/institution/audit-events';
    status: number;
    message: string;
  };
};

function mockWorkspaceFetch(options: WorkspaceFetchOptions = {}) {
  const {
    role = 'tenant_admin',
    customers = [customerRecord, postCareCustomerRecord],
    appointments = [appointmentRecord, rescheduleAppointmentRecord],
    followups = [urgentFollowUpRecord, { ...followUpRecord, status: 'scheduled' }],
    auditEvents = [auditEventRecord],
    platformAuditEvents = [platformAuditEventRecord],
    platformTenants = [platformTenantRecord],
    platformTenantError,
    timeline = customerTimelineResponse,
    institutionError,
  } = options;

  const fetchMock = vi.fn(
    async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      void init;
      const path = fetchPath(input);

      if (path === '/api/auth/session') {
        return jsonResponse({ authenticated: true, user: { role } });
      }

      if (institutionError?.path === path) {
        return jsonResponse({ error: institutionError.message }, { status: institutionError.status });
      }

      if (path === '/api/institution/customers') {
        return jsonResponse({ records: customers });
      }

      if (path === '/api/institution/appointments') {
        return jsonResponse({ records: appointments });
      }

      if (path === '/api/institution/followups') {
        return jsonResponse({ records: followups });
      }

      if (path === '/api/institution/audit-events') {
        return jsonResponse({
          records: auditEvents,
          pageInfo: {
            hasMore: false,
            limit: 50,
            nextCursor: null,
          },
        });
      }

      if (path.startsWith('/api/open-platform/audit-events')) {
        return jsonResponse({
          records: platformAuditEvents,
          pageInfo: {
            hasMore: false,
            limit: 50,
            nextCursor: null,
          },
        });
      }

      if (path === '/api/open-platform/tenants') {
        if (platformTenantError) {
          return jsonResponse(
            { error: platformTenantError.message },
            { status: platformTenantError.status },
          );
        }

        return jsonResponse({ records: platformTenants });
      }

      if (path === '/api/institution/customers/cust_phase5_closeout/timeline') {
        return jsonResponse(timeline);
      }

      throw new Error(`没有为 ${path} 配置 fetch mock`);
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function expectMetric(label: string, value: string) {
  const metricCard = screen.getByText(label).closest('article');
  expect(metricCard).not.toBeNull();
  expect(await within(metricCard as HTMLElement).findByText(value)).toBeInTheDocument();
}

function expectNoInstitutionMutation(fetchMock: ReturnType<typeof mockWorkspaceFetch>) {
  const institutionCalls = fetchMock.mock.calls.filter(([input]) =>
    fetchPath(input).startsWith('/api/institution/'),
  );

  expect(institutionCalls).toHaveLength(3);
  for (const [input, init] of institutionCalls) {
    expect(fetchPath(input)).not.toContain('tenantId');
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.body ? String(init.body) : '').not.toContain('tenantId');
  }
}

function expectOnlyInstitutionReadCalls(fetchMock: ReturnType<typeof mockWorkspaceFetch>) {
  const institutionCalls = fetchMock.mock.calls.filter(([input]) =>
    fetchPath(input).startsWith('/api/institution/'),
  );

  expect(institutionCalls.length).toBeGreaterThan(0);
  for (const [input, init] of institutionCalls) {
    expect(fetchPath(input)).not.toContain('tenantId');
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.body ? String(init.body) : '').not.toContain('tenantId');
  }
}

function expectNoSensitiveCustomerTimelineContent(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('13800001252');
  expect(text).not.toContain('110101199001010011');
  expect(text).not.toContain('MR202605310001');
  expect(text).not.toContain('完整治疗记录正文不应展示');
  expect(text).not.toContain('咨询对话全文不应展示');
  expect(text).not.toContain('select * from audit_events');
  expect(text).not.toContain('DATABASE_URL');
  expect(text).not.toContain('postgres://');
  expect(text).not.toContain('stack');
  expect(text).not.toContain('token');
  expect(text).not.toContain('secret');
  expect(text).not.toContain('sk_test_phase7_should_not_render');
}

function expectNoSensitiveAuditContent(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('tenantId');
  expect(text).not.toContain('select * from audit_events');
  expect(text).not.toContain('DATABASE_URL');
  expect(text).not.toContain('postgres://');
  expect(text).not.toContain('stack');
  expect(text).not.toContain('token');
  expect(text).not.toContain('secret');
  expect(text).not.toContain('sk_test_phase8_should_not_render');
}

function expectNoSensitivePlatformAuditContent(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('13800001252');
  expect(text).not.toContain('110101199001010011');
  expect(text).not.toContain('MR202605310001');
  expect(text).not.toContain('完整治疗记录正文不应展示');
  expect(text).not.toContain('咨询对话全文不应展示');
  expect(text).not.toContain('requestBody');
  expect(text).not.toContain('metadata');
  expect(text).not.toContain('select * from audit_events');
  expect(text).not.toContain('DATABASE_URL');
  expect(text).not.toContain('postgres://');
  expect(text).not.toContain('stack');
  expect(text).not.toContain('token');
  expect(text).not.toContain('secret');
  expect(text).not.toContain('sk_test_phase8_platform_should_not_render');
}

function expectNoSensitivePlatformTenantContent(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('customers');
  expect(text).not.toContain('客户明细');
  expect(text).not.toContain('appointments');
  expect(text).not.toContain('预约明细');
  expect(text).not.toContain('followUpTasks');
  expect(text).not.toContain('随访任务明细');
  expect(text).not.toContain('phoneNumber');
  expect(text).not.toContain('手机号原文');
  expect(text).not.toContain('13800001252');
  expect(text).not.toContain('idNumber');
  expect(text).not.toContain('身份证号');
  expect(text).not.toContain('110101199001010011');
  expect(text).not.toContain('medicalRecordNo');
  expect(text).not.toContain('病历号原文');
  expect(text).not.toContain('MR202605310001');
  expect(text).not.toContain('treatmentRecord');
  expect(text).not.toContain('治疗记录');
  expect(text).not.toContain('病历正文');
  expect(text).not.toContain('完整治疗记录正文不应展示');
  expect(text).not.toContain('consultationTranscript');
  expect(text).not.toContain('咨询对话');
  expect(text).not.toContain('咨询对话全文不应展示');
  expect(text).not.toContain('requestBody');
  expect(text).not.toContain('SQL');
  expect(text).not.toContain('select * from tenant_plans');
  expect(text).not.toContain('DATABASE_URL');
  expect(text).not.toContain('postgres://');
  expect(text).not.toContain('连接串');
  expect(text).not.toContain('stack');
  expect(text).not.toContain('token');
  expect(text).not.toContain('secret');
  expect(text).not.toContain('sk_test_phase9_platform_should_not_render');
  expect(text).not.toContain('phase9-raw-secret');
}

function expectNoPlatformTenantMutation(fetchMock: ReturnType<typeof mockWorkspaceFetch>) {
  const tenantCalls = fetchMock.mock.calls.filter(
    ([input]) => fetchPath(input) === '/api/open-platform/tenants',
  );

  expect(tenantCalls.length).toBeGreaterThan(0);
  for (const [, init] of tenantCalls) {
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.body).toBeUndefined();
  }
}

describe('工作台入口页面', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('机构工作台首页从真实 API 派生指标和行动摘要', async () => {
    const fetchMock = mockWorkspaceFetch();
    render(<HospitalPage />);

    expect(await screen.findByRole('heading', { name: /让咨询团队/ })).toBeInTheDocument();
    expect(screen.getByText('先看到增长机会')).toBeInTheDocument();
    expect(screen.getByText('正在加载机构运营摘要...')).toBeInTheDocument();
    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', { cache: 'no-store' });
    await expectMetric('当前客户摘要', '2');
    await expectMetric('高优先级客户', '1');
    await expectMetric('待确认预约', '1');
    await expectMetric('待处理随访', '1');
    expect(screen.getByText('高风险随访')).toBeInTheDocument();
    expect(screen.getByText('Phase6 客户B：Phase6 D3 异常反馈')).toBeInTheDocument();
    expect(screen.getByText('Phase5 客户A：Phase5 预约复诊')).toBeInTheDocument();
    expect(screen.getByText('Phase5 客户A：Phase5 修复项目')).toBeInTheDocument();
    expect(screen.queryByText('今日高意向客户 18 位')).not.toBeInTheDocument();
    expect(screen.queryByText('AI 已按承接优先级排序')).not.toBeInTheDocument();
    expect(screen.queryByText('实时同步')).not.toBeInTheDocument();
    expect(screen.queryByText('AI 经营副驾驶建议')).not.toBeInTheDocument();
    expect(screen.getAllByText('智美天工').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '工作台' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '客户中心' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '机构端移动导航' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '移动导航：客户中心' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出工作台' })).toBeInTheDocument();
    expect(screen.getByText('近期需要人工处理')).toBeInTheDocument();
    expect(screen.getByText('客户旅程看板')).toBeInTheDocument();
    expect(screen.getByText('当前行动队列')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/customers', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/appointments', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/followups', { cache: 'no-store' });
    expectNoInstitutionMutation(fetchMock);

    fireEvent.click(screen.getByRole('button', { name: '客户中心' }));
    expect(screen.getByRole('heading', { name: '客户中心' })).toBeInTheDocument();
    expect(screen.getByText('客户优先级队列')).toBeInTheDocument();
    expect(await screen.findByText('Phase5 客户A')).toBeInTheDocument();
    expect(screen.getByText('脱敏手机号：138****1252')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '预约中心' }));
    expect(screen.getByRole('heading', { name: '预约中心' })).toBeInTheDocument();
    expect(await screen.findByText('Phase5 预约复诊')).toBeInTheDocument();
    expect(screen.getByText('数据边界')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Phase5 客户A' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '智能随访' }));
    expect(screen.getByRole('heading', { name: '智能随访' })).toBeInTheDocument();
    expect(screen.getByText('今日随访任务')).toBeInTheDocument();
    expect(await screen.findByText('Phase5 D7 回访')).toBeInTheDocument();
    expect(screen.getByText('不会调用 AI provider，也不会自动触达客户。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '审计日志' }));
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(await screen.findByText('audit_phase8_institution')).toBeInTheDocument();
    expect(screen.getByText('资源 ID：cust_phase5_closeout')).toBeInTheDocument();
    expectOnlyInstitutionReadCalls(fetchMock);
  });

  it('机构入口 smoke 覆盖客户中心查看详情时间线', async () => {
    const fetchMock = mockWorkspaceFetch();
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '客户中心' }));
    expect(screen.getByRole('heading', { name: '客户中心' })).toBeInTheDocument();
    expect(await screen.findByText('Phase5 客户A')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看详情 Phase5 客户A' }));

    expect(await screen.findByRole('dialog', { name: '客户详情时间线' })).toBeInTheDocument();
    expect(screen.getAllByText('脱敏手机号：138****1252').length).toBeGreaterThan(0);
    expect(screen.getAllByText('脱敏病历号：MR****525').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Phase5 预约复诊').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Phase5 D7 回访').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Phase5 收尾人工回访').length).toBeGreaterThan(0);
    expect(screen.getByText('审计：read')).toBeInTheDocument();
    expect(screen.getByText('audit_phase7_smoke')).toBeInTheDocument();
    expect(screen.getAllByText('allowed / allowed_by_policy').length).toBeGreaterThan(0);

    const timelineCall = fetchMock.mock.calls.find(
      ([input]) => fetchPath(input) === '/api/institution/customers/cust_phase5_closeout/timeline',
    );
    expect(timelineCall).toBeDefined();
    expect(timelineCall?.[1]).toEqual({ cache: 'no-store' });
    expect(fetchPath(timelineCall![0])).not.toContain('tenantId');
    expect(timelineCall?.[1]?.method).toBeUndefined();
    expect(timelineCall?.[1]?.body).toBeUndefined();
    expectOnlyInstitutionReadCalls(fetchMock);
    expectNoSensitiveCustomerTimelineContent(container);

    fireEvent.click(screen.getByRole('button', { name: '关闭客户详情' }));
    expect(screen.queryByRole('dialog', { name: '客户详情时间线' })).not.toBeInTheDocument();
    expect(screen.getByText('Phase5 客户A')).toBeInTheDocument();
  });

  it('机构导航清晰标注已接入和后续占位入口', async () => {
    const fetchMock = mockWorkspaceFetch();
    render(<HospitalPage />);

    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();
    expect(screen.getAllByText('已接入').length).toBeGreaterThanOrEqual(8);
    expect(screen.getAllByText('后续占位').length).toBeGreaterThanOrEqual(6);

    fireEvent.click(screen.getByRole('button', { name: '客服工作台' }));
    expect(screen.getByText('客服工作台仍为后续占位')).toBeInTheDocument();
    expect(screen.getByText('已真实接入：工作台、客户中心、预约中心、智能随访、审计日志。')).toBeInTheDocument();
    expect(screen.getByText('后续占位：客服工作台、知识库、数据分析。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '知识库' }));
    expect(screen.getByText('知识库仍为后续占位')).toBeInTheDocument();
    expect(screen.getByText('本入口不会在 Phase 6 触发客服、知识库或数据分析真实功能请求。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '数据分析' }));
    expect(screen.getByText('数据分析仍为后续占位')).toBeInTheDocument();
    expectNoInstitutionMutation(fetchMock);
  });

  it('机构端移动导航可切换已接入业务页', async () => {
    const fetchMock = mockWorkspaceFetch();
    render(<HospitalPage />);

    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '移动导航：客户中心' }));
    expect(screen.getByRole('heading', { name: '客户中心' })).toBeInTheDocument();
    expect(await screen.findByText('Phase5 客户A')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '移动导航：预约中心' }));
    expect(screen.getByRole('heading', { name: '预约中心' })).toBeInTheDocument();
    expect(await screen.findByText('Phase5 预约复诊')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '移动导航：智能随访' }));
    expect(screen.getByRole('heading', { name: '智能随访' })).toBeInTheDocument();
    expect(await screen.findByText('Phase5 D7 回访')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '移动导航：审计日志' }));
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(await screen.findByText('audit_phase8_institution')).toBeInTheDocument();
    expectOnlyInstitutionReadCalls(fetchMock);
  });

  it('机构入口 smoke 覆盖审计日志入口和敏感字段边界', async () => {
    const fetchMock = mockWorkspaceFetch();
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '审计日志' }));

    expect(await screen.findByText('audit_phase8_institution')).toBeInTheDocument();
    expect(screen.getByText('资源类型：customer')).toBeInTheDocument();
    expect(screen.getByText('操作：update')).toBeInTheDocument();
    expect(screen.getByText('结果：allowed')).toBeInTheDocument();
    expect(screen.queryByText('租户 ID：demo-tenant-001')).not.toBeInTheDocument();

    const auditCall = fetchMock.mock.calls.find(
      ([input]) => fetchPath(input) === '/api/institution/audit-events',
    );
    expect(auditCall).toBeDefined();
    expect(auditCall?.[1]).toEqual({ cache: 'no-store' });
    expect(fetchPath(auditCall![0])).not.toContain('tenantId');
    expect(auditCall?.[1]?.method).toBeUndefined();
    expect(auditCall?.[1]?.body).toBeUndefined();

    fireEvent.change(screen.getByLabelText('资源 ID'), { target: { value: 'cust_phase5_closeout' } });
    fireEvent.change(screen.getByLabelText('操作者 ID'), { target: { value: 'demo-user-admin' } });
    fireEvent.click(screen.getByRole('button', { name: '应用筛选' }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          fetchPath(input).startsWith('/api/institution/audit-events?'),
        ),
      ).toBe(true),
    );
    const filteredAuditCall = fetchMock.mock.calls.find(([input]) =>
      fetchPath(input).startsWith('/api/institution/audit-events?'),
    );
    const filteredAuditPath = fetchPath(filteredAuditCall![0]);
    expect(filteredAuditPath).toContain('resourceId=cust_phase5_closeout');
    expect(filteredAuditPath).toContain('actorId=demo-user-admin');
    expect(filteredAuditPath).not.toContain('tenantId');
    expect(filteredAuditCall?.[1]).toEqual({ cache: 'no-store' });
    expectOnlyInstitutionReadCalls(fetchMock);
    expectNoSensitiveAuditContent(container);
  });

  it('机构工作台首页展示空状态', async () => {
    const fetchMock = mockWorkspaceFetch({
      customers: [],
      appointments: [],
      followups: [],
    });
    render(<HospitalPage />);

    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();
    expect(await screen.findByText('暂无可计算运营摘要')).toBeInTheDocument();
    await expectMetric('当前客户摘要', '0');
    await expectMetric('高优先级客户', '0');
    await expectMetric('待确认预约', '0');
    await expectMetric('待处理随访', '0');
    expect(screen.getByText('当前客户、预约和随访 records 为空。')).toBeInTheDocument();
    expect(screen.getByText('当前没有可展示的待处理行动。')).toBeInTheDocument();
    expectNoInstitutionMutation(fetchMock);
  });

  it.each([
    [401, '请先登录', '登录状态已失效，请重新登录'],
    [403, '没有访问权限', '当前账号没有访问机构首页数据的权限'],
    [503, '数据服务暂时不可用', '数据服务暂时不可用'],
  ])('机构工作台首页处理 %s 错误态', async (status, apiMessage, visibleMessage) => {
    const fetchMock = mockWorkspaceFetch({
      institutionError: {
        path: '/api/institution/customers',
        status,
        message: apiMessage,
      },
    });
    render(<HospitalPage />);

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
    expect(screen.queryByText('今日高意向客户 18 位')).not.toBeInTheDocument();
    expect(screen.queryByText('AI 已按承接优先级排序')).not.toBeInTheDocument();
    expect(screen.queryByText('实时同步')).not.toBeInTheDocument();
    expectNoInstitutionMutation(fetchMock);
  });

  it('渲染平台控制台页面壳', async () => {
    mockWorkspaceFetch({ role: 'platform_admin' });
    render(<OpenPlatformPage />);

    expect(await screen.findByRole('heading', { name: /掌控租户、模型与接口/ })).toBeInTheDocument();
    expect(screen.getByText('让平台运营可观测')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '平台总览' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '首页与品牌' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '权限与审计' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '平台端移动导航' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '移动导航：开放连接中心' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出平台' })).toBeInTheDocument();
    expect(screen.getByText('平台增长与调用趋势')).toBeInTheDocument();
    expect(screen.getByText('开放接口治理')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '开放平台基础治理' })).toBeInTheDocument();
    expect(screen.getByText('服务端租户上下文')).toBeInTheDocument();
    expect(screen.getByText('权限样例矩阵')).toBeInTheDocument();
    expect(screen.getByText('审计事件词汇')).toBeInTheDocument();
  });

  it('平台端租户管理入口接入租户 API 并展示套餐配额摘要', async () => {
    const fetchMock = mockWorkspaceFetch({ role: 'platform_admin' });
    const { container } = render(<OpenPlatformPage />);

    expect(await screen.findByRole('heading', { name: /掌控租户、模型与接口/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '租户管理' }));

    expect(screen.getByText('正在加载租户管理数据...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '租户管理' })).toBeInTheDocument();
    expect(screen.getByText('智美天工演示机构')).toBeInTheDocument();
    expect(screen.getByText('租户状态：active')).toBeInTheDocument();
    expect(screen.getByText('套餐名称：成长版')).toBeInTheDocument();
    expect(screen.getByText('套餐 code：growth-care')).toBeInTheDocument();
    expect(screen.getByText('24 / 5000')).toBeInTheDocument();
    expect(screen.getByText('12 / 2000')).toBeInTheDocument();
    expect(screen.getByText('36 / 10000')).toBeInTheDocument();
    expect(screen.getByText('0 / 50000')).toBeInTheDocument();
    expect(screen.getByText('快照时间：2026年5月31日 16:00')).toBeInTheDocument();

    const tenantCall = fetchMock.mock.calls.find(
      ([input]) => fetchPath(input) === '/api/open-platform/tenants',
    );
    expect(tenantCall).toBeDefined();
    expect(tenantCall?.[1]).toEqual({ cache: 'no-store' });
    expect(tenantCall?.[1]?.method).toBeUndefined();
    expect(tenantCall?.[1]?.body).toBeUndefined();
    expectNoPlatformTenantMutation(fetchMock);
    expectNoSensitivePlatformTenantContent(container);
  });

  it('平台端租户管理入口展示 empty 状态', async () => {
    const fetchMock = mockWorkspaceFetch({ role: 'platform_admin', platformTenants: [] });
    const { container } = render(<OpenPlatformPage />);

    expect(await screen.findByRole('heading', { name: /掌控租户、模型与接口/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '租户管理' }));

    expect(await screen.findByText('暂无租户运营元数据')).toBeInTheDocument();
    expect(screen.getByText('当前没有可展示的租户套餐和配额数据。')).toBeInTheDocument();
    expectNoPlatformTenantMutation(fetchMock);
    expectNoSensitivePlatformTenantContent(container);
  });

  it.each([
    [403, '没有访问权限', '当前账号没有查看租户管理的权限'],
    [503, '数据服务暂时不可用', '租户管理数据暂时不可用'],
  ])('平台端租户管理入口处理 %s 错误态', async (status, apiMessage, visibleMessage) => {
    const fetchMock = mockWorkspaceFetch({
      role: 'platform_admin',
      platformTenantError: { status, message: apiMessage },
    });
    const { container } = render(<OpenPlatformPage />);

    expect(await screen.findByRole('heading', { name: /掌控租户、模型与接口/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '租户管理' }));

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
    expectNoPlatformTenantMutation(fetchMock);
    expectNoSensitivePlatformTenantContent(container);
  });

  it('平台端权限与审计入口展示审计日志并保持敏感字段边界', async () => {
    const fetchMock = mockWorkspaceFetch({ role: 'platform_admin' });
    const { container } = render(<OpenPlatformPage />);

    expect(await screen.findByRole('heading', { name: /掌控租户、模型与接口/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '权限与审计' }));

    expect(await screen.findByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByText('audit_phase8_platform')).toBeInTheDocument();
    expect(screen.getByText('租户 ID：demo-tenant-001')).toBeInTheDocument();
    expect(screen.getByText('资源类型：customer')).toBeInTheDocument();
    expect(screen.getByText('结果：allowed')).toBeInTheDocument();
    expect(screen.getByLabelText('租户 ID')).toBeInTheDocument();

    const auditCall = fetchMock.mock.calls.find(
      ([input]) => fetchPath(input) === '/api/open-platform/audit-events',
    );
    expect(auditCall).toBeDefined();
    expect(auditCall?.[1]).toEqual({ cache: 'no-store' });
    expect(auditCall?.[1]?.method).toBeUndefined();
    expect(auditCall?.[1]?.body).toBeUndefined();

    fireEvent.change(screen.getByLabelText('租户 ID'), { target: { value: 'demo-tenant-001' } });
    fireEvent.change(screen.getByLabelText('资源类型'), { target: { value: 'customer' } });
    fireEvent.click(screen.getByRole('button', { name: '应用筛选' }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          fetchPath(input).includes('tenantId=demo-tenant-001'),
        ),
      ).toBe(true),
    );
    const filteredAuditCall = fetchMock.mock.calls.find(([input]) =>
      fetchPath(input).includes('tenantId=demo-tenant-001'),
    );
    const filteredAuditPath = fetchPath(filteredAuditCall![0]);
    expect(filteredAuditPath).toContain('/api/open-platform/audit-events?');
    expect(filteredAuditPath).toContain('resource=customer');
    expect(filteredAuditCall?.[1]).toEqual({ cache: 'no-store' });
    expectNoSensitivePlatformAuditContent(container);
  });
});
