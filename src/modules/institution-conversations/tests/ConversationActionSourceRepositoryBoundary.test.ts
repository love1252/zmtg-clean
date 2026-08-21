import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/institution-conversations/server/conversation-action-source-repository.ts',
  ),
  'utf8',
);

describe('Conversation Action Source repository boundary', () => {
  it('从 authoritative conversation persistence 按 exact scope 读取', () => {
    for (const token of [
      'conversationFormalSources',
      'conversations',
      'conversationSegments',
      'conversationMessages',
      'conversationRisks',
      'eq(conversations.tenantId, input.tenantId)',
      'eq(conversations.institutionId, input.institutionId)',
      'eq(conversations.id, input.conversationId)',
      'readScopedConversationCommandRecordV1',
      'server_persisted_current',
    ]) {
      expect(source).toContain(token);
    }
  });

  it('bounded risk read 且不读取消息正文', () => {
    expect(source).toContain('.limit(MAX_RISK_ROWS + 1)');
    expect(source).toContain(
      'conversationMessages.authorizedContentReference',
    );
    expect(source).toContain(
      'conversationMessages.safeSummaryCode',
    );

    for (const forbidden of [
      'messageBody',
      'messageText',
      'rawPayload',
      'providerPayload',
      'chatContent',
      'fullContent',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('current assignment 与 unresolved risk 均来自正式事实', () => {
    expect(source).toContain(
      'commandRecord.segment.assignment',
    );
    expect(source).toContain(
      "risk.state === 'unconfirmed'",
    );
    expect(source).toContain(
      "risk.state === 'confirmed'",
    );
    expect(source).toContain(
      "segment.state === 'awaiting_human'",
    );
  });
});
