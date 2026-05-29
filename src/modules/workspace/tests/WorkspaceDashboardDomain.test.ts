import { describe, expect, it } from 'vitest';
import {
  institutionNavItems,
  institutionSegmentItems,
  institutionStats,
  institutionSuggestions,
} from '@/modules/workspace/domain/institution-dashboard';
import {
  platformCapabilityCards,
  platformHealthItems,
  platformMetrics,
  platformNavItems,
} from '@/modules/workspace/domain/platform-dashboard';

describe('workspace dashboard domain', () => {
  it('keeps institution navigation unique with one active entry', () => {
    const labels = institutionNavItems.map((item) => item.label);

    expect(new Set(labels).size).toBe(labels.length);
    expect(institutionNavItems.filter((item) => item.active)).toHaveLength(1);
    expect(labels).toEqual(
      expect.arrayContaining(['工作台', '客户中心', '智能随访', '客服工作台', '预约中心', '知识库']),
    );
  });

  it('keeps institution dashboard cards meaningful', () => {
    expect(institutionStats).toHaveLength(4);
    expect(institutionSuggestions).toHaveLength(4);
    expect(institutionSegmentItems).toHaveLength(4);
    expect(institutionStats.map((item) => item.label)).toEqual(
      expect.arrayContaining(['累计客户数', '活跃旅程数', '预约转化率', '待处理随访']),
    );
  });

  it('keeps platform navigation unique with one active entry', () => {
    const labels = platformNavItems.map((item) => item.label);

    expect(new Set(labels).size).toBe(labels.length);
    expect(platformNavItems.filter((item) => item.active)).toHaveLength(1);
    expect(labels).toEqual(
      expect.arrayContaining(['平台总览', '租户管理', '产品与套餐', '开放连接中心', '权限与组织']),
    );
  });

  it('keeps platform operational cards meaningful', () => {
    expect(platformMetrics).toHaveLength(6);
    expect(platformHealthItems).toHaveLength(4);
    expect(platformCapabilityCards.map((item) => item.title)).toEqual(['开放接口', '连接器治理', '权限审计']);
  });
});
