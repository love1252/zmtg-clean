import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppointmentCenterShell } from '@/modules/institution/components/AppointmentCenterShell';
import { SmartFollowUpShell } from '@/modules/institution/components/SmartFollowUpShell';
import { getDefaultWeComAuthorizationDashboardView } from '@/modules/institution/domain/wecom-authorization';
import { getDefaultWeComCustomerContactSyncDashboardView } from '@/modules/institution/domain/wecom-customer-contact';
import { getDefaultWeComMockReachOutDashboardView } from '@/modules/institution/domain/wecom-reachout-mock';

const customer = {
  id: 'cust_accessibility_001',
  tenantId: 'tenant_accessibility',
  institutionId: 'inst_accessibility',
  displayName: '王女士',
  lifecycle: 'scheduled' as const,
  priority: 'medium' as const,
  ownerUserId: 'consultant-accessibility',
  projectInterest: '术后护理',
  maskedPhone: '138****1208',
  maskedMedicalRecordNo: 'MR****001',
  lastTouchSummary: '等待人工确认',
  nextAction: '人工跟进',
  tags: [],
  gender: '',
  birthDate: '',
  referralSource: '',
  notes: '',
};

const appointment = {
  id: 'appt_accessibility_001',
  tenantId: 'tenant_accessibility',
  customerId: customer.id,
  customerDisplayName: customer.displayName,
  project: '术后护理',
  scheduledAt: '2026-07-18T10:00:00+08:00',
  consultantUserId: customer.ownerUserId,
  status: 'pending_confirmation' as const,
  note: '低敏备注',
};

const followUpTask = {
  id: 'followup_accessibility_001',
  tenantId: 'tenant_accessibility',
  customerId: customer.id,
  customerDisplayName: customer.displayName,
  journeyId: 'journey_accessibility',
  stage: 'D7 人工回访',
  status: 'due' as const,
  dueAt: '2026-07-18T12:00:00+08:00',
  suggestedAction: '确认术后恢复情况',
  riskLevel: 'watch' as const,
  updatedBy: null,
  updatedAt: null,
};

const dashboard = {
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
};

type FetchReply = Response | Promise<Response>;

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
}

function requestPath(input: Parameters<typeof fetch>[0]) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.pathname + input.search;
  return new URL(input.url).pathname + new URL(input.url).search;
}

function requestKey(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
  return `${init?.method ?? 'GET'} ${requestPath(input)}`;
}

