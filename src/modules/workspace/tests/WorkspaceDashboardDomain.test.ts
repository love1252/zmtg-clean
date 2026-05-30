import { describe, expect, it } from 'vitest';
import {
  institutionActionQueue,
  institutionJourneyLanes,
  institutionNavItems,
  institutionStats,
  institutionSuggestions,
} from '@/modules/workspace/domain/institution-dashboard';
import {
  platformCapabilityCards,
  platformHealthItems,
  platformMetrics,
  platformNavItems,
} from '@/modules/workspace/domain/platform-dashboard';

describe('工作台看板领域模型', () => {
  it('保持机构导航唯一且只有一个激活入口', () => {
    const labels = institutionNavItems.map((item) => item.label);

    expect(new Set(labels).size).toBe(labels.length);
    expect(institutionNavItems.map((item) => item.id)).toEqual([
      'dashboard',
      'customers',
      'followups',
      'conversations',
      'appointments',
      'knowledge',
      'analytics',
    ]);
    expect(institutionNavItems.filter((item) => item.active)).toHaveLength(1);
    expect(institutionNavItems.find((item) => item.active)?.id).toBe('dashboard');
    expect(labels).toEqual(
      expect.arrayContaining(['工作台', '客户中心', '智能随访', '客服工作台', '预约中心', '知识库', '数据分析']),
    );
  });

  it('保持机构看板卡片具备业务含义', () => {
    expect(institutionStats).toHaveLength(4);
    expect(institutionStats.map((item) => item.label)).toEqual(
      expect.arrayContaining(['累计客户资产', '今日待承接', '预约转化率', '复购窗口客户']),
    );
    expect(institutionSuggestions.map((item) => item.type)).toEqual(['复购', '转化', '服务']);
    expect(institutionJourneyLanes.map((item) => item.title)).toEqual(['新客咨询', '预约到院', '术后关怀', '复购召回']);
    expect(institutionActionQueue).toHaveLength(5);
    expect(institutionActionQueue[0]).toMatchObject({ name: '王女士', score: 98 });
  });

  it('保持平台导航唯一且只有一个激活入口', () => {
    const labels = platformNavItems.map((item) => item.label);

    expect(new Set(labels).size).toBe(labels.length);
    expect(platformNavItems.filter((item) => item.active)).toHaveLength(1);
    expect(labels).toEqual(
      expect.arrayContaining(['平台总览', '首页与品牌', '租户管理', '产品与套餐', '开放连接中心', '权限与审计']),
    );
  });

  it('保持平台运营卡片具备业务含义', () => {
    expect(platformMetrics).toHaveLength(6);
    expect(platformMetrics.map((item) => item.label)).toEqual(
      expect.arrayContaining(['入驻医院', '活跃机构', 'Agent 调用', '服务用户', 'MRR', '续费率']),
    );
    expect(platformHealthItems).toHaveLength(4);
    expect(platformCapabilityCards.map((item) => item.title)).toEqual(['开放接口治理', '模型与智能体监控', '权限审计']);
  });
});
