import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppointmentCenterShell } from '@/modules/institution/components/AppointmentCenterShell';
import { InstitutionAuditEventsShell } from '@/modules/institution/components/InstitutionAuditEventsShell';
import { CustomerCenterShell } from '@/modules/institution/components/CustomerCenterShell';
import { SmartFollowUpShell } from '@/modules/institution/components/SmartFollowUpShell';
import { getDefaultWeComAuthorizationDashboardView } from '@/modules/institution/domain/wecom-authorization';
import { getDefaultWeComCustomerContactSyncDashboardView } from '@/modules/institution/domain/wecom-customer-contact';
import { getDefaultWeComMockReachOutDashboardView } from '@/modules/institution/domain/wecom-reachout-mock';

const customerRecord = {
  id: 'cust_wang_repurchase',
  tenantId: 'demo-tenant-001',
  displayName: '王女士',
  lifecycle: 'repurchase_window',
  priority: 'high',
  ownerUserId: 'consultant-lin',
  projectInterest: '热玛吉修复组合',
  maskedPhone: '138****1208',
  maskedMedicalRecordNo: 'MR****001',
  lastTouchSummary: '术后第 28 天',
  nextAction: '安排资深咨询师人工回访',
  tags: ['高价值', '近期咨询补水'],
  gender: '',
  birthDate: '',
  referralSource: '',
  notes: '',
};

const appointmentRecord = {
  id: 'appt_wang_pending',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_wang_repurchase',
  customerDisplayName: '王女士',
  project: '热玛吉复诊',
  scheduledAt: '2026-06-01T10:30:00+08:00',
  consultantUserId: 'consultant-lin',
  status: 'pending_confirmation',
  note: '待电话确认到院',
};

const followUpRecord = {
  id: 'fu_wang_d28',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_wang_repurchase',
  customerDisplayName: '王女士',
  journeyId: 'journey_repurchase',
  stage: 'D28 复购建议',
  status: 'due',
  dueAt: '2026-05-30T18:00:00+08:00',
  suggestedAction: '人工回访并推荐修复组合',
  riskLevel: 'urgent',
  updatedBy: null,
  updatedAt: null,
};

const treatmentSummaryFollowUpRecord = {
  ...followUpRecord,
  id: 'fu_treatment_summary_source',
  customerDisplayName: '陈女士',
  stage: '治疗摘要 D3 护理随访',
  status: 'scheduled',
  dueAt: '2026-05-31T09:00:00+08:00',
  suggestedAction: '根据治疗摘要建议，人工确认恢复情况。',
  riskLevel: 'watch',
  source: 'treatment_summary',
  sourceTreatmentSummaryId: 'trt_source_001',
  sourceSuggestionKey: 'trt_source_001:watch_risk_followup:3d',
  phoneNumber: '13800000000',
  idNumber: '110101199001010011',
  medicalRecordNo: 'MR-RAW-001',
  treatmentRecord: '完整治疗记录正文',
  medicalRecordBody: '完整病历正文',
  consultationTranscript: '咨询对话全文',
  sql: 'select * from follow_up_tasks',
  stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_should_not_render',
  secret: 'raw-secret',
};

const auditEventRecord = {
  id: 'audit_evt_customer',
  tenantId: 'demo-tenant-001',
  resource: 'customer',
  resourceId: 'cust_wang_repurchase',
  action: 'update',
  result: 'allowed',
  reason: 'allowed_by_policy',
  actorId: 'demo-user-admin',
  actorRole: 'tenant_admin',
  occurredAt: '2026-05-31T09:00:00.000Z',
  requestBody: { phoneNumber: '13800000000' },
  metadata: { sql: 'select * from audit_events' },
  stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_should_not_render',
  secret: 'raw-secret',
};

const customerTimelineResponse = {
  customer: {
    id: 'cust_wang_repurchase',
    displayName: '王女士',
    lifecycle: 'repurchase_window',
    priority: 'high',
    projectInterest: '热玛吉修复组合',
    maskedPhone: '138****1208',
    maskedMedicalRecordNo: 'MR****001',
    ownerUserId: 'consultant-lin',
    tags: ['高价值', '近期咨询补水'],
    lastTouchSummary: '术后第 28 天',
    nextAction: '安排资深咨询师人工回访',
    phoneNumber: '13800000000',
    idNumber: '110101199001010011',
  },
  appointments: [
    {
      id: 'appt_wang_pending',
      project: '热玛吉复诊',
      scheduledAt: '2026-06-01T10:30:00+08:00',
      consultantUserId: 'consultant-lin',
      status: 'pending_confirmation',
      note: '待电话确认到院',
      requestBody: { phoneNumber: '13800000000' },
    },
  ],
  followups: [
    {
      id: 'fu_wang_d28',
      journeyId: 'journey_repurchase',
      stage: 'D28 复购建议',
      status: 'due',
      dueAt: '2026-05-30T18:00:00+08:00',
      suggestedAction: '人工回访并推荐修复组合',
      riskLevel: 'urgent',
      updatedBy: null,
      updatedAt: null,
      sql: 'select * from customers',
    },
  ],
  treatmentSummaries: [
    {
      id: 'trt_wang_d7',
      appointmentId: 'appt_wang_pending',
      treatmentDate: '2026-06-01T12:10:00+08:00',
      treatmentProject: '光电修复',
      treatmentCategory: 'laser_repair',
      treatmentStage: 'D7 复诊',
      recoveryStage: 'D7',
      riskLevel: 'watch',
      ownerUserId: 'doctor-lin',
      summary: '结构化摘要：红肿减轻，安排补水护理。',
      nextCareAction: 'D14 人工回访恢复阶段。',
      tags: ['结构化摘要', '术后关怀'],
      createdAt: '2026-06-01T12:10:00+08:00',
      updatedAt: '2026-06-01T12:10:00+08:00',
      phoneNumber: '13800000000',
      idNumber: '110101199001010011',
      medicalRecordNo: 'MR-RAW-001',
      treatmentRecord: '完整治疗记录正文',
      medicalRecordBody: '完整病历正文',
      consultationTranscript: '咨询对话全文',
      sql: 'select * from treatment_summaries',
      stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
      token: 'sk_test_should_not_render',
      secret: 'raw-secret',
    },
  ],
  auditEvents: [
    {
      id: 'audit_evt_001',
      action: 'update',
      result: 'allowed',
      reason: 'allowed_by_policy',
      actor: { id: 'demo-user-admin', role: 'tenant_admin' },
      occurredAt: '2026-06-03T09:00:00.000Z',
      resource: 'customer',
      resourceId: 'cust_wang_repurchase',
      stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
      token: 'sk_test_should_not_render',
    },
  ],
  followUpTimelineEvents: [
    {
      eventId: 'ftl_wang_path_enrolled',
      customerId: 'cust_wang_repurchase',
      eventType: 'followup_path_enrolled',
      eventTitle: '纳入随访路径',
      safeSummary: '王女士已纳入 post_treatment_repair，阶段 3 个，任务 3 个。',
      riskLevel: null,
      occurredAt: '2026-06-01T12:20:00+08:00',
      sourceType: 'path_enrollment',
      sourceId: 'enroll_wang_001',
      safeReasonCode: 'followup_path_enrolled',
    },
  ],
  followUpOverview: {
    activeEnrollmentCount: 1,
    pendingTaskCount: 1,
    overdueTaskCount: 1,
    draftCount: 1,
    approvedDraftCount: 0,
    markedSentCount: 0,
    escalatedCount: 1,
  },
  timeline: [
    {
      id: 'audit:audit_evt_001',
      type: 'audit',
      occurredAt: '2026-06-03T09:00:00.000Z',
      title: '审计：update',
      summary: 'allowed / allowed_by_policy',
      status: 'allowed',
      source: 'customer',
      relatedRecordId: 'cust_wang_repurchase',
    },
    {
      id: 'appointment:appt_wang_pending',
      type: 'appointment',
      occurredAt: '2026-06-01T10:30:00+08:00',
      title: '热玛吉复诊预约',
      summary: '待电话确认到院',
      status: 'pending_confirmation',
      source: 'appointment',
      relatedRecordId: 'appt_wang_pending',
    },
    {
      id: 'treatment_summary:trt_wang_d7',
      type: 'treatment_summary',
      occurredAt: '2026-06-01T12:10:00+08:00',
      title: '光电修复 · D7 复诊',
      summary: '结构化摘要：红肿减轻，安排补水护理。',
      status: 'watch',
      source: 'treatment_summary',
      relatedRecordId: 'trt_wang_d7',
      riskLevel: 'watch',
      tags: ['结构化摘要', '术后关怀'],
      treatmentRecord: '完整治疗记录正文',
      medicalRecordBody: '完整病历正文',
      consultationTranscript: '咨询对话全文',
      sql: 'select * from treatment_summaries',
      stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
      token: 'sk_test_should_not_render',
      secret: 'raw-secret',
    },
    {
      id: 'follow_up:fu_wang_d28',
      type: 'follow_up',
      occurredAt: '2026-05-30T18:00:00+08:00',
      title: 'D28 复购建议',
      summary: '人工回访并推荐修复组合',
      status: 'due',
      source: 'follow_up',
      relatedRecordId: 'fu_wang_d28',
    },
  ],
};

const createdTreatmentSummaryRecord = {
  id: 'trt_wang_created',
  appointmentId: 'appt_wang_pending',
  treatmentDate: '2026-06-02T16:30:00+08:00',
  treatmentProject: '水光补水复诊',
  treatmentCategory: 'skin_repair',
  treatmentStage: 'D14 复诊',
  recoveryStage: 'D14',
  riskLevel: 'watch',
  ownerUserId: 'doctor-lin',
  summary: '结构化摘要：恢复稳定，安排补水。',
  nextCareAction: 'D21 人工回访恢复阶段。',
  tags: ['结构化摘要', '复诊'],
  createdAt: '2026-06-02T16:30:00+08:00',
  updatedAt: '2026-06-02T16:30:00+08:00',
};

