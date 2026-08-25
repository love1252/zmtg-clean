import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InstitutionV11CapabilityPage } from '@/modules/institution-v11/components/InstitutionV11CapabilityPage';

describe('InstitutionV11CapabilityPage', () => {
  it('restores customer advanced filters without client-side unsupported filtering', () => {
    render(<InstitutionV11CapabilityPage routeId="customer_list" pageLabel="客户列表" />);

    fireEvent.click(screen.getByRole('button', { name: '高级筛选' }));

    const drawer = screen.getByRole('dialog', { name: '高级筛选' });
    expect(within(drawer).getByText('基础资料')).toBeInTheDocument();
    expect(within(drawer).getByText('AI 与经营机会')).toBeInTheDocument();
    expect(within(drawer).getAllByText('当前不支持').length).toBeGreaterThan(0);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '高级筛选' })).not.toBeInTheDocument();
  });

  it('restores the six-step import wizard without exposing a fake import action', () => {
    render(<InstitutionV11CapabilityPage routeId="customer_list" pageLabel="客户列表" />);

    fireEvent.click(screen.getByRole('tab', { name: 'Excel 导入' }));

    for (const label of ['下载模板', '上传文件', '字段映射', '数据校验', '重复处理', '完成导入']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('button', { name: '继续此步骤' })).toBeDisabled();
  });

  it('restores four-column conversation context while keeping MessageDelivery disabled', () => {
    render(<InstitutionV11CapabilityPage routeId="conversation_queue" pageLabel="会话队列" />);

    expect(screen.getByText('微信账号')).toBeInTheDocument();
    expect(screen.getByText('未选择会话')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '档案' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '发送' })).toBeDisabled();
    expect(screen.getByPlaceholderText('真实消息发送未开放')).toBeDisabled();
  });

  it('restores calendar and availability drawer without inventing time slots', () => {
    render(<InstitutionV11CapabilityPage routeId="care_appointments" pageLabel="预约管理" />);

    expect(screen.getAllByTitle('Availability 能力未开放').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '空闲时间' }));
    expect(screen.getByRole('dialog', { name: '空闲时间查询' })).toBeInTheDocument();
    expect(screen.getAllByText('Availability 能力未开放').length).toBeGreaterThan(0);
  });

  it('restores readonly follow-up plan designer without a browser persistence writer', () => {
    render(<InstitutionV11CapabilityPage routeId="care_paths" pageLabel="路径管理" />);

    expect(screen.getByText('可视化时间轴')).toBeInTheDocument();
    expect(screen.getByText('结构化问卷')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '发布版本' })).toBeDisabled();
  });

  it('restores business strategy conditions without generated strategy content', () => {
    render(<InstitutionV11CapabilityPage routeId="analytics_reports" pageLabel="AI 经营报告" />);

    fireEvent.click(screen.getByRole('tab', { name: '经营策略' }));
    expect(screen.getByText('上月经营诊断')).toBeInTheDocument();
    expect(screen.getByText('证据与假设')).toBeInTheDocument();
    expect(screen.getAllByText('未满足')).toHaveLength(5);
  });

  it('restores connector matrix and HIS ten-step wizard without secrets or connections', () => {
    render(<InstitutionV11CapabilityPage routeId="system_channels" pageLabel="渠道接入" />);

    expect(screen.getByText('VENDOR_DEPENDENT')).toBeInTheDocument();
    expect(screen.getByText('Capability Matrix')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '接入向导' }));
    const drawer = screen.getByRole('dialog', { name: 'HIS 接入向导' });
    expect(within(drawer).getAllByText('基础信息').length).toBeGreaterThan(0);
    expect(within(drawer).getByText('正式启用')).toBeInTheDocument();
    expect(within(drawer).getByText(/不会收集、保存或回显 Secret/u)).toBeInTheDocument();
  });
});
