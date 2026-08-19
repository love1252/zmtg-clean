import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Workbench Conversation controlled-write final consumption gate', () => {
  it('accepts operational conversation summary without enabling a fabricated Conversation action source', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/hospital/page.tsx'),
      'utf8',
    );
    expect(source).toContain("summary.key === 'page_conversation_queue'");
    expect(source).toContain("summary.decision === 'operational'");
    expect(source).toContain("summary.safeSummary === '会话队列可用'");
    expect(source).toContain('disabledConversationActionSource');
    expect(source).not.toContain('readCurrentInstitutionConversationActionSourceV1');
  });
});
