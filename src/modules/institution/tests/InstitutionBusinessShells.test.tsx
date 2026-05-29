import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppointmentCenterShell } from '@/modules/institution/components/AppointmentCenterShell';
import { CustomerCenterShell } from '@/modules/institution/components/CustomerCenterShell';
import { SmartFollowUpShell } from '@/modules/institution/components/SmartFollowUpShell';

describe('institution business shells', () => {
  it('renders the customer center shell', () => {
    render(<CustomerCenterShell />);

    expect(screen.getByRole('heading', { name: '客户中心' })).toBeInTheDocument();
    expect(screen.getByText('高意向待承接')).toBeInTheDocument();
    expect(screen.getByText('王女士')).toBeInTheDocument();
    expect(screen.getByText('客户分层来自 demo 规则')).toBeInTheDocument();
  });

  it('renders the appointment center shell', () => {
    render(<AppointmentCenterShell />);

    expect(screen.getByRole('heading', { name: '预约中心' })).toBeInTheDocument();
    expect(screen.getByText('待确认')).toBeInTheDocument();
    expect(screen.getByText('明日 10:30')).toBeInTheDocument();
    expect(screen.getByText('3 位客户存在爽约风险')).toBeInTheDocument();
  });

  it('renders the smart follow-up shell', () => {
    render(<SmartFollowUpShell />);

    expect(screen.getByRole('heading', { name: '智能随访' })).toBeInTheDocument();
    expect(screen.getByText('术后 D0-D30 关怀')).toBeInTheDocument();
    expect(screen.getByText('D3 异常反馈')).toBeInTheDocument();
    expect(screen.getByText('这是 demo 话术：请根据客户真实恢复情况由专业人员确认后再发送。')).toBeInTheDocument();
  });
});
