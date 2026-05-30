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
  it('定义包含运营下一步动作的客户记录', () => {
    expect(demoCustomers.length).toBeGreaterThanOrEqual(5);

    for (const customer of demoCustomers) {
      expect(customer.id).toMatch(/^cust_/);
      expect(customer.name).toMatch(/女士$/);
      expect(customer.lifecycle).toBeTruthy();
      expect(customer.priority).toMatch(/高|中|观察/);
      expect(customer.owner).toBeTruthy();
      expect(customer.nextAction).toBeTruthy();
      expect(customer).not.toHaveProperty('phone');
      expect(customer).not.toHaveProperty('idNumber');
      expect(customer).not.toHaveProperty('medicalRecordNo');
    }
  });

  it('定义客户分层和洞察摘要', () => {
    expect(customerSegments.map((item) => item.label)).toEqual([
      '高意向待承接',
      '术后关怀中',
      '复购窗口期',
      '沉默待激活',
    ]);
    expect(customerInsightItems.length).toBeGreaterThanOrEqual(3);
  });

  it('覆盖预期的预约流转状态', () => {
    expect(appointmentPipelineGroups.map((group) => group.status)).toEqual([
      '待确认',
      '已确认',
      '已到院',
      '改约跟进',
    ]);
    expect(appointmentAlerts.length).toBeGreaterThanOrEqual(2);
  });

  it('定义随访旅程和到期任务', () => {
    expect(followUpJourneys.map((journey) => journey.name)).toContain('术后 D0-D30 关怀');
    expect(followUpTasks.length).toBeGreaterThanOrEqual(4);

    for (const task of followUpTasks) {
      expect(task.customerName).toMatch(/女士$/);
      expect(task.stage).toBeTruthy();
      expect(task.dueLabel).toBeTruthy();
      expect(task.suggestedAction).toBeTruthy();
    }
  });
});