function mockFetch(replies: Record<string, FetchReply[]>) {
  const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const key = requestKey(input, init);
    const reply = replies[key]?.shift();
    if (!reply) {
      throw new Error(`没有为 ${key} 配置 fetch 响应`);
    }
    return reply;
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

function appointmentFetchReplies(createReplies: FetchReply[], updateReplies: FetchReply[]) {
  return {
    'GET /api/institution/appointments': [jsonResponse({ records: [appointment] })],
    'GET /api/institution/customers': [jsonResponse({ records: [customer] })],
    'POST /api/institution/appointments': createReplies,
    'PATCH /api/institution/appointments': updateReplies,
  };
}

function followUpFetchReplies(transitionReplies: FetchReply[], draftReplies: FetchReply[]) {
  return {
    'GET /api/institution/followups': [jsonResponse({ records: [followUpTask] })],
    'GET /api/institution/followup-paths/enrollments': [jsonResponse({ records: [] })],
    'GET /api/institution/followup-operations/dashboard': [
      jsonResponse(dashboard),
      jsonResponse(dashboard),
      jsonResponse(dashboard),
    ],
    [`GET /api/institution/followup-message-drafts?taskId=${followUpTask.id}`]: [
      jsonResponse({ records: [] }),
    ],
    'PATCH /api/institution/followups': transitionReplies,
    'POST /api/institution/followup-message-drafts': draftReplies,
  };
}

function fillAppointmentForm() {
  fireEvent.change(screen.getByLabelText('预约客户'), { target: { value: customer.id } });
  fireEvent.change(screen.getByLabelText('预约项目'), { target: { value: '术后护理' } });
  fireEvent.change(screen.getByLabelText('预约时间'), {
    target: { value: '2026-07-18T10:30:00+08:00' },
  });
  fireEvent.change(screen.getByLabelText('顾问 ID'), {
    target: { value: customer.ownerUserId },
  });
  fireEvent.change(screen.getByLabelText('预约备注'), { target: { value: '低敏备注' } });
}

describe('预约与随访操作错误的读屏播报', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('预约提交与状态更新仅在失败时播报，并在成功后清除', async () => {
    const pendingCreate = deferredResponse();
    mockFetch(
      appointmentFetchReplies(
        [
          pendingCreate.promise,
          jsonResponse({ record: { ...appointment, id: 'appt_accessibility_002' } }, { status: 201 }),
        ],
        [
          jsonResponse({ error: '数据服务暂时不可用' }, { status: 503 }),
          jsonResponse({ record: { ...appointment, status: 'confirmed' } }),
        ],
      ),
    );

    render(<AppointmentCenterShell />);
    expect((await screen.findAllByText('王女士')).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('alert')).toHaveLength(0);

    fillAppointmentForm();
    fireEvent.click(screen.getByRole('button', { name: '新建预约' }));

    expect(await screen.findByRole('button', { name: '提交中...' })).toBeDisabled();
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
    pendingCreate.resolve(jsonResponse({ error: '数据服务暂时不可用' }, { status: 503 }));

    expect(await screen.findByRole('alert')).toHaveTextContent('数据服务暂时不可用');
    expect(screen.getAllByRole('alert')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '新建预约' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '新建预约' })).toBeEnabled();
      expect(screen.queryAllByRole('alert')).toHaveLength(0);
    });

    const existingAppointmentStatus = document.getElementById(
      'appointment-status-appt_accessibility_001',
    );
    if (!(existingAppointmentStatus instanceof HTMLSelectElement)) {
      throw new Error('缺少既有预约的状态更新控件');
    }
    const existingAppointmentForm = existingAppointmentStatus.closest('form');
    if (!existingAppointmentForm) {
      throw new Error('缺少既有预约的状态更新表单');
    }

    fireEvent.change(existingAppointmentStatus, { target: { value: 'confirmed' } });
    fireEvent.submit(existingAppointmentForm);
    expect(await screen.findByRole('alert')).toHaveTextContent('数据服务暂时不可用');

    fireEvent.submit(existingAppointmentForm);
    await waitFor(() => expect(screen.queryAllByRole('alert')).toHaveLength(0));
  });

  it('随访任务与草稿操作失败时播报，成功操作不会留下重复播报', async () => {
    mockFetch(
      followUpFetchReplies(
        [
          jsonResponse({ error: '数据服务暂时不可用' }, { status: 503 }),
          jsonResponse({ record: { ...followUpTask, status: 'in_progress' } }),
        ],
        [
          jsonResponse({ error: '数据服务暂时不可用' }, { status: 503 }),
          jsonResponse({
            record: {
              draftId: 'draft_accessibility_001',
              followUpTaskId: followUpTask.id,
              customerId: customer.id,
              customerDisplayName: customer.displayName,
              channelType: 'wecom',
              status: 'draft',
              safePreview: '低敏人工随访草稿',
              draftContent: '低敏人工随访草稿',
              editedContent: null,
              approvedAt: null,
              markedSentAt: null,
              safeReasonCode: 'manual_follow_up',
              createdAt: '2026-07-18T10:00:00+08:00',
              updatedAt: '2026-07-18T10:00:00+08:00',
            },
          }),
        ],
      ),
    );

    render(<SmartFollowUpShell />);
    expect(await screen.findByText('D7 人工回访')).toBeInTheDocument();
    expect(screen.queryAllByRole('alert')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: '流转 王女士 到 处理中' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('数据服务暂时不可用');
    expect(screen.getAllByRole('alert')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '流转 王女士 到 处理中' }));
    await waitFor(() => expect(screen.queryAllByRole('alert')).toHaveLength(0));

    fireEvent.click(screen.getByRole('button', { name: '生成草稿' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('数据服务暂时不可用');
    expect(screen.getAllByRole('alert')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '生成草稿' }));
    await waitFor(() => expect(screen.queryAllByRole('alert')).toHaveLength(0));
    expect(screen.getAllByText('低敏人工随访草稿')).not.toHaveLength(0);
  });
});
