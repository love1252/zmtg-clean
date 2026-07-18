import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpportunityPoolShell } from '@/modules/institution/components/OpportunityPoolShell';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('旧机会池 UI', () => {
  it('保持低敏迁移状态，不读取旧机会数据或把未知显示为零', () => {
    render(<OpportunityPoolShell />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: '旧机会池功能已迁移', level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '新的正式入口为经营分析的“客户与机会”页面；该页面仍需完成机构能力和数据范围校验。',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\d+ 位客户/u)).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /复诊|复购|沉睡|客户旅程|建议动作|负责人|高优先级|中优先级|观察/u,
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/demo|fixture|演示/u)).not.toBeInTheDocument();
  });
});
