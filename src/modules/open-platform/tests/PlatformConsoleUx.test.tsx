import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlatformConsole } from '@/modules/workspace/components/PlatformConsole';

describe('平台端控制台体验提示', () => {
  it('平台总览不再展示重复的平台端能力状态卡片', async () => {
    render(<PlatformConsole />);

    expect(screen.getByRole('heading', { name: '平台总览' })).toBeInTheDocument();
    expect(await screen.findByText('租户聚合暂不可用，当前展示零值安全空态。请稍后刷新或进入租户管理查看接口状态。')).toBeInTheDocument();
    expect(screen.queryByLabelText('平台端能力状态')).not.toBeInTheDocument();
    expect(screen.queryByText(/本页用于平台运营人员查看租户、套餐、配额、知识库和审计边界/)).not.toBeInTheDocument();
    expect(screen.getByText('模型配置已接入多个厂商')).toBeInTheDocument();
    expect(screen.queryByText('模型配置为受控示例')).not.toBeInTheDocument();
  });
});
