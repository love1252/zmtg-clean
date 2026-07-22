import { cookies } from 'next/headers';

import { createAuthAccountRepository } from '@/modules/auth/server/auth-account-repository';
import {
  createFormalServerSessionRequestOwnerV1,
  FORMAL_SERVER_SESSION_COOKIE_V1,
} from '@/modules/auth/server/formal-server-session-provenance-owner';
import {
  createControlledInstitutionWorkbenchEntryV1,
  createDisabledInstitutionWorkbenchEntryV1,
  isInstitutionWorkbenchEntryDecisionV1,
  type InstitutionWorkbenchEntryDecisionV1,
} from '@/modules/institution-workbench/server/institution-workbench-entry';
import {
  createActiveInstitutionAnchorProviderV1,
  createAuthoritativeInstitutionAnchorFactReaderV1,
} from '@/modules/security/server/institution-anchor-provider';
import { createInstitutionAnchorFactRepositoryV1 } from '@/modules/security/server/institution-anchor-repository';
import { createInstitutionGuardReferenceCodecV1 } from '@/modules/security/server/institution-guard-reference';
import { resolveInstitutionGuardRuntimeConfigV1 } from '@/modules/security/server/institution-guard-runtime-config';
import { createAuthoritativeInstitutionMembershipFactReaderV1 } from '@/modules/security/server/institution-membership-provider';
import { createInstitutionRequestAuthorizationV1 } from '@/modules/security/server/institution-request-authorization';
import { getDatabase, type TenantDatabase } from '@/server/db/client';

function blocked(): InstitutionWorkbenchEntryDecisionV1 {
  return createDisabledInstitutionWorkbenchEntryV1({});
}

function createDatabaseOnce(): () => TenantDatabase {
  let database: TenantDatabase | null = null;
  return () => {
    database ??= getDatabase();
    return database;
  };
}

/**
 * Server-only workbench composition root. It loads no persistence until the central scope guard
 * has verified the formal cookie and asks for the first authoritative membership fact.
 */
export async function resolveInstitutionWorkbenchRuntimeV1(): Promise<InstitutionWorkbenchEntryDecisionV1> {
  let runtimeConfig: ReturnType<
    typeof resolveInstitutionGuardRuntimeConfigV1
  >;
  try {
    runtimeConfig = resolveInstitutionGuardRuntimeConfigV1();
    if (runtimeConfig.kind !== 'available') return blocked();
  } catch {
    return blocked();
  }

  let cookieHeader: string | null;
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(FORMAL_SERVER_SESSION_COOKIE_V1);
    cookieHeader =
      typeof sessionCookie?.value === 'string'
        ? `${FORMAL_SERVER_SESSION_COOKIE_V1}=${sessionCookie.value}`
        : null;
  } catch {
    return blocked();
  }

  try {
    const now = () => new Date(Date.now());
    const referenceCodec = createInstitutionGuardReferenceCodecV1({
      keyRing: runtimeConfig.institutionGuardReferenceKeyRing,
      now,
    });
    const databaseOnce = createDatabaseOnce();
    const membershipFactReader =
      createAuthoritativeInstitutionMembershipFactReaderV1({
        repository: Object.freeze({
          async findCurrentInstitutionMembershipFacts(input) {
            return createAuthAccountRepository(
              databaseOnce(),
            ).findCurrentInstitutionMembershipFacts(input);
          },
        }),
        now,
      });
    const requestOwner = createFormalServerSessionRequestOwnerV1({
      cookieHeader,
      sessionKeyRing: runtimeConfig.formalServerSessionKeyRing,
      membershipFactReader,
      referenceCodec,
      now,
    });
    const anchorFactReader = createAuthoritativeInstitutionAnchorFactReaderV1({
      repository: Object.freeze({
        async findCurrentInstitutionAnchorFacts(input) {
          return createInstitutionAnchorFactRepositoryV1(
            databaseOnce(),
          ).findCurrentInstitutionAnchorFacts(input);
        },
      }),
      now,
    });
    const anchorProvider = createActiveInstitutionAnchorProviderV1({
      factReader: anchorFactReader,
      referenceCodec,
      now,
    });
    const authorization = createInstitutionRequestAuthorizationV1({
      requestOwner,
      anchorProvider,
      referenceCodec,
      now,
    });
    const decision = await createControlledInstitutionWorkbenchEntryV1({
      authorization,
    });

    return isInstitutionWorkbenchEntryDecisionV1(decision)
      ? decision
      : blocked();
  } catch {
    return blocked();
  }
}
