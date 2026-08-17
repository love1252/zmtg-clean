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
      "capability.safeSummary !== '会话队列仅供查看'",
    );
    expect(source).not.toMatch(/真实发送|自动发送|controlled create/iu);
  });
});
