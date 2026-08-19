import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { resolveInstitutionCapabilityOffRouteV1 } from '@/modules/institution/components/InstitutionCapabilityOffPage';

describe('Conversation controlled-write independent review regressions', () => {
  it('reserved automations namespace remains physical capability-off and cannot become conversationId', () => {
    const automationsPath = resolve(
      process.cwd(),
      'src/app/hospital/conversations/automations/page.tsx',
    );
    const automationDetailPath = resolve(
      process.cwd(),
      'src/app/hospital/conversations/automations/[journeyId]/page.tsx',
    );
    expect(existsSync(automationsPath)).toBe(true);
    expect(existsSync(automationDetailPath)).toBe(true);

    const automationsSource = readFileSync(automationsPath, 'utf8');
    const detailSource = readFileSync(automationDetailPath, 'utf8');
    expect(automationsSource).toContain('HospitalCapabilityOffRoute');
    expect(detailSource).toContain('HospitalCapabilityOffRoute');
    expect(`${automationsSource}\n${detailSource}`).not.toMatch(
      /institution-conversation-controlled-write-runtime|fetch\(|REAL_SEND|AUTO_REACHOUT/iu,
    );

    expect(
      resolveInstitutionCapabilityOffRouteV1(['conversations', 'automations'])?.routeId,
    ).toBe('conversation_automations');
    expect(
      resolveInstitutionCapabilityOffRouteV1([
        'conversations',
        'automations',
        'journey-001',
      ])?.routeId,
    ).toBe('conversation_automation_detail');
    expect(
      resolveInstitutionCapabilityOffRouteV1(['conversations', 'conversation-001'])?.routeId,
    ).toBe('conversation_detail');
  });

  it('zero-risk normal close requires server-owned completeness and request identity binds segmentId', () => {
    const repository = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/institution-conversations/server/conversation-command-repository.ts',
      ),
      'utf8',
    );
    const segmentDomain = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/institution-conversations/domain/conversation-segments.ts',
      ),
      'utf8',
    );
    const detailPage = readFileSync(
      resolve(
        process.cwd(),
        'src/app/hospital/conversations/[conversationId]/page.tsx',
      ),
      'utf8',
    );

    expect(repository).toContain("completeness: 'authoritative_empty'");
    expect(repository).toContain('rows.length === 0');
    expect(repository).toContain('${segment.segmentId}');
    expect(segmentDomain).toContain("completeness?: 'authoritative_empty'");
    expect(segmentDomain).toContain("riskSet.completeness !== 'authoritative_empty'");
    expect(detailPage).toContain("'conversation-detail-placeholder'");
  });
});
