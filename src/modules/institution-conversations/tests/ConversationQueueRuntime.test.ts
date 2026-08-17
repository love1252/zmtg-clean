import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  createConversationQueueReaderV1,
} from '../application/conversation-queue-reader';

function sourceRow(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    tenantId: 'tenant-001',
    institutionId: 'institution-001',
    conversationId: 'conversation-001',
    channelType: 'wechat_work',
    identityState: 'matched' as const,
    activeSegmentId: 'segment-001',
    activeSegmentState: 'human_handling' as const,
    latestCustomerInboundAt: '2026-08-17T03:00:00.000Z',
    updatedAt: '2026-08-17T03:05:00.000Z',
    ...overrides,
  });
}

describe('Conversation Queue formal runtime', () => {
  it('正式空 cohort 返回 authoritative empty，不制造零值记录', async () => {
    const list = vi.fn(async () => []);
    const reader = createConversationQueueReaderV1({ source: { list } });

    await expect(
      reader.read({
        tenantId: 'tenant-001',
        institutionId: 'institution-001',
      }),
    ).resolves.toEqual({
      kind: 'ready',
      queue: {
        contractVersion: 'v1',
        dataState: 'empty',
        records: [],
        pageInfo: { pageSize: 100, hasMore: false },
      },
    });

    expect(list).toHaveBeenCalledWith({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      limit: 101,
    });
  });

  it('DTO 只暴露低敏队列摘要并去除 scope/source/internal refs', async () => {
    const reader = createConversationQueueReaderV1({
      source: { list: vi.fn(async () => [sourceRow()]) },
    });

    const result = await reader.read({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
    });
    expect(result).toEqual({
      kind: 'ready',
      queue: {
        contractVersion: 'v1',
        dataState: 'ready',
        records: [{
          contractVersion: 'v1',
          conversationId: 'conversation-001',
          channelType: 'wechat_work',
          identityState: 'matched',
          activeSegmentState: 'human_handling',
          latestCustomerInboundAt: '2026-08-17T03:00:00.000Z',
          updatedAt: '2026-08-17T03:05:00.000Z',
        }],
        pageInfo: { pageSize: 100, hasMore: false },
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /tenantId|institutionId|sourceId|channelConversationRef|authorizedContentReference|message_content|raw_payload/u,
    );
  });

  it('跨 scope、active segment shape 漂移与 source overflow fail-closed', async () => {
    for (const rows of [
      [sourceRow({ institutionId: 'other-institution' })],
      [sourceRow({ activeSegmentId: null })],
      Array.from({ length: 102 }, (_, index) =>
        sourceRow({ conversationId: `conversation-${index}` })),
    ]) {
      const reader = createConversationQueueReaderV1({
        source: { list: vi.fn(async () => rows as never) },
      });
      await expect(
        reader.read({
          tenantId: 'tenant-001',
          institutionId: 'institution-001',
        }),
      ).resolves.toEqual({ kind: 'unavailable' });
    }
  });

  it('Repository 源码必须同时约束 tenant + institution 且不读取消息正文或 demo/proof', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/institution-conversations/server/conversation-queue-repository.ts',
      ),
      'utf8',
    );

    expect(source).toContain('eq(conversations.tenantId, query.tenantId)');
    expect(source).toContain('eq(conversations.institutionId, query.institutionId)');
    expect(source).toContain('conversationFormalSources.channelType');
    expect(source).not.toMatch(
      /authorizedContentReference|conversationMessages|weCom|fixture|mock_sent|dry-run/u,
    );
  });
});
