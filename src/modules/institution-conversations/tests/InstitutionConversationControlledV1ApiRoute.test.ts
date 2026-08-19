import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Institution Conversation Controlled V1 API route', () => {
  it('publishes only GET/PATCH detail mutations and keeps external messaging out of scope', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/v1/institution/conversations/[conversationId]/route.ts'),
      'utf8',
    );
    expect(source).toContain('export async function GET');
    expect(source).toContain('export async function PATCH');
    expect(source).not.toContain('export async function POST');
    expect(source).not.toContain('export async function DELETE');
    expect(source).toContain('MAX_JSON_BODY_BYTES = 8 * 1024');
    expect(source).toContain("{ code: 'invalid_conversation_update' }");
  });

  it('runtime stays on formal scope, Membership, revision CAS and attributed audit', () => {
    const runtime = readFileSync(
      resolve(process.cwd(), 'src/server/orchestration/institution-conversation-controlled-write-runtime.ts'),
      'utf8',
    );
    const repository = readFileSync(
      resolve(process.cwd(), 'src/modules/institution-conversations/server/conversation-command-repository.ts'),
      'utf8',
    );
    expect(runtime).toContain('resolveInstitutionConversationWriteAuthorizationV1');
    expect(runtime).toContain('createAccessControlAuthoritativeMembershipFactReaderV1');
    expect(runtime).toContain('resolveInstitutionAuditWriterVerifiedAttributionV1');
    expect(repository).toContain('conversationAssignments');
    expect(repository).toContain('eq(conversationSegments.revision, input.expectedSegmentRevision)');
    expect(repository).toContain('eq(conversations.revision, input.expectedConversationRevision)');
    expect(repository).not.toMatch(/wecom|real[_-]?send|provider\.send|ai[_-]?auto/iu);
  });
});
