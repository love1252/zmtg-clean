import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InstitutionAiUsageReadonlyPanel } from '@/modules/institution-system/components/InstitutionAiUsageReadonlyPanel';
import { createInstitutionAiUsageReadonlyViewModel } from '@/modules/institution-system/domain/ai-usage-readonly-view';

const readyView = createInstitutionAiUsageReadonlyViewModel({
  kind: 'ready',
  metrics: {
    totalCallCount: 2,
    serviceUnits: null,
    failureCount: 1,
    rejectionCount: 0,
    incompleteCount: 0,
    successRate: { numerator: 1, denominator: 2, value: 0.5 },
    byServiceKey: [
      {
        serviceKey: 'conversation_ai', totalCallCount: 2, serviceUnits: null,
        failureCount: 1, rejectionCount: 0, incompleteCount: 0,
        successRate: { numerator: 1, denominator: 2, value: 0.5 },
      },
    ],
  },
});

describe('InstitutionAiUsageReadonlyPanel', () => {
  it('renders verified metrics with accessible desktop and mobile semantics', () => {
    render(<InstitutionAiUsageReadonlyPanel view={readyView} />);

    expect(screen.getByRole('heading', { name: 'AI 使用概览' })).toBeInTheDocument();
    const summary = screen.getByLabelText('AI 使用汇总');
    expect(within(summary).getByText('真实调用次数')).toBeInTheDocument();
    expect(within(summary).getByText('50.0%')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: '按业务服务汇总' });
    expect(within(table).getByText('conversation_ai')).toBeInTheDocument();
    expect(screen.getAllByText('失败')).toHaveLength(2);
    expect(screen.queryByText(/额度|趋势|Token|模型|服务商|价格|成本|提示词|回答/u)).not.toBeInTheDocument();
  });

  it.each([
    ['no_data', '权威来源明确无可展示数据。'],
    ['partial', 'AI 使用数据不完整，暂不展示汇总数字。'],
    ['too_many', '记录超过安全读取上限，暂不展示汇总数字。'],
    ['unavailable', '当前无法核验 AI 使用来源。'],
  ] as const)('renders %s as a distinct non-numeric status', (kind, message) => {
    render(<InstitutionAiUsageReadonlyPanel view={createInstitutionAiUsageReadonlyViewModel({ kind })} />);

    expect(screen.getByRole('status')).toHaveTextContent(message);
    expect(screen.queryByLabelText('AI 使用汇总')).not.toBeInTheDocument();
    expect(screen.queryByText(/^0$/u)).not.toBeInTheDocument();
  });
});
