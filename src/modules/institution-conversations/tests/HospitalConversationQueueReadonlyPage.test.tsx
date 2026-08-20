import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ConversationQueueReadonlyShell } from '../components/ConversationQueueReadonlyShell';

const emptyQueue = {
  contractVersion: 'v1' as const,
  dataState: 'empty' as const,
  records: [],
  pageInfo: { pageSize: 100 as const, hasMore: false },
};

describe('Hospital Conversation Queue readonly page', () => {
  it('authoritative empty 明确拒绝 demo/dry-run/proof 补数且无操作按钮', () => {
    render(<ConversationQueueReadonlyShell queue={emptyQueue} />);

    expect(
      screen.getByRole('heading', { name: '会话队列' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('conversation-queue-empty')).toHaveTextContent(
      '暂无正式会话事实',
    );
    expect(screen.getByTestId('conversation-queue-empty')).toHaveTextContent(
      '不会使用 AiConversation、fixture、dry-run、mock_sent 或企业微信 proof 补成会话记录',
    );

    for (const label of ['发送', '接管会话', '改派', '结束会话']) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    }
  });

  it('仅为服务端判定可处置的会话渲染详情入口', () => {
    const queue = {
      contractVersion: 'v1' as const,
      dataState: 'ready' as const,
      records: [
        {
          contractVersion: 'v1' as const,
          conversationId: 'conversation-self',
          channelType: 'wecom',
          identityState: 'matched' as const,
          activeSegmentState: 'human_handling' as const,
          latestCustomerInboundAt: null,
          updatedAt: '2026-08-20T01:00:00.000Z',
        },
        {
          contractVersion: 'v1' as const,
          conversationId: 'conversation-other',
          channelType: 'wecom',
          identityState: 'matched' as const,
          activeSegmentState: 'human_handling' as const,
          latestCustomerInboundAt: null,
          updatedAt: '2026-08-20T00:59:00.000Z',
        },
      ],
      pageInfo: { pageSize: 100 as const, hasMore: false },
    };

    render(
      <ConversationQueueReadonlyShell
        queue={queue}
        actionableConversationIds={['conversation-self']}
      />,
    );

    const links = screen.getAllByRole('link', { name: '打开会话处置' });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      'href',
      '/hospital/conversations/conversation-self',
    );
  });

  it('canonical page 固定 conversations section 与 page_conversation_queue authority', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/hospital/conversations/page.tsx'),
      'utf8',
    );

    expect(source).toContain(
      "const TARGET_SECTION_ID = 'conversations' as const;",
    );
    expect(source).toContain(
      "const TARGET_CAPABILITY_KEY = 'page_conversation_queue' as const;",
    );
    expect(source).toContain(
      "capability.safeSummary !== '会话队列可用'",
    );
    expect(source).not.toMatch(/真实发送|自动发送|controlled create/iu);
  });
});
