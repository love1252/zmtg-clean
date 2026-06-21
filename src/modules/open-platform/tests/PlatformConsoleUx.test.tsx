import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlatformConsole } from '@/modules/workspace/components/PlatformConsole';

describe('平台端控制台体验提示', () => {
  it('平台总览不再展示重复的平台端能力状态卡片', () => {
    render(<PlatformConsole />);

    expect(screen.getByRole('heading', { name: '平台总览' })).toBeInTheDocument();
    expect(screen.queryByLabelText('平台端能力状态')).not.toBeInTheDocument();
    expect(screen.queryByText(/本页用于平台运营人员查看租户、套餐、配额、知识库和审计边界/)).not.toBeInTheDocument();
    expect(screen.getByText('模型配置为受控示例')).toBeInTheDocument();
  });
});
