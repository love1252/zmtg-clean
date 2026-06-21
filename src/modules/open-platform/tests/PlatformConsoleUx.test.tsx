import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlatformConsole } from '@/modules/workspace/components/PlatformConsole';

describe('平台端控制台体验提示', () => {
  it('在平台总览顶部展示只读预览、演示数据和 V1 边界', () => {
    render(<PlatformConsole />);

    expect(screen.getByRole('heading', { name: '平台总览' })).toBeInTheDocument();
    expect(screen.getByText('只读预览')).toBeInTheDocument();
    expect(screen.getByText('演示数据')).toBeInTheDocument();
    expect(screen.getByText('V1 范围')).toBeInTheDocument();
    expect(screen.getByText('暂未开放编辑能力')).toBeInTheDocument();
    expect(screen.getByText(/本页用于平台运营人员查看租户、套餐、配额、知识库和审计边界/)).toBeInTheDocument();
    expect(screen.getByText('模型配置为受控示例')).toBeInTheDocument();
    expect(screen.getByText(/不会创建租户、修改套餐、发起触达或调用外部系统/)).toBeInTheDocument();
  });
});
