import { resolveInstitutionServerAuthorizationV1 } from '@/modules/institution/server/institution-server-runtime';
import {
  createControlledInstitutionWorkbenchEntryV1,
  createDisabledInstitutionWorkbenchEntryV1,
  isInstitutionWorkbenchEntryDecisionV1,
  type InstitutionWorkbenchEntryDecisionV1,
} from '@/modules/institution-workbench/server/institution-workbench-entry';
import { isInstitutionRequestAuthorizationV1 } from '@/modules/security/server/institution-request-authorization';

function blocked(): InstitutionWorkbenchEntryDecisionV1 {
  return createDisabledInstitutionWorkbenchEntryV1({});
}

/** Consumes the shared server authorization once and keeps the rendered workbench capability-off. */
export async function resolveInstitutionWorkbenchRuntimeV1(): Promise<InstitutionWorkbenchEntryDecisionV1> {
  let authorization: unknown;
  try {
    authorization = await resolveInstitutionServerAuthorizationV1();
  } catch {
    return blocked();
  }
  if (!isInstitutionRequestAuthorizationV1(authorization)) return blocked();

  try {
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