const customerTimelineAfterTreatmentSummaryCreate = {
  ...customerTimelineResponse,
  treatmentSummaries: [
    createdTreatmentSummaryRecord,
    ...customerTimelineResponse.treatmentSummaries,
  ],
  timeline: [
    {
      id: 'treatment_summary:trt_wang_created',
      type: 'treatment_summary',
      occurredAt: '2026-06-02T16:30:00+08:00',
      title: '水光补水复诊 · D14 复诊',
      summary: '结构化摘要：恢复稳定，安排补水。',
      status: 'watch',
      source: 'treatment_summary',
      relatedRecordId: 'trt_wang_created',
      riskLevel: 'watch',
      tags: ['结构化摘要', '复诊'],
    },
    ...customerTimelineResponse.timeline,
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

function mockCustomerFetch(responses: Response[]) {
  const fetchMock = vi.fn(async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) => {
    const response = responses.shift();
    if (!response) {
      throw new Error('没有配置更多 fetch 响应');
    }

    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function mockInstitutionFetch(responsesByPath: Record<string, Response[]>) {
  const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) => {
    const path = fetchPath(input);
    const responses = responsesByPath[path];
    const response = responses?.shift() ??
      (path === '/api/institution/followup-paths/enrollments'
        ? jsonResponse({ records: [] })
        : path === '/api/institution/followup-operations/dashboard'
          ? jsonResponse({
              overview: {
                activeEnrollmentCount: 0,
                todayDueTaskCount: 0,
                overdueTaskCount: 0,
                pendingTaskCount: 0,
                completedTaskCount: 0,
                escalatedTaskCount: 0,
                highRiskTaskCount: 0,
                draftCount: 0,
                approvedDraftCount: 0,
                markedSentCount: 0,
                approvedButNotMarkedSentCount: 0,
                messageDeliveryCount: 0,
                mockSentCount: 0,
                mockFailedCount: 0,
                skippedCount: 0,
                externalDisabledCount: 0,
                contactSafetyAllowedCount: 0,
                consentMissingBlockedCount: 0,
                optOutBlockedCount: 0,
                frequencyCapBlockedCount: 0,
                channelDisabledCount: 0,
                grayGuardBlockedCount: 0,
                manualFeedbackCount: 0,
              },
              pathPerformance: [],
              workload: [],
              draftOperations: {
                draftCount: 0,
                approvedDraftCount: 0,
                rejectedDraftCount: 0,
                markedSentCount: 0,
                approvedButNotMarkedSentCount: 0,
              },
              messageDeliveries: {
                messageDeliveryCount: 0,
                mockSentCount: 0,
                mockFailedCount: 0,
                skippedCount: 0,
                externalDisabledCount: 0,
                recentDeliveries: [],
              },
              contactSafety: {
                allowedCount: 0,
                consentMissingBlockedCount: 0,
                optOutBlockedCount: 0,
                frequencyCapBlockedCount: 0,
                channelDisabledCount: 0,
                tenantGrayBlockedCount: 0,
                institutionGrayBlockedCount: 0,
                grayGuardBlockedCount: 0,
              },
              weComAuthorization: getDefaultWeComAuthorizationDashboardView(),
              weComCustomerContactSync: getDefaultWeComCustomerContactSyncDashboardView(),
              weComMockReachOut: getDefaultWeComMockReachOutDashboardView(),
              riskSummary: {
                escalatedTaskCount: 0,
                highRiskTaskCount: 0,
                highRiskPendingTaskCount: 0,
                overdueHighRiskTaskCount: 0,
                manualFeedbackCount: 0,
              },
            })
          : path.startsWith('/api/institution/followup-message-drafts?taskId=')
            ? jsonResponse({ records: [] })
            : null);
    if (!response) {
      throw new Error(`没有为 ${path} 配置更多 fetch 响应`);
    }

    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function mockAuditEventsFetch(responses: Response[]) {
  const fetchMock = vi.fn(async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) => {
    const response = responses.shift();
    if (!response) {
      throw new Error('没有配置更多审计日志 fetch 响应');
    }

    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

function auditEventsResponse(records: unknown[], pageInfo = { hasMore: false, limit: 50, nextCursor: null }) {
  return jsonResponse({ records, pageInfo });
}

function expectNoSensitiveTimelineContent(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('13800000000');
  expect(text).not.toContain('110101199001010011');
  expect(text).not.toContain('MR-RAW-001');
  expect(text).not.toContain('完整治疗记录正文');
  expect(text).not.toContain('完整病历正文');
  expect(text).not.toContain('咨询对话全文');
  expect(text).not.toContain('requestBody');
  expect(text).not.toContain('select * from customers');
  expect(text).not.toContain('select * from treatment_summaries');
  expect(text).not.toContain('DATABASE_URL');
  expect(text).not.toContain('postgres://');
  expect(text).not.toContain('sk_test_should_not_render');
  expect(text).not.toContain('token');
  expect(text).not.toContain('stack');
  expect(text).not.toContain('secret');
}

function expectNoSensitiveAuditContent(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('tenantId');
  expect(text).not.toContain('13800000000');
  expect(text).not.toContain('110101199001010011');
  expect(text).not.toContain('MR-RAW-001');
  expect(text).not.toContain('完整治疗记录正文');
  expect(text).not.toContain('咨询对话全文');
  expect(text).not.toContain('requestBody');
  expect(text).not.toContain('metadata');
  expect(text).not.toContain('select * from audit_events');
  expect(text).not.toContain('DATABASE_URL');
  expect(text).not.toContain('postgres://');
  expect(text).not.toContain('sk_test_should_not_render');
  expect(text).not.toContain('token');
  expect(text).not.toContain('stack');
  expect(text).not.toContain('secret');
}

function requestBody(fetchMock: ReturnType<typeof mockCustomerFetch>, callIndex: number) {
  const call = fetchMock.mock.calls[callIndex];
  if (!call) {
    throw new Error(`缺少第 ${callIndex + 1} 次 fetch 调用`);
  }

  const [, init] = call;
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

function mutationBody(
  fetchMock: ReturnType<typeof mockInstitutionFetch>,
  path: string,
  method: string,
) {
  const call = fetchMock.mock.calls.find(
    ([input, init]) => fetchPath(input) === path && init?.method === method,
  );
  if (!call) {
    throw new Error(`缺少 ${method} ${path} 调用`);
  }

  return JSON.parse(String(call[1]?.body)) as Record<string, unknown>;
}

function fillTreatmentSummaryForm(drawer: HTMLElement) {
  const drawerView = within(drawer);

  fireEvent.change(drawerView.getByLabelText('治疗时间'), {
    target: { value: '2026-06-02T16:30:00+08:00' },
  });
  fireEvent.change(drawerView.getByLabelText('治疗项目'), {
    target: { value: '水光补水复诊' },
  });
  fireEvent.change(drawerView.getByLabelText('治疗类别'), {
    target: { value: 'skin_repair' },
  });
  fireEvent.change(drawerView.getByLabelText('治疗阶段'), {
    target: { value: 'D14 复诊' },
  });
  fireEvent.change(drawerView.getByLabelText('恢复阶段'), {
    target: { value: 'D14' },
  });
  fireEvent.change(drawerView.getByLabelText('风险等级'), {
    target: { value: 'watch' },
  });
  fireEvent.change(drawerView.getByLabelText('负责人 ID'), {
    target: { value: 'doctor-lin' },
  });
  fireEvent.change(drawerView.getByLabelText('摘要'), {
    target: { value: '结构化摘要：恢复稳定，安排补水。' },
  });
  fireEvent.change(drawerView.getByLabelText('下一步护理'), {
    target: { value: 'D21 人工回访恢复阶段。' },
  });
  fireEvent.change(drawerView.getByLabelText('标签'), {
    target: { value: '结构化摘要, 复诊' },
  });
  fireEvent.change(drawerView.getByLabelText('关联预约 ID（可选）'), {
    target: { value: 'appt_wang_pending' },
  });
}

describe('机构业务页面壳', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('审计日志页面从机构审计 API 加载并展示安全字段', async () => {
    const pending = deferredResponse();
    const fetchMock = vi.fn(async () => pending.promise);
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(<InstitutionAuditEventsShell />);

    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByText('关键操作可追踪')).toBeInTheDocument();
    expect(screen.getByText('正在加载审计事件...')).toBeInTheDocument();
    pending.resolve(auditEventsResponse([auditEventRecord]));

    expect(await screen.findByText('audit_evt_customer')).toBeInTheDocument();
    expect(screen.getByText('资源类型：customer')).toBeInTheDocument();
    expect(screen.getByText('资源 ID：cust_wang_repurchase')).toBeInTheDocument();
    expect(screen.getByText('操作：update')).toBeInTheDocument();
    expect(screen.getByText('结果：allowed')).toBeInTheDocument();
    expect(screen.getByText('原因：allowed_by_policy')).toBeInTheDocument();
    expect(screen.getByText('操作者：demo-user-admin')).toBeInTheDocument();
    expect(screen.getByText('角色：tenant_admin')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/audit-events', { cache: 'no-store' });
    expectNoSensitiveAuditContent(container);
  });

  it('审计日志页面提供白名单筛选控件并只发送筛选参数', async () => {
    const fetchMock = mockAuditEventsFetch([
      auditEventsResponse([]),
      auditEventsResponse([{ ...auditEventRecord, id: 'audit_evt_filtered' }]),
    ]);

    render(<InstitutionAuditEventsShell />);

    expect(await screen.findByText('暂无审计事件')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('资源类型'), { target: { value: 'customer' } });
    fireEvent.change(screen.getByLabelText('资源 ID'), { target: { value: 'cust_wang_repurchase' } });
    fireEvent.change(screen.getByLabelText('操作'), { target: { value: 'update' } });
    fireEvent.change(screen.getByLabelText('结果'), { target: { value: 'allowed' } });
    fireEvent.change(screen.getByLabelText('原因'), { target: { value: 'allowed_by_policy' } });
    fireEvent.change(screen.getByLabelText('操作者 ID'), { target: { value: 'demo-user-admin' } });
    fireEvent.click(screen.getByRole('button', { name: '应用筛选' }));

    expect(await screen.findByText('audit_evt_filtered')).toBeInTheDocument();
    const secondPath = fetchPath(fetchMock.mock.calls[1]?.[0] ?? '');
    expect(secondPath).toContain('/api/institution/audit-events?');
    expect(secondPath).toContain('resource=customer');
    expect(secondPath).toContain('resourceId=cust_wang_repurchase');
    expect(secondPath).toContain('action=update');
    expect(secondPath).toContain('result=allowed');
    expect(secondPath).toContain('reason=allowed_by_policy');
    expect(secondPath).toContain('actorId=demo-user-admin');
    expect(secondPath).not.toContain('tenantId');
    expect(fetchMock.mock.calls[1]?.[1]).toEqual({ cache: 'no-store' });
  });

  it('审计日志页面展示空状态', async () => {
    mockAuditEventsFetch([auditEventsResponse([])]);

    render(<InstitutionAuditEventsShell />);

    expect(await screen.findByText('暂无审计事件')).toBeInTheDocument();
    expect(screen.getByText('当前筛选条件下没有可展示的关键操作记录。')).toBeInTheDocument();
  });

  it.each([
    [401, '请先登录', '登录状态已失效，请重新登录'],
    [403, '没有访问权限', '当前账号没有查看审计日志的权限'],
    [503, '数据服务暂时不可用', '关键操作记录暂时不可用'],
  ])('审计日志页面处理 %s 错误态', async (status, apiMessage, visibleMessage) => {
    mockAuditEventsFetch([jsonResponse({ error: apiMessage }, { status })]);

    render(<InstitutionAuditEventsShell />);

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
  });

  it('客户中心从真实 API 加载并展示客户 records', async () => {
    const fetchMock = mockCustomerFetch([
      jsonResponse({
        records: [
          customerRecord,
          {
            ...customerRecord,
            id: 'cust_zhao_post_care',
            displayName: '赵女士',
            lifecycle: 'post_care',
            priority: 'medium',
            ownerUserId: 'service-group-a',
            maskedPhone: '137****8842',
            maskedMedicalRecordNo: 'MR****003',
          },
        ],
      }),
    ]);

    render(<CustomerCenterShell />);

    expect(screen.getByRole('heading', { name: '客户中心' })).toBeInTheDocument();
    expect(screen.getByText(/客户、预约、随访任务统一进入运营视图/u)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('虚构 demo 客户');
    expect(document.body.textContent).not.toContain('受控 demo');
    expect(screen.getByText('正在加载客户数据...')).toBeInTheDocument();
    expect(await screen.findByText('王女士')).toBeInTheDocument();
    expect(screen.getAllByText('赵女士').length).toBeGreaterThan(0);
    expect(screen.getByText('高意向待承接')).toBeInTheDocument();
    expect(screen.getByText('术后关怀中')).toBeInTheDocument();
    expect(screen.getAllByText('高优先级').length).toBeGreaterThan(0);
    expect(screen.getAllByText('复购窗口期').length).toBeGreaterThan(0);
    expect(screen.getByText('负责人：consultant-lin')).toBeInTheDocument();
    expect(screen.getByText('脱敏手机号：138****1208')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/customers', { cache: 'no-store' });
  });

  it('客户中心展示空状态和创建入口', async () => {
    mockCustomerFetch([jsonResponse({ records: [] })]);

    render(<CustomerCenterShell />);

    expect(await screen.findByText('暂无客户记录')).toBeInTheDocument();
    expect(screen.getByText('当前没有可展示的客户旅程记录，可先创建只包含脱敏展示字段的客户摘要。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建客户' })).toBeInTheDocument();
    expect(screen.getByLabelText('脱敏手机号展示值')).toBeInTheDocument();
    expect(screen.getByLabelText('脱敏病历号展示值')).toBeInTheDocument();
  });

  it('客户中心展示低敏导入预检、失败原因和执行结果', async () => {
    const previewResponse = {
      importBatch: {
        importBatchId: 'customer-import:test-batch',
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        operatorRef: 'operator-a',
        fieldWhitelist: ['customerDisplayName', 'ageRange', 'treatmentProject', 'lastVisitDate', 'importedCustomerRef'],
        rows: [
          {
            rowNumber: 1,
            status: 'ready',
            customerDisplayName: '低敏客户A',
            importedCustomerRef: 'import-ref-a',
            duplicateKey: 'imported_ref:import-ref-a',
            issues: [],
          },
          {
            rowNumber: 2,
            status: 'skipped',
            customerDisplayName: null,
            importedCustomerRef: null,
            duplicateKey: null,
            issues: [
              { reason: 'missing_required_field', field: 'customerDisplayName', message: '字段 customerDisplayName 必填' },
            ],
          },
        ],
        createdAt: '2026-07-08T10:00:00.000Z',
        updatedAt: '2026-07-08T10:00:00.000Z',
      },
      totalCount: 2,
      successCount: 1,
      failureCount: 1,
      skippedCount: 1,
      canExecute: true,
      boundary: {
        mode: 'low_sensitive_customer_import',
        supportsPreview: true,
        writesCustomerRecordsOnExecute: true,
        noHis: true,
        noRealWeCom: true,
        noSms: true,
        noWebhook: true,
        noRealSend: true,
        forbiddenData: ['真实手机号', '身份证', '病历号', '聊天记录'],
      },
    };
    const executeResponse = {
      ...previewResponse,
      importedCustomerIds: ['cust_import_a'],
    };
    const fetchMock = mockCustomerFetch([
      jsonResponse({ records: [] }),
      jsonResponse(previewResponse),
      jsonResponse(executeResponse),
      jsonResponse({
        records: [
          {
            ...customerRecord,
            id: 'cust_import_a',
            displayName: '低敏客户A',
            tags: ['低敏导入', 'institution_ref:inst-a'],
            maskedPhone: 'masked-import-only',
            maskedMedicalRecordNo: 'masked-import-record',
          },
        ],
      }),
    ]);

    render(<CustomerCenterShell />);

    expect(await screen.findByRole('heading', { name: '低敏客户导入' })).toBeInTheDocument();
    expect(screen.getByText('不接 HIS')).toBeInTheDocument();
    expect(screen.getByText('不接真实企业微信')).toBeInTheDocument();
    expect(screen.getByText('不导入手机号 / 身份证 / 病历号')).toBeInTheDocument();
    expect(screen.getByText('字段白名单')).toBeInTheDocument();

    const textarea = screen.getByLabelText('导入 JSON 数组');
    fireEvent.change(textarea, {
      target: {
        value: JSON.stringify([
          { customerDisplayName: '低敏客户A', ageRange: '30-39', treatmentProject: '皮肤管理', lastVisitDate: '2026-07-01', importedCustomerRef: 'import-ref-a' },
          { treatmentProject: '皮肤管理' },
        ]),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: '导入预检' }));

    expect(await screen.findByText('失败原因')).toBeInTheDocument();
    expect(screen.getByText(/第 2 行 · 必填字段缺失/u)).toBeInTheDocument();
    expect(screen.getByText('customer-import:test-batch')).toBeInTheDocument();

    const previewBody = requestBody(fetchMock, 1);
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/institution/customers/import', expect.objectContaining({
      method: 'POST',
    }));
    expect(previewBody).toHaveProperty('rows');
    expect(JSON.stringify(previewBody)).not.toContain('tenantId');
    expect(JSON.stringify(previewBody)).not.toContain('institutionId');
    expect(JSON.stringify(previewBody)).not.toContain('operatorRef');
    expect(JSON.stringify(previewBody)).not.toContain('13800000000');

    fireEvent.click(screen.getByRole('button', { name: '执行合法行导入' }));

    expect(await screen.findByText('已写入 1 条低敏客户记录，并记录导入审计。')).toBeInTheDocument();
    expect(await screen.findByText('低敏客户A')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/institution/customers/import', expect.objectContaining({
      method: 'PUT',
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/institution/customers', { cache: 'no-store' });
  });

  it.each([
    [401, '请先登录', '登录状态已失效，请重新登录'],
    [403, '没有访问权限', '当前账号没有访问客户数据的权限'],
    [503, '数据服务暂时不可用', '数据服务暂时不可用，请稍后刷新或切换演示备份'],
  ])('客户中心处理 %s 错误态', async (status, apiMessage, visibleMessage) => {
    mockCustomerFetch([jsonResponse({ error: apiMessage }, { status })]);

    render(<CustomerCenterShell />);

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
  });

  it('新建客户只提交白名单字段并在成功后更新界面', async () => {
    const fetchMock = mockCustomerFetch([
      jsonResponse({ records: [] }),
      jsonResponse({ record: { ...customerRecord, id: 'cust_created', displayName: '林女士' } }, { status: 201 }),
    ]);

    render(<CustomerCenterShell />);

    expect(await screen.findByText('暂无客户记录')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('客户姓名'), { target: { value: '林女士' } });
    fireEvent.change(screen.getByLabelText('生命周期'), { target: { value: 'consulting' } });
    fireEvent.change(screen.getByLabelText('优先级'), { target: { value: 'high' } });
    fireEvent.change(screen.getByLabelText('负责人 ID'), { target: { value: 'consultant-lin' } });
    fireEvent.change(screen.getByLabelText('项目兴趣'), { target: { value: '皮肤管理' } });
    fireEvent.change(screen.getByLabelText('脱敏手机号展示值'), { target: { value: '138****1208' } });
    fireEvent.change(screen.getByLabelText('脱敏病历号展示值'), { target: { value: 'MR****001' } });
    fireEvent.change(screen.getByLabelText('最近触达摘要'), { target: { value: '初次咨询' } });
    fireEvent.change(screen.getByLabelText('下一步动作'), { target: { value: '预约到店' } });
    fireEvent.change(screen.getByLabelText('客户标签'), { target: { value: '新客, 高意向' } });
    fireEvent.click(screen.getByRole('button', { name: '创建客户' }));

    expect(await screen.findByText('林女士')).toBeInTheDocument();
    const body = requestBody(fetchMock, 1);
    const serializedBody = JSON.stringify(body);

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/institution/customers', expect.objectContaining({
      method: 'POST',
    }));
    expect(body).toEqual({
      displayName: '林女士',
      lifecycle: 'consulting',
      priority: 'high',
      ownerUserId: 'consultant-lin',
      projectInterest: '皮肤管理',
      maskedPhone: '138****1208',
      maskedMedicalRecordNo: 'MR****001',
      lastTouchSummary: '初次咨询',
      nextAction: '预约到店',
      tags: ['新客', '高意向'],
      gender: '',
      birthDate: '',
      referralSource: '',
      notes: '',
    });
    expect(serializedBody).not.toContain('tenantId');
    expect(serializedBody).not.toContain('phoneNumber');
    expect(serializedBody).not.toContain('idNumber');
    expect(serializedBody).not.toContain('medicalRecordNo');
    expect(serializedBody).not.toContain('treatmentRecord');
    expect(serializedBody).not.toContain('consultationTranscript');
  });

  it('编辑客户只提交可更新字段并在成功后更新界面', async () => {
    const fetchMock = mockCustomerFetch([
      jsonResponse({ records: [customerRecord] }),
      jsonResponse({ record: { ...customerRecord, nextAction: '已安排明日人工回访', priority: 'medium' } }),
    ]);

    render(<CustomerCenterShell />);

    expect(await screen.findByText('王女士')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '编辑 王女士' }));
    fireEvent.change(screen.getByLabelText('下一步动作'), { target: { value: '已安排明日人工回访' } });
    fireEvent.change(screen.getByLabelText('优先级'), { target: { value: 'medium' } });
    fireEvent.click(screen.getByRole('button', { name: '保存客户' }));

    expect(await screen.findByText('已安排明日人工回访')).toBeInTheDocument();
    const body = requestBody(fetchMock, 1);
    const serializedBody = JSON.stringify(body);

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/institution/customers', expect.objectContaining({
      method: 'PATCH',
    }));
    expect(body.id).toBe('cust_wang_repurchase');
    expect(body.nextAction).toBe('已安排明日人工回访');
    expect(body.priority).toBe('medium');
    expect(serializedBody).not.toContain('tenantId');
    expect(serializedBody).not.toContain('phoneNumber');
    expect(serializedBody).not.toContain('idNumber');
    expect(serializedBody).not.toContain('medicalRecordNo');
    expect(serializedBody).not.toContain('treatmentRecord');
    expect(serializedBody).not.toContain('consultationTranscript');
  });

  it('客户表单拒绝提交未脱敏手机号', async () => {
    const fetchMock = mockCustomerFetch([
      jsonResponse({ records: [] }),
    ]);

    render(<CustomerCenterShell />);

    expect(await screen.findByText('暂无客户记录')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('客户姓名'), { target: { value: '林女士' } });
    fireEvent.change(screen.getByLabelText('负责人 ID'), { target: { value: 'consultant-lin' } });
    fireEvent.change(screen.getByLabelText('项目兴趣'), { target: { value: '皮肤管理' } });
    fireEvent.change(screen.getByLabelText('脱敏手机号展示值'), { target: { value: '13800000000' } });
    fireEvent.change(screen.getByLabelText('脱敏病历号展示值'), { target: { value: 'MR****001' } });
    fireEvent.change(screen.getByLabelText('最近触达摘要'), { target: { value: '初次咨询' } });
    fireEvent.change(screen.getByLabelText('下一步动作'), { target: { value: '预约到店' } });
    fireEvent.click(screen.getByRole('button', { name: '创建客户' }));

    expect(await screen.findByText('字段 maskedPhone 必须是脱敏展示值')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('客户提交失败时展示错误提示', async () => {
    mockCustomerFetch([
      jsonResponse({ records: [] }),
      jsonResponse({ error: '字段 nextAction 不允许包含原始个人信息' }, { status: 400 }),
    ]);

    render(<CustomerCenterShell />);

    expect(await screen.findByText('暂无客户记录')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('客户姓名'), { target: { value: '林女士' } });
    fireEvent.change(screen.getByLabelText('负责人 ID'), { target: { value: 'consultant-lin' } });
    fireEvent.change(screen.getByLabelText('项目兴趣'), { target: { value: '皮肤管理' } });
    fireEvent.change(screen.getByLabelText('脱敏手机号展示值'), { target: { value: '138****1208' } });
    fireEvent.change(screen.getByLabelText('脱敏病历号展示值'), { target: { value: 'MR****001' } });
    fireEvent.change(screen.getByLabelText('最近触达摘要'), { target: { value: '初次咨询' } });
    fireEvent.change(screen.getByLabelText('下一步动作'), { target: { value: '预约到店' } });
    fireEvent.click(screen.getByRole('button', { name: '创建客户' }));

    expect(await screen.findByText('字段 nextAction 不允许包含原始个人信息')).toBeInTheDocument();
  });

  it.each([
    [
      'quota_exceeded_customers DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg stack token secret',
      '当前套餐的客户数量已达上限，请联系平台管理员调整套餐或配额。',
    ],
    [
      'missing_active_plan',
      '当前机构暂无有效套餐，暂不能新增数据，请联系平台管理员。',
    ],
  ])('客户创建遇到配额限制时展示稳定中文提示并保留输入', async (apiMessage, visibleMessage) => {
    const fetchMock = mockCustomerFetch([
      jsonResponse({ records: [] }),
      jsonResponse({ error: apiMessage }, { status: 409 }),
    ]);

    const { container } = render(<CustomerCenterShell />);

    expect(await screen.findByText('暂无客户记录')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('客户姓名'), { target: { value: '林女士' } });
    fireEvent.change(screen.getByLabelText('负责人 ID'), { target: { value: 'consultant-lin' } });
    fireEvent.change(screen.getByLabelText('项目兴趣'), { target: { value: '皮肤管理' } });
    fireEvent.change(screen.getByLabelText('脱敏手机号展示值'), { target: { value: '138****1208' } });
    fireEvent.change(screen.getByLabelText('脱敏病历号展示值'), { target: { value: 'MR****001' } });
    fireEvent.change(screen.getByLabelText('最近触达摘要'), { target: { value: '初次咨询' } });
    fireEvent.change(screen.getByLabelText('下一步动作'), { target: { value: '预约到店' } });
    fireEvent.click(screen.getByRole('button', { name: '创建客户' }));

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
    expect(screen.getByLabelText('客户姓名')).toHaveValue('林女士');
    const body = requestBody(fetchMock, 1);
    const serializedBody = JSON.stringify(body);
    const text = container.textContent ?? '';

    expect(serializedBody).not.toContain('tenantId');
    expect(text).not.toContain('quota_exceeded_customers');
    expect(text).not.toContain('missing_active_plan');
    expect(text).not.toContain('DATABASE_URL');
    expect(text).not.toContain('postgres://');
    expect(text).not.toContain('stack');
    expect(text).not.toContain('token');
    expect(text).not.toContain('secret');
  });

  it('客户中心可打开详情时间线并只读取安全摘要', async () => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
      '/api/institution/customers/cust_wang_repurchase/timeline': [
        jsonResponse(customerTimelineResponse),
      ],
    });

    const { container } = render(<CustomerCenterShell />);

    expect(await screen.findByText('王女士')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看详情 王女士' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看详情 王女士' }));

    expect(await screen.findByRole('dialog', { name: '客户详情时间线' })).toBeInTheDocument();
    expect(screen.getAllByText('客户详情时间线').length).toBeGreaterThan(0);
    expect(screen.getAllByText('脱敏手机号：138****1208').length).toBeGreaterThan(0);
    expect(screen.getAllByText('脱敏病历号：MR****001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('热玛吉复诊').length).toBeGreaterThan(0);
    expect(screen.getAllByText('待电话确认到院').length).toBeGreaterThan(0);
    expect(screen.getAllByText('D28 复购建议').length).toBeGreaterThan(0);
    expect(screen.getAllByText('人工回访并推荐修复组合').length).toBeGreaterThan(0);
    expect(screen.getByText('治疗后结构化摘要')).toBeInTheDocument();
    expect(screen.getAllByText('光电修复').length).toBeGreaterThan(0);
    expect(screen.getByText('类别：laser_repair')).toBeInTheDocument();
    expect(screen.getAllByText('阶段：D7 复诊').length).toBeGreaterThan(0);
    expect(screen.getByText('恢复：D7')).toBeInTheDocument();
    expect(screen.getAllByText('风险：关注').length).toBeGreaterThan(0);
    expect(screen.getByText('负责人：doctor-lin')).toBeInTheDocument();
    expect(screen.getAllByText('结构化摘要：红肿减轻，安排补水护理。').length).toBeGreaterThan(0);
    expect(screen.getByText('下一步护理：D14 人工回访恢复阶段。')).toBeInTheDocument();
    expect(screen.getAllByText('结构化摘要').length).toBeGreaterThan(0);
    expect(screen.getAllByText('术后关怀').length).toBeGreaterThan(0);
    expect(screen.getByText('光电修复 · D7 复诊')).toBeInTheDocument();
    expect(screen.getByText('审计：update')).toBeInTheDocument();
    expect(screen.getByText('audit_evt_001')).toBeInTheDocument();
    expect(screen.getAllByText('allowed / allowed_by_policy').length).toBeGreaterThan(0);

    const timelineCall = fetchMock.mock.calls.find(
      ([input]) =>
        fetchPath(input) === '/api/institution/customers/cust_wang_repurchase/timeline',
    );
    expect(timelineCall).toBeDefined();
    expect(timelineCall?.[1]).toEqual({ cache: 'no-store' });
    expect(fetchPath(timelineCall![0])).not.toContain('tenantId');
    expect(timelineCall?.[1]?.method).toBeUndefined();
    expect(timelineCall?.[1]?.body).toBeUndefined();
    expect(
      fetchMock.mock.calls.some(([, init]) =>
        ['POST', 'PATCH', 'DELETE'].includes(String(init?.method)),
      ),
    ).toBe(false);
    expectNoSensitiveTimelineContent(container);
  });

  it('客户详情抽屉可新增结构化治疗摘要并刷新时间线', async () => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
      '/api/institution/customers/cust_wang_repurchase/timeline': [
        jsonResponse(customerTimelineResponse),
        jsonResponse(customerTimelineAfterTreatmentSummaryCreate),
      ],
      '/api/institution/customers/cust_wang_repurchase/treatment-summaries': [
        jsonResponse({ record: createdTreatmentSummaryRecord }, { status: 201 }),
      ],
    });

    const { container } = render(<CustomerCenterShell />);

    expect(await screen.findByText('王女士')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看详情 王女士' }));

    const drawer = await screen.findByRole('dialog', { name: '客户详情时间线' });
    const drawerView = within(drawer);

    expect(drawerView.getByRole('button', { name: '添加治疗摘要' })).toBeInTheDocument();
    fireEvent.click(drawerView.getByRole('button', { name: '添加治疗摘要' }));
    expect(drawerView.getByLabelText('治疗时间')).toBeInTheDocument();
    expect(drawerView.getByLabelText('治疗项目')).toBeInTheDocument();
    expect(drawerView.getByLabelText('治疗类别')).toBeInTheDocument();
    expect(drawerView.getByLabelText('治疗阶段')).toBeInTheDocument();
    expect(drawerView.getByLabelText('恢复阶段')).toBeInTheDocument();
    expect(drawerView.getByLabelText('风险等级')).toBeInTheDocument();
    expect(drawerView.getByLabelText('负责人 ID')).toBeInTheDocument();
    expect(drawerView.getByLabelText('摘要')).toBeInTheDocument();
    expect(drawerView.getByLabelText('下一步护理')).toBeInTheDocument();
    expect(drawerView.getByLabelText('标签')).toBeInTheDocument();
    expect(drawerView.getByLabelText('关联预约 ID（可选）')).toBeInTheDocument();

    const openedDrawerText = drawer.textContent ?? '';
    expect(openedDrawerText).not.toContain('完整治疗记录');
    expect(openedDrawerText).not.toContain('完整病历正文');
    expect(openedDrawerText).not.toContain('咨询全文');
    expect(openedDrawerText).not.toContain('图片');
    expect(openedDrawerText).not.toContain('文件');
    expect(openedDrawerText).not.toContain('AI');

    fillTreatmentSummaryForm(drawer);
    fireEvent.click(drawerView.getByRole('button', { name: '保存治疗摘要' }));

    expect(await screen.findByText('治疗摘要已添加')).toBeInTheDocument();
    expect(await screen.findByText('水光补水复诊 · D14 复诊')).toBeInTheDocument();
    expect(screen.getAllByText('结构化摘要：恢复稳定，安排补水。').length).toBeGreaterThan(0);

    const body = mutationBody(
      fetchMock,
      '/api/institution/customers/cust_wang_repurchase/treatment-summaries',
      'POST',
    );
    const serializedBody = JSON.stringify(body);

    expect(body).toEqual({
      treatmentDate: '2026-06-02T16:30:00+08:00',
      treatmentProject: '水光补水复诊',
      treatmentCategory: 'skin_repair',
      treatmentStage: 'D14 复诊',
      recoveryStage: 'D14',
      riskLevel: 'watch',
      ownerUserId: 'doctor-lin',
      summary: '结构化摘要：恢复稳定，安排补水。',
      nextCareAction: 'D21 人工回访恢复阶段。',
      tags: ['结构化摘要', '复诊'],
      appointmentId: 'appt_wang_pending',
    });
    expect(
      fetchMock.mock.calls.filter(
        ([input]) =>
          fetchPath(input) === '/api/institution/customers/cust_wang_repurchase/timeline',
      ),
    ).toHaveLength(2);
    expect(serializedBody).not.toContain('tenantId');
    expect(serializedBody).not.toContain('unknownField');
    expect(serializedBody).not.toContain('fullTreatmentRecord');
    expect(serializedBody).not.toContain('medicalRecordText');
    expect(serializedBody).not.toContain('consultationTranscript');
    expect(serializedBody).not.toContain('phoneNumber');
    expect(serializedBody).not.toContain('idNumber');
    expect(serializedBody).not.toContain('rawMedicalRecordNo');
    expect(serializedBody).not.toContain('完整治疗记录正文');
    expect(serializedBody).not.toContain('完整病历正文');
    expect(serializedBody).not.toContain('咨询对话全文');
    expect(serializedBody).not.toContain('13800000000');
    expect(serializedBody).not.toContain('110101199001010011');
    expect(serializedBody).not.toContain('MR-RAW-001');
    expectNoSensitiveTimelineContent(container);
  });

  it.each([
    [400, '字段 summary 不允许包含敏感信息', '字段 summary 不允许包含敏感信息'],
    [401, '请先登录', '登录状态已失效，请重新登录'],
    [403, '没有访问权限', '当前账号没有添加治疗摘要的权限'],
    [404, '记录不存在', '客户不存在或不属于当前租户'],
    [409, '预约不属于当前客户', '关联预约不属于当前客户或不可用'],
    [
      503,
      'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg stack token secret',
      '数据服务暂时不可用',
    ],
  ])('客户详情抽屉处理治疗摘要创建 %s 错误态且保留输入', async (status, apiMessage, visibleMessage) => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
      '/api/institution/customers/cust_wang_repurchase/timeline': [
        jsonResponse(customerTimelineResponse),
      ],
      '/api/institution/customers/cust_wang_repurchase/treatment-summaries': [
        jsonResponse({ error: apiMessage }, { status }),
      ],
    });

    const { container } = render(<CustomerCenterShell />);

    expect(await screen.findByText('王女士')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看详情 王女士' }));

    const drawer = await screen.findByRole('dialog', { name: '客户详情时间线' });
    const drawerView = within(drawer);
    fireEvent.click(drawerView.getByRole('button', { name: '添加治疗摘要' }));
    fillTreatmentSummaryForm(drawer);
    fireEvent.click(drawerView.getByRole('button', { name: '保存治疗摘要' }));

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
    expect(drawerView.getByLabelText('治疗项目')).toHaveValue('水光补水复诊');
    expect(
      fetchMock.mock.calls.filter(
        ([input]) =>
          fetchPath(input) === '/api/institution/customers/cust_wang_repurchase/timeline',
      ),
    ).toHaveLength(1);

    const text = container.textContent ?? '';
    expect(text).not.toContain('DATABASE_URL');
    expect(text).not.toContain('postgres://');
    expect(text).not.toContain('stack');
    expect(text).not.toContain('token');
    expect(text).not.toContain('secret');
    expect(text).not.toContain('select *');
  });

  it('客户详情时间线展示加载态和空态', async () => {
    const detailResponse = deferredResponse();
    const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const path = fetchPath(input);
      if (path === '/api/institution/customers') {
        return jsonResponse({ records: [customerRecord] });
      }

      if (path === '/api/institution/customers/cust_wang_repurchase/timeline') {
        return detailResponse.promise;
      }

      throw new Error(`没有为 ${path} 配置 fetch 响应`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CustomerCenterShell />);

    expect(await screen.findByText('王女士')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看详情 王女士' }));

    expect(screen.getByText('正在加载客户详情...')).toBeInTheDocument();

    detailResponse.resolve(
      jsonResponse({
        ...customerTimelineResponse,
        appointments: [],
        followups: [],
        treatmentSummaries: [],
        auditEvents: [],
        timeline: [],
      }),
    );

    expect(await screen.findByText('暂无预约记录')).toBeInTheDocument();
    expect(screen.getByText('暂无治疗后结构化摘要')).toBeInTheDocument();
    expect(screen.getByText('暂无随访任务')).toBeInTheDocument();
    expect(screen.getByText('暂无关键操作记录')).toBeInTheDocument();
    expect(screen.getByText('暂无时间线事件')).toBeInTheDocument();
  });

  it.each([
    [401, '请先登录', '登录状态已失效，请重新登录'],
    [403, '没有访问权限', '当前账号没有访问客户详情的权限'],
    [404, 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg', '客户不存在或不属于当前租户'],
    [503, 'Error: stack includes sk_test_should_not_render', '数据服务暂时不可用'],
  ])('客户详情时间线处理 %s 错误态且不泄露服务端细节', async (status, apiMessage, visibleMessage) => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
      '/api/institution/customers/cust_wang_repurchase/timeline': [
        jsonResponse({ error: apiMessage }, { status }),
      ],
    });

    const { container } = render(<CustomerCenterShell />);

    expect(await screen.findByText('王女士')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看详情 王女士' }));

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([, init]) =>
        ['POST', 'PATCH', 'DELETE'].includes(String(init?.method)),
      ),
    ).toBe(false);
    expectNoSensitiveTimelineContent(container);
  });

  it('关闭客户详情后客户列表状态保持不变', async () => {
    mockInstitutionFetch({
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
      '/api/institution/customers/cust_wang_repurchase/timeline': [
        jsonResponse(customerTimelineResponse),
      ],
    });

    render(<CustomerCenterShell />);

    expect(await screen.findByText('王女士')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看详情 王女士' }));
    expect(await screen.findByRole('dialog', { name: '客户详情时间线' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '关闭客户详情' }));

    expect(screen.queryByRole('dialog', { name: '客户详情时间线' })).not.toBeInTheDocument();
    expect(screen.getByText('王女士')).toBeInTheDocument();
    expect(screen.getByText('客户优先级队列')).toBeInTheDocument();
  });

  it('预约中心从真实 API 加载预约和客户 records', async () => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/appointments': [
        jsonResponse({
          records: [
            appointmentRecord,
            {
              ...appointmentRecord,
              id: 'appt_zhao_confirmed',
              customerId: 'cust_zhao_post_care',
              customerDisplayName: '赵女士',
              project: '光电修复复诊',
              scheduledAt: '2026-06-01T14:30:00+08:00',
              consultantUserId: 'service-group-a',
              status: 'confirmed',
              note: '已确认到院',
            },
          ],
        }),
      ],
      '/api/institution/customers': [
        jsonResponse({
          records: [
            customerRecord,
            { ...customerRecord, id: 'cust_zhao_post_care', displayName: '赵女士' },
          ],
        }),
      ],
    });

    render(<AppointmentCenterShell />);

    expect(screen.getByRole('heading', { name: '预约中心' })).toBeInTheDocument();
    expect(screen.getByText('预约数据用于串联客户旅程，不代表外部 HIS 已完成同步。')).toBeInTheDocument();
    expect(screen.getByText('正在加载预约数据...')).toBeInTheDocument();
    expect((await screen.findAllByText('王女士')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('赵女士').length).toBeGreaterThan(0);
    expect(screen.getByText('热玛吉复诊')).toBeInTheDocument();
    expect(screen.getByText('2026-06-01 10:30')).toBeInTheDocument();
    expect(screen.getAllByText('待确认').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已确认').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已到院').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已完成').length).toBeGreaterThan(0);
    expect(screen.getAllByText('改约跟进').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已取消').length).toBeGreaterThan(0);
    expect(screen.getByRole('option', { name: '王女士' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/appointments', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/customers', { cache: 'no-store' });
  });

  it('预约中心展示空状态和创建入口', async () => {
    mockInstitutionFetch({
      '/api/institution/appointments': [jsonResponse({ records: [] })],
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
    });

    render(<AppointmentCenterShell />);

    expect(await screen.findByText('暂无可串联的预约记录')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建预约' })).toBeInTheDocument();
    expect(screen.getByLabelText('预约客户')).toBeInTheDocument();
  });

  it.each([
    [401, '请先登录', '登录状态已失效，请重新登录'],
    [403, '没有访问权限', '当前账号没有访问预约数据的权限'],
    [503, '数据服务暂时不可用', '数据服务暂时不可用，请稍后刷新或切换演示备份'],
  ])('预约中心处理 %s 错误态', async (status, apiMessage, visibleMessage) => {
    mockInstitutionFetch({
      '/api/institution/appointments': [jsonResponse({ error: apiMessage }, { status })],
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
    });

    render(<AppointmentCenterShell />);

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
  });

  it('新建预约只使用当前客户列表并派生 customerDisplayName', async () => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/appointments': [
        jsonResponse({ records: [] }),
        jsonResponse({ record: appointmentRecord }, { status: 201 }),
      ],
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
    });

    render(<AppointmentCenterShell />);

    expect(await screen.findByText('暂无可串联的预约记录')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '不存在客户' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('预约客户'), { target: { value: 'cust_wang_repurchase' } });
    fireEvent.change(screen.getByLabelText('预约项目'), { target: { value: '热玛吉复诊' } });
    fireEvent.change(screen.getByLabelText('预约时间'), { target: { value: '2026-06-01T10:30:00+08:00' } });
    fireEvent.change(screen.getByLabelText('顾问 ID'), { target: { value: 'consultant-lin' } });
    fireEvent.change(screen.getByLabelText('预约备注'), { target: { value: '待电话确认到院' } });
    fireEvent.click(screen.getByRole('button', { name: '新建预约' }));

    expect((await screen.findAllByText('王女士')).length).toBeGreaterThan(0);
    const body = mutationBody(fetchMock, '/api/institution/appointments', 'POST');
    const serializedBody = JSON.stringify(body);

    expect(body).toEqual({
      customerId: 'cust_wang_repurchase',
      customerDisplayName: '王女士',
      project: '热玛吉复诊',
      scheduledAt: '2026-06-01T10:30:00+08:00',
      consultantUserId: 'consultant-lin',
      status: 'pending_confirmation',
      note: '待电话确认到院',
    });
    expect(serializedBody).not.toContain('tenantId');
    expect(serializedBody).not.toContain('phoneNumber');
    expect(serializedBody).not.toContain('idNumber');
    expect(serializedBody).not.toContain('medicalRecordNo');
    expect(serializedBody).not.toContain('treatmentRecord');
    expect(serializedBody).not.toContain('consultationTranscript');
  });

  it('预约状态更新只提交 id、status、note 并更新界面', async () => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/appointments': [
        jsonResponse({ records: [appointmentRecord] }),
        jsonResponse({ record: { ...appointmentRecord, status: 'confirmed', note: '客户已确认到院' } }),
      ],
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
    });

    render(<AppointmentCenterShell />);

    expect((await screen.findAllByText('王女士')).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('状态更新 王女士'), { target: { value: 'confirmed' } });
    fireEvent.change(screen.getByLabelText('备注更新 王女士'), { target: { value: '客户已确认到院' } });
    fireEvent.click(screen.getByRole('button', { name: '更新预约 王女士' }));

    expect((await screen.findAllByText('客户已确认到院')).length).toBeGreaterThan(0);
    const body = mutationBody(fetchMock, '/api/institution/appointments', 'PATCH');
    const serializedBody = JSON.stringify(body);

    expect(body).toEqual({
      id: 'appt_wang_pending',
      status: 'confirmed',
      note: '客户已确认到院',
    });
    expect(serializedBody).not.toContain('tenantId');
    expect(serializedBody).not.toContain('phoneNumber');
    expect(serializedBody).not.toContain('idNumber');
    expect(serializedBody).not.toContain('medicalRecordNo');
    expect(serializedBody).not.toContain('treatmentRecord');
    expect(serializedBody).not.toContain('consultationTranscript');
  });

  it('预约表单拒绝提交未脱敏个人信息', async () => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/appointments': [jsonResponse({ records: [] })],
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
    });

    render(<AppointmentCenterShell />);

    expect(await screen.findByText('暂无可串联的预约记录')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('预约客户'), { target: { value: 'cust_wang_repurchase' } });
    fireEvent.change(screen.getByLabelText('预约项目'), { target: { value: '热玛吉复诊' } });
    fireEvent.change(screen.getByLabelText('预约时间'), { target: { value: '2026-06-01T10:30:00+08:00' } });
    fireEvent.change(screen.getByLabelText('顾问 ID'), { target: { value: 'consultant-lin' } });
    fireEvent.change(screen.getByLabelText('预约备注'), { target: { value: '请联系 13800000000' } });
    fireEvent.click(screen.getByRole('button', { name: '新建预约' }));

    expect(await screen.findByText('预约表单不允许提交原始个人信息')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('预约提交失败时展示错误提示', async () => {
    mockInstitutionFetch({
      '/api/institution/appointments': [
        jsonResponse({ records: [] }),
        jsonResponse({ error: '字段 scheduledAt 必须是有效时间字符串' }, { status: 400 }),
      ],
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
    });

    render(<AppointmentCenterShell />);

    expect(await screen.findByText('暂无可串联的预约记录')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('预约客户'), { target: { value: 'cust_wang_repurchase' } });
    fireEvent.change(screen.getByLabelText('预约项目'), { target: { value: '热玛吉复诊' } });
    fireEvent.change(screen.getByLabelText('预约时间'), { target: { value: 'not-a-date' } });
    fireEvent.change(screen.getByLabelText('顾问 ID'), { target: { value: 'consultant-lin' } });
    fireEvent.change(screen.getByLabelText('预约备注'), { target: { value: '待电话确认到院' } });
    fireEvent.click(screen.getByRole('button', { name: '新建预约' }));

    expect(await screen.findByText('字段 scheduledAt 必须是有效时间字符串')).toBeInTheDocument();
  });

  it.each([
    [
      'quota_exceeded_appointments DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg stack token secret',
      '当前套餐的预约数量已达上限，请联系平台管理员调整套餐或配额。',
    ],
    [
      'missing_quota_limit',
      '当前机构套餐配额未配置完整，暂不能新增数据，请联系平台管理员。',
    ],
  ])('预约创建遇到配额限制时展示稳定中文提示并保留输入', async (apiMessage, visibleMessage) => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/appointments': [
        jsonResponse({ records: [] }),
        jsonResponse({ error: apiMessage }, { status: 409 }),
      ],
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
    });

    const { container } = render(<AppointmentCenterShell />);

    expect(await screen.findByText('暂无可串联的预约记录')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('预约客户'), { target: { value: 'cust_wang_repurchase' } });
    fireEvent.change(screen.getByLabelText('预约项目'), { target: { value: '热玛吉复诊' } });
    fireEvent.change(screen.getByLabelText('预约时间'), { target: { value: '2026-06-01T10:30:00+08:00' } });
    fireEvent.change(screen.getByLabelText('顾问 ID'), { target: { value: 'consultant-lin' } });
    fireEvent.change(screen.getByLabelText('预约备注'), { target: { value: '待电话确认到院' } });
    fireEvent.click(screen.getByRole('button', { name: '新建预约' }));

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
    expect(screen.getByLabelText('预约项目')).toHaveValue('热玛吉复诊');
    const body = mutationBody(fetchMock, '/api/institution/appointments', 'POST');
    const serializedBody = JSON.stringify(body);
    const text = container.textContent ?? '';

    expect(serializedBody).not.toContain('tenantId');
    expect(text).not.toContain('quota_exceeded_appointments');
    expect(text).not.toContain('missing_quota_limit');
    expect(text).not.toContain('DATABASE_URL');
    expect(text).not.toContain('postgres://');
    expect(text).not.toContain('stack');
    expect(text).not.toContain('token');
    expect(text).not.toContain('secret');
  });

  it('智能随访从真实 API 加载并按风险和到期时间排序展示 records', async () => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/followups': [
        jsonResponse({
          records: [
            {
              ...followUpRecord,
              id: 'fu_li_silent',
              customerDisplayName: '李女士',
              stage: '48h 沉默唤醒',
              status: 'scheduled',
              dueAt: '2026-05-31T10:00:00+08:00',
              suggestedAction: '发送轻量唤醒话术',
              riskLevel: 'normal',
            },
            followUpRecord,
            {
              ...followUpRecord,
              id: 'fu_zhao_d3',
              customerDisplayName: '赵女士',
              stage: 'D3 异常反馈',
              dueAt: '2026-05-30T09:30:00+08:00',
              suggestedAction: '客服回访并记录恢复情况',
              riskLevel: 'urgent',
            },
          ],
        }),
      ],
    });

    render(<SmartFollowUpShell />);

    expect(screen.getByRole('heading', { name: '智能随访' })).toBeInTheDocument();
    expect(screen.getByText('正在加载随访任务...')).toBeInTheDocument();
    expect(await screen.findByText('王女士')).toBeInTheDocument();
    expect(screen.getAllByText('状态：待处理').length).toBeGreaterThan(0);
    expect(screen.getAllByText('风险：优先').length).toBeGreaterThan(0);
    expect(screen.getByText(/2026-05-30 18:00/)).toBeInTheDocument();
    expect(screen.getByText('D3 异常反馈')).toBeInTheDocument();
    expect(screen.getByText('48h 沉默唤醒')).toBeInTheDocument();

    const taskCards = screen.getAllByTestId('followup-task-card');
    expect(taskCards.map((card) => card.textContent)).toEqual([
      expect.stringContaining('赵女士'),
      expect.stringContaining('王女士'),
      expect.stringContaining('李女士'),
    ]);
    const requestPaths = fetchMock.mock.calls.map(([input]) => fetchPath(input));
    expect(requestPaths).toEqual(expect.arrayContaining([
      '/api/institution/followups',
      '/api/institution/followup-paths/enrollments',
    ]));
  });

  it('智能随访展示治疗摘要来源标签并支持来源筛选', async () => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/followups': [
        jsonResponse({ records: [followUpRecord, treatmentSummaryFollowUpRecord] }),
      ],
      '/api/institution/followups?source=treatment_summary': [
        jsonResponse({ records: [treatmentSummaryFollowUpRecord] }),
      ],
    });
    const { container } = render(<SmartFollowUpShell />);

    expect(await screen.findByText('陈女士')).toBeInTheDocument();
    expect(screen.getByText('来源：治疗摘要')).toBeInTheDocument();
    expect(screen.getAllByText('建议 key 用于来源追踪和避免重复创建。').length).toBeGreaterThan(0);
    expect(screen.getByText('来源摘要：trt_source_001')).toBeInTheDocument();
    expect(screen.getByText('建议 key：trt_source_001:watch_risk_followup:3d')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('来源筛选'), {
      target: { value: 'treatment_summary' },
    });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/institution/followups?source=treatment_summary',
        { cache: 'no-store' },
      ),
    );
    expect(await screen.findByText('治疗摘要 D3 护理随访')).toBeInTheDocument();
    expect(screen.queryByText('D28 复购建议')).not.toBeInTheDocument();

    const requestPaths = fetchMock.mock.calls.map(([input]) => fetchPath(input));
    expect(requestPaths).toEqual(expect.arrayContaining([
      '/api/institution/followups',
      '/api/institution/followup-paths/enrollments',
      '/api/institution/followups?source=treatment_summary',
    ]));
    expect(requestPaths.join('\n')).not.toContain('tenantId');

    const text = container.textContent ?? '';
    expect(text).not.toContain('13800000000');
    expect(text).not.toContain('110101199001010011');
    expect(text).not.toContain('MR-RAW-001');
    expect(text).not.toContain('完整治疗记录正文');
    expect(text).not.toContain('完整病历正文');
    expect(text).not.toContain('咨询对话全文');
    expect(text).not.toContain('select * from follow_up_tasks');
    expect(text).not.toContain('DATABASE_URL');
    expect(text).not.toContain('stack');
    expect(text).not.toContain('token');
    expect(text).not.toContain('secret');
    expect(text).not.toContain('自动发送微信');
    expect(text).not.toContain('自动短信');
    expect(text).not.toContain('电话外呼');
    expect(text).not.toContain('自动触达');
  });

  it('智能随访展示运营看板、路径效果、草稿处理和人工边界文案', async () => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/followups': [jsonResponse({ records: [followUpRecord] })],
      '/api/institution/followup-operations/dashboard': [
        jsonResponse({
          overview: {
            activeEnrollmentCount: 2,
            todayDueTaskCount: 3,
            overdueTaskCount: 1,
            pendingTaskCount: 4,
            completedTaskCount: 5,
            escalatedTaskCount: 1,
            highRiskTaskCount: 2,
            draftCount: 6,
            approvedDraftCount: 2,
            markedSentCount: 1,
            approvedButNotMarkedSentCount: 1,
            messageDeliveryCount: 4,
            mockSentCount: 1,
            mockFailedCount: 1,
            skippedCount: 1,
            externalDisabledCount: 1,
            manualFeedbackCount: 1,
          },
          pathPerformance: [
            {
              templateKey: 'hydro_injection_care',
              pathName: '水光术后管理',
              activeEnrollmentCount: 1,
              generatedTaskCount: 3,
              pendingTaskCount: 2,
              completedTaskCount: 1,
              overdueTaskCount: 1,
              escalatedTaskCount: 0,
              completionRate: 33.33,
              nextDueAt: '2026-07-07T10:00:00.000Z',
            },
            {
              templateKey: 'photoelectric_care',
              pathName: '光电术后管理',
              activeEnrollmentCount: 1,
              generatedTaskCount: 2,
              pendingTaskCount: 1,
              completedTaskCount: 1,
              overdueTaskCount: 0,
              escalatedTaskCount: 1,
              completionRate: 50,
              nextDueAt: null,
            },
          ],
          workload: [
            {
              handlerRole: 'medical_assistant',
              assignedUserId: null,
              pendingTaskCount: 2,
              overdueTaskCount: 1,
              completedTaskCount: 1,
              escalatedTaskCount: 0,
            },
          ],
          draftOperations: {
            draftCount: 6,
            approvedDraftCount: 2,
            rejectedDraftCount: 1,
            markedSentCount: 1,
            approvedButNotMarkedSentCount: 1,
          },
          messageDeliveries: {
            messageDeliveryCount: 4,
            mockSentCount: 1,
            mockFailedCount: 1,
            skippedCount: 1,
            externalDisabledCount: 1,
            recentDeliveries: [
              {
                deliveryId: 'msg-delivery:draft_001',
                customerId: 'cust_001',
                followUpTaskId: 'task_001',
                messageDraftId: 'draft_001',
                channelType: 'mock',
                deliveryMode: 'mock',
                recipientRef: 'customer:cust_001',
                contentSnapshot: '低敏人工确认内容快照',
                status: 'mock_sent',
                failureReason: null,
                weComMockReachOut: null,
                createdAt: '2026-07-06T10:00:00.000Z',
                sentAt: '2026-07-06T10:00:00.000Z',
                updatedAt: '2026-07-06T10:00:00.000Z',
              },
            ],
          },
          contactSafety: {
            allowedCount: 1,
            consentMissingBlockedCount: 0,
            optOutBlockedCount: 0,
            frequencyCapBlockedCount: 0,
            channelDisabledCount: 1,
            tenantGrayBlockedCount: 0,
            institutionGrayBlockedCount: 0,
            grayGuardBlockedCount: 0,
          },
          weComAuthorization: {
            ...getDefaultWeComAuthorizationDashboardView(),
            status: 'mock_authorized',
            statusLabel: '模拟已授权',
            isMockAuthorized: true,
            customerContactAuthorized: true,
            externalContactSyncAuthorized: true,
            customerOwnerSyncAuthorized: true,
            weComReachOutAuthorized: true,
            lastErrorReason: '企业微信外部通道未启用，mock 授权也不能真实发送。',
          },
          weComCustomerContactSync: {
            ...getDefaultWeComCustomerContactSyncDashboardView(),
            status: 'mock_synced',
            statusLabel: '模拟已同步',
            authorizationRecordId: 'wecom-auth:mock-low-sensitive',
            externalContactCount: 3,
            linkedSystemCustomerCount: 2,
            unlinkedCustomerCount: 1,
            availableForFollowUpCount: 1,
            unavailableForFollowUpCount: 2,
            mappedOwnerEmployeeCount: 2,
            unmappedOwnerEmployeeCount: 1,
            tagsSummary: '术后关怀 / 到院咨询 / 复购窗口',
            sourceSummary: '术后随访低敏线索 / 到院咨询低敏线索',
            ownerEmployeeSummary: '企微员工A（低敏） / 未映射企微员工（低敏）',
            remarkSummary: '客户联系 mock 低敏摘要 / 外部联系人尚未关联系统客户',
            lastSyncedAt: '2026-07-08T00:00:00.000Z',
            lastErrorReason: null,
            contacts: [
              {
                mockExternalContactId: 'mock-external-contact:01',
                customerDisplayName: '低敏客户A',
                weComCustomerRef: 'wecom-customer:mock:1',
                ownerEmployeeRef: 'mock-employee:consultant-a',
                ownerEmployeeDisplayName: '企微员工A（低敏）',
                mappedSystemEmployeeRef: 'system-employee:consultant-a',
                ownerEmployeeMapped: true,
                source: '术后随访低敏线索',
                tags: ['术后关怀', '低敏标签'],
                remarkSummary: '客户联系 mock 低敏摘要，可作为后续人工随访候选。',
                addedAt: '2026-07-08T00:00:00.000Z',
                lastSyncedAt: '2026-07-08T00:00:00.000Z',
                syncStatus: 'mock_synced',
                syncStatusLabel: '模拟已同步',
                lastErrorReason: null,
                availableForFollowUp: true,
                linkedToSystemCustomer: true,
                customerId: 'customer:mock-linked-a',
                notPersonalWechatFriend: true,
                noChatHistorySynced: true,
              },
              {
                mockExternalContactId: 'mock-external-contact:02',
                customerDisplayName: '低敏客户B',
                weComCustomerRef: 'wecom-customer:mock:2',
                ownerEmployeeRef: 'mock-employee:unmapped',
                ownerEmployeeDisplayName: '未映射企微员工（低敏）',
                mappedSystemEmployeeRef: null,
                ownerEmployeeMapped: false,
                source: '到院咨询低敏线索',
                tags: ['到院咨询', '未关联'],
                remarkSummary: '外部联系人尚未关联系统客户，不能直接用于随访。',
                addedAt: '2026-07-08T00:00:00.000Z',
                lastSyncedAt: '2026-07-08T00:00:00.000Z',
                syncStatus: 'mock_synced',
                syncStatusLabel: '模拟已同步',
                lastErrorReason: null,
                availableForFollowUp: false,
                linkedToSystemCustomer: false,
                customerId: null,
                notPersonalWechatFriend: true,
                noChatHistorySynced: true,
              },
            ],
          },
          weComMockReachOut: {
            ...getDefaultWeComMockReachOutDashboardView(),
            recordCount: 1,
            mockSentCount: 1,
            reachableCustomerCount: 1,
            recentRecords: [
              {
                deliveryId: 'msg-delivery:draft_001',
                messageDraftId: 'draft_001',
                followUpTaskId: 'task_001',
                customerId: 'cust_001',
                mockExternalContactId: 'mock-external-contact:01',
                ownerEmployeeRef: 'mock-employee:consultant-a',
                channelType: 'wechat_work',
                deliveryMode: 'mock',
                status: 'mock_sent',
                failureReason: null,
                safeReasonLabel: '企业微信 mock 触达成功：当前仅本地状态回写，未真实发送、未真实出网、未调用企业微信 API。',
                occurredAt: '2026-07-06T10:00:00.000Z',
                updatedAt: '2026-07-06T10:00:00.000Z',
                noRealSend: true,
                noRealOutBound: true,
                noRealWeComApiCall: true,
                noWebhook: true,
                currentOnlyMock: true,
                externalChannelEnabled: false,
                allowRealSend: false,
                auditReason: 'wecom_mock_reachout_sent',
              },
            ],
          },
          riskSummary: {
            escalatedTaskCount: 1,
            highRiskTaskCount: 2,
            highRiskPendingTaskCount: 1,
            overdueHighRiskTaskCount: 1,
            manualFeedbackCount: 1,
          },
        }),
      ],
    });

    const { container } = render(<SmartFollowUpShell />);

    expect(await screen.findByText('智能随访运营看板')).toBeInTheDocument();
    expect(screen.getByText('运营看板 / 路径效果')).toBeInTheDocument();
    expect(screen.getByText('今日待随访')).toBeInTheDocument();
    expect(screen.getByText('逾期任务')).toBeInTheDocument();
    expect(screen.getByText('高风险 / 已升级')).toBeInTheDocument();
    expect(screen.getByText('已确认待人工发送')).toBeInTheDocument();
    expect(screen.getByText('受控发送记录')).toBeInTheDocument();
    expect(screen.getByText('受控发送基础闭环')).toBeInTheDocument();
    expect(screen.getByText(/发送记录 4/)).toBeInTheDocument();
    expect(screen.getAllByText(/mock_sent 1/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/mock_failed 1/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/skipped 1/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/external_disabled 1/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/人工确认后才生成 MessageDelivery/)).toBeInTheDocument();
    expect(screen.getByText(/仅模拟发送，不自动发送，未接真实企业微信 \/ 短信/)).toBeInTheDocument();
    expect(screen.getByText('mock_sent · mock / mock')).toBeInTheDocument();
    expect(screen.getByText('低敏人工确认内容快照')).toBeInTheDocument();
    expect(container.textContent).toContain('已人工发送');
    expect(screen.getByText('水光术后管理')).toBeInTheDocument();
    expect(screen.getByText('光电术后管理')).toBeInTheDocument();
    expect(screen.getByText('33.3%')).toBeInTheDocument();
    expect(screen.getByText('草稿处理概览')).toBeInTheDocument();
    expect(screen.getByText('员工 / 角色工作量概览')).toBeInTheDocument();
    expect(screen.getByText('医助')).toBeInTheDocument();
    expect(screen.getByText(/本区域为内部运营统计，不代表已自动联系客户/)).toBeInTheDocument();
    expect(screen.getByText(/标记已发送仅代表人工记录/)).toBeInTheDocument();
    expect(screen.getByText(/当前没有企业微信 \/ 短信接入，不做自动营销群发/)).toBeInTheDocument();
    expect(screen.getByText('企业微信随访触达 mock')).toBeInTheDocument();
    expect(screen.getByText(/当前仅 mock，未接真实企业微信，不真实发送，不真实出网/)).toBeInTheDocument();
    expect(screen.getByText(/必须人工确认、经过 MessageDelivery/)).toBeInTheDocument();
    expect(screen.getByText('记录总数 1')).toBeInTheDocument();
    expect(screen.getByText('可触达客户 1')).toBeInTheDocument();
    expect(screen.getByText('不可触达客户 0')).toBeInTheDocument();
    expect(screen.getByText(/mock 已授权也不会真实发送/)).toBeInTheDocument();
    expect(screen.getByText('mock_sent · wechat_work / mock')).toBeInTheDocument();
    expect(screen.getByText(/企业微信 mock 触达成功/)).toBeInTheDocument();
    expect(screen.getByText(/外部联系人：mock-external-contact:01；归属员工：mock-employee:consultant-a/)).toBeInTheDocument();
    expect(screen.getByText('企业微信客户运营接入')).toBeInTheDocument();
    expect(screen.getAllByText(/不是企业微信登录/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('状态：模拟已授权')).toBeInTheDocument();
    expect(screen.getByText('模拟授权：是')).toBeInTheDocument();
    expect(screen.getByText('客户联系：已授权')).toBeInTheDocument();
    expect(screen.getByText('外部联系人同步：已授权')).toBeInTheDocument();
    expect(screen.getByText('企业微信触达：mock 可读')).toBeInTheDocument();
    expect(screen.getByText('会话内容存档：后置规划')).toBeInTheDocument();
    expect(screen.getByText('默认关闭：是')).toBeInTheDocument();
    expect(screen.getAllByText('不真实发送：是').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/未接真实企业微信，未申请服务商 \/ 未接真实接口/)).toBeInTheDocument();
    expect(screen.getByText(/企业微信触达必须经过人工确认和 MessageDelivery/)).toBeInTheDocument();
    expect(screen.getByText(/企业微信授权状态 → 触达安全治理 → MessageDelivery/)).toBeInTheDocument();
    expect(screen.getByText('企业微信客户联系')).toBeInTheDocument();
    expect(screen.getByText(/企业微信客户联系 \/ 外部联系人当前仅 mock/)).toBeInTheDocument();
    expect(screen.getAllByText(/不是个人微信好友同步/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/不是聊天记录同步/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/未接真实企业微信，不真实出网，不同步真实客户/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('同步状态：模拟已同步')).toBeInTheDocument();
    expect(screen.getByText('外部联系人 3')).toBeInTheDocument();
    expect(screen.getByText('已关联系统客户 2')).toBeInTheDocument();
    expect(screen.getByText('未关联客户 1')).toBeInTheDocument();
    expect(screen.getByText('可用于随访 1')).toBeInTheDocument();
    expect(screen.getByText('客户归属员工已映射 2')).toBeInTheDocument();
    expect(screen.getByText('客户归属员工未映射 1')).toBeInTheDocument();
    expect(container.textContent).toContain('客户标签：术后关怀 / 到院咨询 / 复购窗口');
    expect(container.textContent).toContain('客户来源：术后随访低敏线索 / 到院咨询低敏线索');
    expect(container.textContent).toContain('客户归属员工：企微员工A（低敏） / 未映射企微员工（低敏）');
    expect(container.textContent).toContain('客户备注：客户联系 mock 低敏摘要 / 外部联系人尚未关联系统客户');
    expect(screen.getByText(/后续企业微信触达必须先有授权状态、客户联系关系、人工确认和 MessageDelivery/)).toBeInTheDocument();
    expect(screen.getByText(/低敏客户A · 模拟已同步 · 已关联系统客户/)).toBeInTheDocument();
    expect(container.textContent).toContain('外部联系人：mock-external-contact:01；客户归属员工：企微员工A（低敏）');
    expect(screen.getByText(/低敏客户B · 模拟已同步 · 未关联系统客户/)).toBeInTheDocument();
    expect(screen.getByText(/未映射机构员工，显示低敏空态/)).toBeInTheDocument();

    const requestPaths = fetchMock.mock.calls.map(([input]) => fetchPath(input));
    expect(requestPaths).toEqual(expect.arrayContaining([
      '/api/institution/followups',
      '/api/institution/followup-paths/enrollments',
      '/api/institution/followup-operations/dashboard',
    ]));

    const text = container.textContent ?? '';
    expect(text).not.toContain('tenantId');
    expect(text).not.toContain('institutionId');
    expect(text).not.toContain('13800000000');
    expect(text).not.toContain('110101199001010011');
    expect(text).not.toContain('MR-RAW-001');
    expect(text).not.toContain('HIS payload');
    expect(text).not.toContain('provider');
    expect(text).not.toContain('model');
    expect(text).not.toContain('token');
    expect(text).not.toContain('cost');
    expect(text).not.toContain('vendor');
    expect(text).not.toContain('自动营销群发执行');
  });

  it('智能随访展示路径实例和随访旅程进度', async () => {
    mockInstitutionFetch({
      '/api/institution/followups': [jsonResponse({ records: [treatmentSummaryFollowUpRecord] })],
      '/api/institution/followup-paths/enrollments': [
        jsonResponse({
          records: [
            {
              enrollmentId: 'enrollment_001',
              customerId: 'cust_chen',
              customerDisplayName: '陈女士',
              templateKey: 'hydro_injection_care',
              status: 'active',
              stageCount: 3,
              taskCount: 3,
              dueAt: '2026-06-02T10:00:00+08:00',
              safeMessage: '路径任务需人工处理，不会主动向客户发送消息。',
              taskIds: ['fu_path_d1', 'fu_path_d3', 'fu_path_d7'],
              stages: [
                {
                  nodeKey: 'hydro_injection_d1_check',
                  stageKey: 'D1',
                  dueAt: '2026-06-02T10:00:00+08:00',
                  status: 'scheduled',
                  followUpTaskId: 'fu_path_d1',
                  handlerRole: 'consultant',
                  riskLevel: 'normal',
                  safeMessage: '路径任务需人工处理，不会主动向客户发送消息。',
                },
              ],
              createdAt: '2026-06-01T10:00:00+08:00',
              updatedAt: '2026-06-01T10:00:00+08:00',
            },
          ],
        }),
      ],
    });

    const { container } = render(<SmartFollowUpShell />);

    expect(await screen.findByText('路径管理 / 路径实例')).toBeInTheDocument();
    expect(await screen.findByTestId('followup-path-enrollment-card')).toHaveTextContent('陈女士');
    expect(screen.getAllByText('路径：hydro_injection_care').length).toBeGreaterThan(0);
    expect(screen.getByText('阶段 3')).toBeInTheDocument();
    expect(screen.getByText('任务 3')).toBeInTheDocument();
    expect(screen.getByText(/hydro_injection_care · 3 个人工任务/)).toBeInTheDocument();
    expect(container.textContent).toContain('D1');
    expect(container.textContent).toContain('待处理');
    expect(container.textContent).toContain('人工处理');

    const text = container.textContent ?? '';
    expect(text).not.toContain('tenantId');
    expect(text).not.toContain('institutionId');
    expect(text).not.toContain('13800000000');
    expect(text).not.toContain('完整治疗记录正文');
    expect(text).not.toContain('自动发送微信');
    expect(text).not.toContain('自动短信');
  });

  it('智能随访展示空状态和真实配置空态说明', async () => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/followups': [jsonResponse({ records: [] })],
      '/api/institution/followup-operations/dashboard': [
        jsonResponse({
          overview: {
            activeEnrollmentCount: 0,
            todayDueTaskCount: 0,
            overdueTaskCount: 0,
            pendingTaskCount: 0,
            completedTaskCount: 0,
            escalatedTaskCount: 0,
            highRiskTaskCount: 0,
            draftCount: 0,
            approvedDraftCount: 0,
            markedSentCount: 0,
            approvedButNotMarkedSentCount: 0,
            messageDeliveryCount: 0,
            mockSentCount: 0,
            mockFailedCount: 0,
            skippedCount: 0,
            externalDisabledCount: 0,
            manualFeedbackCount: 0,
          },
          pathPerformance: [],
          workload: [],
          draftOperations: {
            draftCount: 0,
            approvedDraftCount: 0,
            rejectedDraftCount: 0,
            markedSentCount: 0,
            approvedButNotMarkedSentCount: 0,
          },
          messageDeliveries: {
            messageDeliveryCount: 0,
            mockSentCount: 0,
            mockFailedCount: 0,
            skippedCount: 0,
            externalDisabledCount: 0,
            recentDeliveries: [],
          },
          contactSafety: {
            allowedCount: 0,
            consentMissingBlockedCount: 0,
            optOutBlockedCount: 0,
            frequencyCapBlockedCount: 0,
            channelDisabledCount: 0,
            tenantGrayBlockedCount: 0,
            institutionGrayBlockedCount: 0,
            grayGuardBlockedCount: 0,
          },
          weComAuthorization: getDefaultWeComAuthorizationDashboardView(),
          weComCustomerContactSync: getDefaultWeComCustomerContactSyncDashboardView(),
          weComMockReachOut: getDefaultWeComMockReachOutDashboardView(),
          riskSummary: {
            escalatedTaskCount: 0,
            highRiskTaskCount: 0,
            highRiskPendingTaskCount: 0,
            overdueHighRiskTaskCount: 0,
            manualFeedbackCount: 0,
          },
        }),
      ],
    });

    render(<SmartFollowUpShell />);

    expect(await screen.findByText('暂无随访任务')).toBeInTheDocument();
    expect(screen.getByText('暂无随访运营数据')).toBeInTheDocument();
    expect(screen.getByText('暂无真实随访路径实例。治疗摘要纳入路径后，会在这里展示客户随访旅程。')).toBeInTheDocument();
    expect(screen.getByText('暂无真实话术建议。')).toBeInTheDocument();
    expect(screen.getByText('任务需人工处理，不会主动向客户发送消息。')).toBeInTheDocument();
    expect(screen.getByText('企业微信客户运营接入')).toBeInTheDocument();
    expect(screen.getByText('不是企业微信登录；机构员工仍使用现有账号体系。这里仅展示机构授权其自有企业微信主体后的低敏客户运营状态。')).toBeInTheDocument();
    expect(screen.getByText('状态：未配置')).toBeInTheDocument();
    expect(screen.getByText('模拟授权：否')).toBeInTheDocument();
    expect(screen.getByText('客户联系：未授权')).toBeInTheDocument();
    expect(screen.getByText('外部联系人同步：后续能力')).toBeInTheDocument();
    expect(screen.getByText('未接真实企业微信，未申请服务商 / 未接真实接口；客户联系 / 外部联系人同步为后续能力，会话内容存档为高风险后置能力。企业微信触达必须经过人工确认和 MessageDelivery。')).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([input]) => fetchPath(input))).toEqual(expect.arrayContaining([
      '/api/institution/followups',
      '/api/institution/followup-paths/enrollments',
    ]));
  });

  it.each([
    [401, '请先登录', '登录状态已失效，请重新登录'],
    [403, '没有访问权限', '当前账号没有访问随访任务的权限'],
    [503, '数据服务暂时不可用', '数据服务暂时不可用，请稍后刷新或切换演示备份'],
  ])('智能随访处理 %s 错误态', async (status, apiMessage, visibleMessage) => {
    mockInstitutionFetch({
      '/api/institution/followups': [jsonResponse({ error: apiMessage }, { status })],
    });

    render(<SmartFollowUpShell />);

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
  });

  it('智能随访只展示当前状态允许的流转按钮', async () => {
    mockInstitutionFetch({
      '/api/institution/followups': [jsonResponse({ records: [followUpRecord] })],
    });

    render(<SmartFollowUpShell />);

    expect(await screen.findByText('王女士')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '流转 王女士 到 处理中' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '流转 王女士 到 已升级' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '流转 王女士 到 已取消' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '流转 王女士 到 已完成' })).not.toBeInTheDocument();
  });

  it('智能随访状态流转只提交 id 和 nextStatus 并更新界面', async () => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/followups': [
        jsonResponse({ records: [followUpRecord] }),
        jsonResponse({ record: { ...followUpRecord, status: 'in_progress' } }),
      ],
    });

    render(<SmartFollowUpShell />);

    expect(await screen.findByText('王女士')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '流转 王女士 到 处理中' }));

    expect(await screen.findByText('状态：处理中')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '流转 王女士 到 已完成' })).toBeInTheDocument();
    const body = mutationBody(fetchMock, '/api/institution/followups', 'PATCH');
    const serializedBody = JSON.stringify(body);

    expect(body).toEqual({
      id: 'fu_wang_d28',
      nextStatus: 'in_progress',
    });
    expect(serializedBody).not.toContain('tenantId');
    expect(serializedBody).not.toContain('phoneNumber');
    expect(serializedBody).not.toContain('idNumber');
    expect(serializedBody).not.toContain('medicalRecordNo');
    expect(serializedBody).not.toContain('treatmentRecord');
    expect(serializedBody).not.toContain('consultationTranscript');
  });

  it('智能随访展示消息草稿状态、人工边界并提交草稿白名单 payload', async () => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/followups': [jsonResponse({ records: [treatmentSummaryFollowUpRecord] })],
      '/api/institution/followup-message-drafts?taskId=fu_treatment_summary_source': [
        jsonResponse({ records: [] }),
        jsonResponse({
          records: [
            {
              draftId: 'draft_001',
              followUpTaskId: 'fu_treatment_summary_source',
              customerId: 'cust_wang_repurchase',
              customerDisplayName: '陈女士',
              channelType: 'manual',
              status: 'draft',
              safePreview: '陈女士，治疗摘要 D3 护理随访，请人工确认恢复情况。',
              draftContent: '陈女士，治疗摘要 D3 护理随访，请人工确认恢复情况。',
              editedContent: null,
              approvedAt: null,
              markedSentAt: null,
              safeReasonCode: 'fallback_generated',
              createdAt: '2026-07-06T08:00:00.000Z',
              updatedAt: '2026-07-06T08:00:00.000Z',
              tenantId: 'demo-tenant-001',
              provider: 'forbidden-provider',
              token: 'sk_test_should_not_render',
            },
          ],
        }),
      ],
      '/api/institution/followup-message-drafts': [
        jsonResponse({
          record: {
            draftId: 'draft_001',
            followUpTaskId: 'fu_treatment_summary_source',
            customerId: 'cust_wang_repurchase',
            customerDisplayName: '陈女士',
            channelType: 'manual',
            status: 'draft',
            safePreview: '陈女士，治疗摘要 D3 护理随访，请人工确认恢复情况。',
            draftContent: '陈女士，治疗摘要 D3 护理随访，请人工确认恢复情况。',
            editedContent: null,
            approvedAt: null,
            markedSentAt: null,
            safeReasonCode: 'fallback_generated',
            createdAt: '2026-07-06T08:00:00.000Z',
            updatedAt: '2026-07-06T08:00:00.000Z',
          },
        }, { status: 201 }),
      ],
      '/api/institution/followup-message-drafts/draft_001': [
        jsonResponse({
          record: {
            draftId: 'draft_001',
            followUpTaskId: 'fu_treatment_summary_source',
            customerId: 'cust_wang_repurchase',
            customerDisplayName: '陈女士',
            channelType: 'manual',
            status: 'draft',
            safePreview: '陈女士，已人工编辑低敏随访草稿。',
            draftContent: '陈女士，治疗摘要 D3 护理随访，请人工确认恢复情况。',
            editedContent: '陈女士，已人工编辑低敏随访草稿。',
            approvedAt: null,
            markedSentAt: null,
            safeReasonCode: 'draft_content_updated',
            createdAt: '2026-07-06T08:00:00.000Z',
            updatedAt: '2026-07-06T09:00:00.000Z',
          },
        }),
      ],
      '/api/institution/followup-message-drafts/draft_001/approve': [
        jsonResponse({
          record: {
            draftId: 'draft_001',
            followUpTaskId: 'fu_treatment_summary_source',
            customerId: 'cust_wang_repurchase',
            customerDisplayName: '陈女士',
            channelType: 'manual',
            status: 'approved',
            safePreview: '陈女士，已人工编辑低敏随访草稿。',
            draftContent: '陈女士，治疗摘要 D3 护理随访，请人工确认恢复情况。',
            editedContent: '陈女士，已人工编辑低敏随访草稿。',
            approvedAt: '2026-07-06T10:00:00.000Z',
            markedSentAt: null,
            safeReasonCode: 'draft_approved',
            createdAt: '2026-07-06T08:00:00.000Z',
            updatedAt: '2026-07-06T10:00:00.000Z',
          },
        }),
      ],
      '/api/institution/followup-message-drafts/draft_001/mark-sent': [
        jsonResponse({
          record: {
            draftId: 'draft_001',
            followUpTaskId: 'fu_treatment_summary_source',
            customerId: 'cust_wang_repurchase',
            customerDisplayName: '陈女士',
            channelType: 'manual',
            status: 'marked_sent',
            safePreview: '陈女士，已人工编辑低敏随访草稿。',
            draftContent: '陈女士，治疗摘要 D3 护理随访，请人工确认恢复情况。',
            editedContent: '陈女士，已人工编辑低敏随访草稿。',
            approvedAt: '2026-07-06T10:00:00.000Z',
            markedSentAt: '2026-07-06T11:00:00.000Z',
            safeReasonCode: 'draft_marked_sent',
            createdAt: '2026-07-06T08:00:00.000Z',
            updatedAt: '2026-07-06T11:00:00.000Z',
          },
        }),
      ],
    });
    const { container } = render(<SmartFollowUpShell />);

    expect(await screen.findByText('消息草稿')).toBeInTheDocument();
    expect(screen.getByText('仅生成低敏草稿，不会自动发送消息；需要人工确认，人工确认后生成受控发送记录并模拟发送，当前未接真实企业微信 / 短信。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '生成草稿' }));

    expect(await screen.findByText('草稿待确认')).toBeInTheDocument();
    expect(screen.getAllByText('陈女士，治疗摘要 D3 护理随访，请人工确认恢复情况。').length).toBeGreaterThan(0);
    const createBody = mutationBody(fetchMock, '/api/institution/followup-message-drafts', 'POST');
    expect(createBody).toEqual({ followUpTaskId: 'fu_treatment_summary_source' });

    fireEvent.change(screen.getByLabelText('草稿内容'), {
      target: { value: '陈女士，已人工编辑低敏随访草稿。' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    expect(await screen.findByText('陈女士，已人工编辑低敏随访草稿。')).toBeInTheDocument();
    expect(mutationBody(fetchMock, '/api/institution/followup-message-drafts/draft_001', 'PATCH')).toEqual({
      content: '陈女士，已人工编辑低敏随访草稿。',
    });

    fireEvent.click(screen.getByRole('button', { name: '人工确认' }));
    expect(await screen.findByText('已确认')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '标记已人工发送' }));
    expect(await screen.findByText('已人工发送')).toBeInTheDocument();

    const requestPaths = fetchMock.mock.calls.map(([input]) => fetchPath(input));
    expect(requestPaths).toEqual(expect.arrayContaining([
      '/api/institution/followup-message-drafts/draft_001/approve',
      '/api/institution/followup-message-drafts/draft_001/mark-sent',
    ]));
    const text = container.textContent ?? '';
    expect(text).not.toContain('provider');
    expect(text).not.toContain('sk_test_should_not_render');
    expect(text).not.toContain('自动发送微信');
    expect(text).not.toContain('自动短信');
  });

  it('智能随访 409 冲突时提示刷新', async () => {
    mockInstitutionFetch({
      '/api/institution/followups': [
        jsonResponse({ records: [followUpRecord] }),
        jsonResponse({ error: '随访状态已变化，请刷新后重试' }, { status: 409 }),
      ],
    });

    render(<SmartFollowUpShell />);

    expect(await screen.findByText('王女士')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '流转 王女士 到 处理中' }));

    expect(await screen.findByText('随访状态已变化，请刷新后重试')).toBeInTheDocument();
  });

  it('智能随访提交失败时展示错误提示', async () => {
    mockInstitutionFetch({
      '/api/institution/followups': [
        jsonResponse({ records: [followUpRecord] }),
        jsonResponse({ error: '数据服务暂时不可用' }, { status: 503 }),
      ],
    });

    render(<SmartFollowUpShell />);

    expect(await screen.findByText('王女士')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '流转 王女士 到 处理中' }));

    expect(await screen.findByText('数据服务暂时不可用')).toBeInTheDocument();
  });
});
