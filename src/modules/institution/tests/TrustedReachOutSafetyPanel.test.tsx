import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TrustedReachOutSafetyPanel } from '@/modules/institution/components/TrustedReachOutSafetyPanel';

function response(canWrite: boolean) {
  return new Response(JSON.stringify({
    safety: {
      consent: { status: 'consented', sourceType: 'customer_explicit_written', recordedAt: '2026-07-11T00:00:00.000Z' },
      frequency: {
        windowStartedAt: '2026-07-11T00:00:00.000Z', windowEndsAt: '2026-07-12T00:00:00.000Z',
        preparedCount: 1, completedCount: 0, maxPreparedCount: 1, maxCompletedCount: 1,
        nextAllowedAt: '2026-07-12T00:00:00.000Z',
      },
    },
    canWrite,
    channelType: 'wechat_work',
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

afterEach(() => vi.unstubAllGlobals());

describe('企业微信触达许可面板', () => {
  it('admin 可见状态并执行三个受控动作之一', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(true))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        outcome: 'updated', consent: { status: 'opted_out', sourceType: 'customer_opt_out_request', recordedAt: '2026-07-11T01:00:00.000Z' },
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);
    render(<TrustedReachOutSafetyPanel customerId="customer-1" />);
    expect(await screen.findByText('已明确同意')).toBeInTheDocument();
    expect(screen.getByText('1 / 0（上限均为 1）')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '记录退订' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
      action: 'record_opt_out', sourceType: 'customer_opt_out_request',
      confirmation: '我确认客户已明确要求停止企业微信联系',
    });
    expect(await screen.findByText('已退订')).toBeInTheDocument();
  });

  it('operator 只读，三个动作均 disabled 且无 mutation', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(false));
    vi.stubGlobal('fetch', fetcher);
    render(<TrustedReachOutSafetyPanel customerId="customer-1" />);
    expect(await screen.findByText('当前角色仅可只读查看。')).toBeInTheDocument();
    for (const name of ['记录明确同意', '记录退订', '记录撤回']) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403])('加载失败 %s 时 fail-closed 且不展示动作', async (status) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: '无权限' }), { status }));
    vi.stubGlobal('fetch', fetcher);
    render(<TrustedReachOutSafetyPanel customerId="customer-1" />);
    expect(await screen.findByText('触达许可加载失败，所有动作已禁用。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '记录明确同意' })).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('UI 不展示 secret、Token、corpId、UserID、agentId 等字段', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(true));
    vi.stubGlobal('fetch', fetcher);
    const { container } = render(<TrustedReachOutSafetyPanel customerId="customer-1" />);
    await screen.findByText('企业微信触达许可');
    expect(container.textContent).not.toMatch(/secret|token|corpid|userid|agentid/i);
    expect(screen.queryByRole('button', { name: /发送|ready|频控|清零|上限/iu })).not.toBeInTheDocument();
  });
});
