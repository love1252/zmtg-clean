import { describe, expect, it } from 'vitest';
import {
  customerInsightItems,
  customerSegments,
  demoCustomers,
} from '@/modules/institution/domain/customers';
import {
  appointmentAlerts,
  appointmentPipelineGroups,
} from '@/modules/institution/domain/appointments';
import {
  followUpJourneys,
  followUpTasks,
} from '@/modules/institution/domain/followups';

describe('机构业务领域模型', () => {
  it('客户静态记录默认保持真实空态', () => {
    expect(demoCustomers).toEqual([]);
  });

  it('客户分层和洞察摘要默认保持真实空态', () => {
    expect(customerSegments).toEqual([]);
    expect(customerInsightItems).toEqual([]);
  });

  it('预约流转和告警默认保持真实空态', () => {
    expect(appointmentPipelineGroups).toEqual([]);
    expect(appointmentAlerts).toEqual([]);
  });

  it('随访旅程和到期任务默认保持真实空态', () => {
    expect(followUpJourneys).toEqual([]);
    expect(followUpTasks).toEqual([]);
  });
});
