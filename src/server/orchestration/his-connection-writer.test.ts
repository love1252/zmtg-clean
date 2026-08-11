import { describe, expect, it, vi } from 'vitest';

import { createHisConnectionWriter } from '@/server/orchestration/his-connection-writer';
import type { TenantDatabase } from '@/server/db/client';

describe('HIS connection Writer orchestration', () => {
  it('constructs the canonical Institution System command surface', () => {
    const writer = createHisConnectionWriter({} as TenantDatabase);
    expect(Object.keys(writer).sort()).toEqual([
      'clearHisConnectionCredentialReferenceForTenant',
      'createHisConnectionForTenant',
      'pauseHisConnectionForTenant',
      'resumeHisConnectionForTenant',
      'revokeHisConnectionCredentialReferenceForTenant',
      'revokeHisConnectionForTenant',
      'rotateHisConnectionCredentialReferenceForTenant',
      'setHisConnectionCredentialReferenceForTenant',
      'softDeleteHisConnectionForTenant',
      'updateHisConnectionForTenant',
      'writeHisConnectionHealthSummaryForTenant',
    ].sort());
    expect(vi.isMockFunction(writer.createHisConnectionForTenant)).toBe(false);
  });
});
