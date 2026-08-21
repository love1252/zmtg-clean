import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Workbench Conversation action-source formal release gate', () => {
  it('accepts operational conversation summary and consumes the formal Conversation action source', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/hospital/page.tsx'),
      'utf8',
    );
    expect(source).toContain("summary.key === 'page_conversation_queue'");
    expect(source).toContain("summary.decision === 'operational'");
    expect(source).toContain("summary.safeSummary === '会话队列可用'");
    expect(source).toContain('readCurrentInstitutionConversationActionSourceV1');
    expect(source).toContain('buildWorkbenchActionProjection');
    expect(source).not.toContain('disabledConversationActionSource');
  });
});
